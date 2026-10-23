import uuid
import pytest
from app.extensions import db
from app.staff import staff_api
from app.staff.keycloak_admin import KeycloakAdminError
from app.workspace.workspace_model import AuditEvent, OfficerAssignment
from tests.test_workflows import HEADERS, actor


class FakeKeycloak:
    def __init__(self):
        self.users = {}
        self.emails = []
        self.fail_role = False
        self.fail_email = False

    def create_user(self, email, first_name, last_name):
        if any(u["email"] == email for u in self.users.values()):
            raise KeycloakAdminError("exists", 409)
        user_id = str(uuid.uuid4())
        self.users[user_id] = {"id": user_id, "email": email, "firstName": first_name, "lastName": last_name,
                               "enabled": True, "requiredActions": ["UPDATE_PASSWORD"], "roles": []}
        return user_id

    def add_realm_role(self, user_id, role):
        if self.fail_role:
            raise KeycloakAdminError("role", 500)
        self.users[user_id]["roles"].append(role)

    def delete_user(self, user_id):
        del self.users[user_id]

    def realm_roles(self, user_id):
        if user_id not in self.users:
            raise KeycloakAdminError("missing", 404)
        return self.users[user_id]["roles"]

    def users_with_role(self, role):
        return [u for u in self.users.values() if role in u["roles"]]

    def set_enabled(self, user_id, enabled):
        self.users[user_id]["enabled"] = enabled

    def send_setup_email(self, user_id, client_id, redirect_uri):
        if self.fail_email:
            raise KeycloakAdminError("smtp", 500)
        self.emails.append((user_id, client_id, redirect_uri))


@pytest.fixture
def keycloak(monkeypatch):
    fake = FakeKeycloak()
    monkeypatch.setattr(staff_api, "keycloak_admin", lambda: fake)
    return fake


def officer_payload(region, **extra):
    return {"email": f"officer-{uuid.uuid4().hex[:8]}@example.test", "first_name": "Asha", "last_name": "Mushi",
            "role": "officer", "region_code": region, **extra}


def test_only_national_admin_with_mfa_manages_staff(client, token_claims, keycloak, geography):
    for roles, mfa in ((["officer"], True), (["regional_supervisor"], True), (["national_admin"], False)):
        actor(token_claims, "someone", *roles, mfa=mfa)
        assert client.get("/staff", headers=HEADERS).status_code == 403
        assert client.post("/staff", json=officer_payload(geography[0]), headers=HEADERS).status_code == 403
    assert client.get("/staff").status_code == 401
    assert keycloak.users == {}


def test_admin_creates_officer_with_region_and_invitation(client, token_claims, keycloak, geography):
    region, district, _, _ = geography
    actor(token_claims, "national-admin", "national_admin")
    body = officer_payload(region, district_code=district)
    response = client.post("/staff", json=body, headers=HEADERS)
    assert response.status_code == 201
    user_id = response.json["user_id"]
    assert response.json["invite_sent"] is True
    assert keycloak.users[user_id]["roles"] == ["officer"]
    assert keycloak.emails == [(user_id, "boma-web", "https://bomahoop.com/dashboard")]
    assignment = OfficerAssignment.query.filter_by(officer_id=user_id).one()
    assert (assignment.region_code, assignment.district_code, assignment.active) == (region, district, True)
    assert AuditEvent.query.filter_by(action="staff.create", target_id=user_id).count() == 1
    listed = {p["user_id"]: p for p in client.get("/staff", headers=HEADERS).json["items"]}
    assert listed[user_id]["roles"] == ["officer"]
    assert listed[user_id]["setup_pending"] is True
    assert listed[user_id]["assignments"][0]["district_code"] == district
    assert client.post("/staff", json={**body, "email": body["email"].upper()}, headers=HEADERS).status_code == 409


def test_role_and_geography_rules(client, token_claims, keycloak, geography):
    region, district, _, other = geography
    actor(token_claims, "national-admin", "national_admin")
    assert client.post("/staff", json={**officer_payload(region), "role": "national_admin"}, headers=HEADERS).status_code == 400
    assert client.post("/staff", json={**officer_payload(region), "role": "owner"}, headers=HEADERS).status_code == 400
    assert client.post("/staff", json=officer_payload(None), headers=HEADERS).status_code == 400
    assert client.post("/staff", json=officer_payload(other, district_code=district), headers=HEADERS).status_code == 400
    assert client.post("/staff", json={**officer_payload(region), "role": "finance"}, headers=HEADERS).status_code == 400
    finance = {**officer_payload(None), "role": "finance"}
    del finance["region_code"]
    assert client.post("/staff", json=finance, headers=HEADERS).status_code == 201
    assert len(keycloak.users) == 1


def test_failed_role_grant_removes_account(client, token_claims, keycloak, geography):
    actor(token_claims, "national-admin", "national_admin")
    keycloak.fail_role = True
    body = officer_payload(geography[0])
    assert client.post("/staff", json=body, headers=HEADERS).status_code == 502
    assert keycloak.users == {}
    assert AuditEvent.query.filter_by(action="staff.create").filter(AuditEvent.details["email"].as_string() == body["email"]).count() == 0


def test_email_failure_keeps_account_and_can_be_resent(client, token_claims, keycloak, geography):
    actor(token_claims, "national-admin", "national_admin")
    keycloak.fail_email = True
    response = client.post("/staff", json=officer_payload(geography[0]), headers=HEADERS)
    assert response.status_code == 201
    assert response.json["invite_sent"] is False
    user_id = response.json["user_id"]
    assert client.post(f"/staff/{user_id}/invitation", headers=HEADERS).status_code == 502
    keycloak.fail_email = False
    assert client.post(f"/staff/{user_id}/invitation", headers=HEADERS).status_code == 200
    assert len(keycloak.emails) == 1


def test_deactivate_and_reactivate_staff(client, token_claims, keycloak, geography):
    actor(token_claims, "national-admin", "national_admin")
    user_id = client.post("/staff", json=officer_payload(geography[0]), headers=HEADERS).json["user_id"]
    assert client.patch(f"/staff/{user_id}", json={"enabled": False}, headers=HEADERS).status_code == 200
    assert keycloak.users[user_id]["enabled"] is False
    assert OfficerAssignment.query.filter_by(officer_id=user_id).one().active is False
    assert client.patch(f"/staff/{user_id}", json={"enabled": True}, headers=HEADERS).status_code == 200
    db.session.expire_all()
    assert OfficerAssignment.query.filter_by(officer_id=user_id).one().active is True
    assert AuditEvent.query.filter_by(action="staff.disable", target_id=user_id).count() == 1


def test_operator_managed_and_unknown_accounts_are_protected(client, token_claims, keycloak):
    admin_id = keycloak.create_user("admin@example.test", "Ada", "Admin")
    keycloak.add_realm_role(admin_id, "national_admin")
    customer_id = keycloak.create_user("buyer@example.test", "Bea", "Buyer")
    keycloak.add_realm_role(customer_id, "buyer")
    actor(token_claims, "national-admin", "national_admin")
    assert client.patch(f"/staff/{admin_id}", json={"enabled": False}, headers=HEADERS).status_code == 403
    assert client.patch(f"/staff/{customer_id}", json={"enabled": False}, headers=HEADERS).status_code == 404
    assert client.patch("/staff/missing", json={"enabled": False}, headers=HEADERS).status_code == 404
    actor(token_claims, admin_id, "national_admin")
    assert client.patch(f"/staff/{admin_id}", json={"enabled": False}, headers=HEADERS).status_code == 403
    assert all(user["enabled"] for user in keycloak.users.values())


def test_staff_creation_is_disabled_without_configuration(client, token_claims, monkeypatch):
    monkeypatch.setattr(staff_api, "keycloak_admin", lambda: None)
    actor(token_claims, "national-admin", "national_admin")
    assert client.get("/staff", headers=HEADERS).status_code == 503


def test_mfa_switch_controls_invitation_steps(app, monkeypatch):
    from app.staff.keycloak_admin import setup_actions
    with app.app_context():
        assert "CONFIGURE_TOTP" in setup_actions()
        monkeypatch.setitem(app.config, "STAFF_MFA_REQUIRED", False)
        assert setup_actions() == ["VERIFY_EMAIL", "UPDATE_PASSWORD"]


def test_password_only_staff_allowed_when_mfa_not_required(client, token_claims, keycloak, app, monkeypatch):
    actor(token_claims, "national-admin", "national_admin", mfa=False)
    assert client.get("/staff", headers=HEADERS).status_code == 403
    monkeypatch.setitem(app.config, "STAFF_MFA_REQUIRED", False)
    assert client.get("/staff", headers=HEADERS).status_code == 200

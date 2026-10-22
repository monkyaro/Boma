from app.extensions import db
from app.onboarding.onboarding_model import IdentityVerificationCase

HEADERS = {"Authorization": "Bearer test"}


def test_identity_requires_token(client):
    assert client.get("/onboarding/owner-identity").status_code == 401
    assert client.post("/onboarding/owner-identity", json={}).status_code == 401


def test_customer_can_request_once_without_role_upgrade(client, token_claims):
    token_claims["sub"] = "identity-customer"
    token_claims["realm_access"]["roles"] = ["buyer"]
    assert client.get("/onboarding/owner-identity", headers=HEADERS).status_code == 404
    first = client.post("/onboarding/owner-identity", json={}, headers=HEADERS)
    assert first.status_code == 201
    assert first.get_json()["status"] == "pending"
    second = client.post("/onboarding/owner-identity", json={}, headers=HEADERS)
    assert second.status_code == 200
    assert second.get_json() == first.get_json()
    assert client.get("/onboarding/owner-identity", headers=HEADERS).get_json() == first.get_json()
    assert token_claims["realm_access"]["roles"] == ["buyer"]
    assert IdentityVerificationCase.query.filter_by(user_id="identity-customer").count() == 1


def test_identity_is_account_scoped(client, token_claims):
    token_claims["sub"] = "identity-other"
    assert client.get("/onboarding/owner-identity", headers=HEADERS).status_code == 404


def test_cannot_self_approve_or_impersonate(client, token_claims):
    for payload in ({"status": "approved"}, {"user_id": "victim"}, {"roles": ["owner"]}, None):
        assert client.post("/onboarding/owner-identity", json=payload,
                           data="null" if payload is None else None,
                           content_type="application/json", headers=HEADERS).status_code == 400


def test_identity_status_constraint(app):
    import pytest
    from sqlalchemy.exc import IntegrityError
    with app.app_context():
        db.session.add(IdentityVerificationCase(user_id="invalid-status", status="anything"))
        with pytest.raises(IntegrityError):
            db.session.commit()
        db.session.rollback()


def test_concurrent_requests_share_one_case(app, token_claims):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    token_claims["sub"] = "identity-concurrent"
    barrier = Barrier(2)

    def submit():
        with app.test_client() as client:
            barrier.wait(timeout=10)
            response = client.post("/onboarding/owner-identity", json={}, headers=HEADERS)
            return response.status_code, response.get_json()["case_id"]

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: submit(), range(2)))
    assert sorted(status for status, _ in results) == [200, 201]
    assert len({case_id for _, case_id in results}) == 1

"""Minimal Keycloak Admin REST client for staff provisioning.

Authenticates as the confidential service-account client KEYCLOAK_ADMIN_CLIENT_ID
(client credentials). That account holds only realm-management view-realm, view-users,
query-users and manage-users; which roles may be granted is enforced by staff_api.
"""
import time
from urllib.parse import quote
import requests
from flask import current_app

# Setup links in invitation emails stay valid for 3 days
SETUP_LINK_LIFESPAN = 3 * 24 * 3600
SETUP_ACTIONS = ["VERIFY_EMAIL", "UPDATE_PASSWORD", "CONFIGURE_TOTP"]


class KeycloakAdminError(Exception):
    def __init__(self, message, status=None):
        super().__init__(message)
        self.status = status


class KeycloakAdmin:
    def __init__(self, base_url, realm, client_id, client_secret, timeout=10):
        self.base_url = base_url.rstrip("/")
        self.realm = realm
        self.client_id = client_id
        self.client_secret = client_secret
        self.timeout = timeout
        self._token = None
        self._expires = 0.0

    def _access_token(self):
        if self._token and time.time() < self._expires - 30:
            return self._token
        response = requests.post(
            f"{self.base_url}/realms/{self.realm}/protocol/openid-connect/token",
            data={"grant_type": "client_credentials", "client_id": self.client_id,
                  "client_secret": self.client_secret},
            timeout=self.timeout)
        if response.status_code != 200:
            raise KeycloakAdminError("Staff directory sign-in failed", response.status_code)
        body = response.json()
        self._token, self._expires = body["access_token"], time.time() + body.get("expires_in", 60)
        return self._token

    def _request(self, method, path, expected=(200, 204), **kwargs):
        response = requests.request(
            method, f"{self.base_url}/admin/realms/{self.realm}{path}",
            headers={"Authorization": f"Bearer {self._access_token()}"}, timeout=self.timeout, **kwargs)
        if response.status_code not in expected:
            raise KeycloakAdminError(f"Staff directory request failed ({method} {path.split('?')[0]})",
                                     response.status_code)
        return response

    def create_user(self, email, first_name, last_name):
        """Returns the new user id; KeycloakAdminError status 409 when the email is taken."""
        response = self._request("POST", "/users", expected=(201,), json={
            "username": email, "email": email, "firstName": first_name, "lastName": last_name,
            "enabled": True, "emailVerified": False, "requiredActions": SETUP_ACTIONS})
        return response.headers["Location"].rstrip("/").rsplit("/", 1)[-1]

    def get_user(self, user_id):
        return self._request("GET", f"/users/{quote(user_id, safe='')}").json()

    def delete_user(self, user_id):
        self._request("DELETE", f"/users/{quote(user_id, safe='')}")

    def set_enabled(self, user_id, enabled):
        self._request("PUT", f"/users/{quote(user_id, safe='')}", json={"enabled": enabled})
        if not enabled:
            self._request("POST", f"/users/{quote(user_id, safe='')}/logout")

    def realm_roles(self, user_id):
        return [role["name"] for role in self._request("GET", f"/users/{quote(user_id, safe='')}/role-mappings/realm").json()]

    def add_realm_role(self, user_id, role):
        representation = self._request("GET", f"/roles/{quote(role, safe='')}").json()
        self._request("POST", f"/users/{quote(user_id, safe='')}/role-mappings/realm", json=[representation])

    def users_with_role(self, role):
        return self._request("GET", f"/roles/{quote(role, safe='')}/users?first=0&max=1000").json()

    def send_setup_email(self, user_id, client_id, redirect_uri):
        self._request("PUT", f"/users/{quote(user_id, safe='')}/execute-actions-email",
                      params={"lifespan": SETUP_LINK_LIFESPAN, "client_id": client_id, "redirect_uri": redirect_uri},
                      json=SETUP_ACTIONS)


def keycloak_admin():
    """The configured client, or None when staff provisioning is not configured."""
    config = current_app.config
    if not (config.get("KEYCLOAK_ADMIN_URL") and config.get("KEYCLOAK_ADMIN_CLIENT_SECRET")):
        return None
    return KeycloakAdmin(config["KEYCLOAK_ADMIN_URL"], config["KEYCLOAK_REALM"],
                         config["KEYCLOAK_ADMIN_CLIENT_ID"], config["KEYCLOAK_ADMIN_CLIENT_SECRET"])

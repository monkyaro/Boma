from datetime import datetime, timedelta, timezone
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from app.utilities.keycloak_jwt import KeycloakJWT
from app.extensions import flask_keycloak


def test_malformed_token_headers_do_not_crash(client):
    for header in ("Bearer ", "Bearer", "Bearer a b", "Basic abc"):
        assert client.get("/onboarding/owner-identity", headers={"Authorization": header}).status_code == 401


def test_missing_subject_is_rejected(client, monkeypatch):
    monkeypatch.setattr(flask_keycloak, "decode", lambda token: {})
    assert client.get("/onboarding/owner-identity", headers={"Authorization": "Bearer test"}).status_code == 401


def test_real_signature_audience_issuer_and_expiry(app, monkeypatch):
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    verifier = KeycloakJWT()
    class Key:
        key = private.public_key()
    class Keys:
        def get_signing_key_from_jwt(self, token):
            return Key()
    monkeypatch.setattr(verifier, "_jwks", lambda: Keys())
    now = datetime.now(timezone.utc)
    claims = {"sub": "test-subject", "aud": app.config["KEYCLOAK_AUDIENCE"],
              "iss": app.config["KEYCLOAK_ISSUER"], "iat": now, "exp": now + timedelta(minutes=5)}
    assert verifier.decode(jwt.encode(claims, private, algorithm="RS256"))["sub"] == "test-subject"
    for patch in ({"aud": "wrong"}, {"iss": "https://other.test"}, {"exp": now - timedelta(seconds=10)}):
        with pytest.raises(jwt.PyJWTError):
            verifier.decode(jwt.encode({**claims, **patch}, private, algorithm="RS256"))
    missing_exp = {key: value for key, value in claims.items() if key != "exp"}
    with pytest.raises(jwt.MissingRequiredClaimError):
        verifier.decode(jwt.encode(missing_exp, private, algorithm="RS256"))


def test_write_rate_limit_is_enforced(client, token_claims, app, monkeypatch):
    import uuid
    token_claims["sub"] = str(uuid.uuid4())
    monkeypatch.setitem(app.config, "API_WRITE_RATE_PER_MINUTE", 2)
    headers = {"Authorization": "Bearer test"}
    assert client.post("/onboarding/owner-identity", json={}, headers=headers).status_code == 201
    assert client.post("/onboarding/owner-identity", json={}, headers=headers).status_code == 200
    assert client.post("/onboarding/owner-identity", json={}, headers=headers).status_code == 429


def test_private_responses_are_not_cached(client, token_claims):
    response = client.get("/workspace/session", headers={"Authorization": "Bearer test"})
    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "no-store"
    assert response.headers["X-Content-Type-Options"] == "nosniff"


def test_primary_otp_alone_does_not_satisfy_staff_mfa(client, token_claims):
    token_claims["realm_access"]["roles"] = ["national_admin"]
    token_claims["amr"] = ["otp"]
    assert client.get("/workspace/properties", headers={"Authorization": "Bearer test"}).status_code == 403


def test_database_failures_do_not_disclose_private_parameters(client, monkeypatch, caplog):
    from sqlalchemy.exc import OperationalError
    from app.extensions import db
    marker = "private-location-marker-39.123456"
    def failure(*args, **kwargs):
        raise OperationalError("SELECT private", {"location": marker}, Exception(marker))
    monkeypatch.setattr(db.session, "get", failure)
    response = client.get("/listings/test-private")
    assert response.status_code == 503
    assert marker not in response.get_data(as_text=True)
    assert marker not in caplog.text

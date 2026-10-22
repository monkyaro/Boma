import os
import pytest
from dotenv import load_dotenv
from sqlalchemy import text

# Load environment variables for testing
load_dotenv(".env.test")

from app import create_app, db as _db  # noqa: E402
from app.extensions import flask_keycloak  # noqa: E402


@pytest.fixture(scope="session")
def app():
    app, _ = create_app("setting.py", {"TESTING": True})

    with app.app_context():
        _db.session.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        _db.session.commit()
        _db.drop_all()
        _db.create_all()
        yield app
        _db.session.remove()
        _db.drop_all()


@pytest.fixture(scope="function")
def client(app):
    return app.test_client()


@pytest.fixture
def token_claims(monkeypatch):
    """Bypass JWKS verification: any bearer token decodes to these claims."""
    claims = {
        "sub": "00000000-0000-0000-0000-000000000001",
        "preferred_username": "agent1",
        "realm_access": {"roles": ["agent"]},
    }
    monkeypatch.setattr(flask_keycloak, "decode", lambda token: claims)
    return claims

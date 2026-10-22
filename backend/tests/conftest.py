import uuid
import pytest
from dotenv import load_dotenv
from sqlalchemy import text

# Load environment variables for testing
load_dotenv(".env.test")

from app import create_app, db as _db  # noqa: E402
from app.extensions import flask_keycloak  # noqa: E402
from app.workspace.workspace_model import Region, District, Ward  # noqa: E402


@pytest.fixture(scope="session")
def app():
    app, _ = create_app("setting.py", {"TESTING": True})

    with app.app_context():
        if _db.engine.url.database != "boma_test":
            raise RuntimeError("Destructive test fixtures require the disposable boma_test database")
        _db.session.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        _db.session.commit()
        _db.drop_all()
        _db.session.execute(text("DROP TABLE IF EXISTS alembic_version"))
        _db.session.commit()
        from flask_migrate import upgrade
        upgrade()
        yield app
        _db.session.remove()
        _db.drop_all()
        _db.session.execute(text("DROP TABLE IF EXISTS alembic_version"))
        _db.session.commit()


@pytest.fixture(scope="function")
def client(app):
    return app.test_client()


@pytest.fixture
def token_claims(monkeypatch):
    """Bypass JWKS verification: any bearer token decodes to these claims."""
    claims = {
        "sub": str(uuid.uuid4()),
        "preferred_username": "owner1",
        "realm_access": {"roles": ["owner"]},
    }
    monkeypatch.setattr(flask_keycloak, "decode", lambda token: claims)
    return claims


@pytest.fixture
def geography(app):
    suffix = uuid.uuid4().hex[:8]
    region = Region(code="R" + suffix, name="Test region " + suffix)
    other = Region(code="O" + suffix, name="Other test region " + suffix)
    _db.session.add_all([region, other])
    _db.session.flush()
    district = District(code="D" + suffix, name="Test district", region_code=region.code)
    _db.session.add(district)
    _db.session.flush()
    ward = Ward(code="W" + suffix, name="Test ward", district_code=district.code)
    _db.session.add(ward)
    _db.session.commit()
    return region.code, district.code, ward.code, other.code

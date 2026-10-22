from flask_sqlalchemy import SQLAlchemy
from flask_marshmallow import Marshmallow
from flask_restx import Api
from flask_cors import CORS
from flask_migrate import Migrate
from .utilities.keycloak_jwt import KeycloakJWT
from app.constants.swag import authorizations

db = SQLAlchemy()
ma = Marshmallow()
api = Api(
    title="BOMA API",
    version="1.0",
    description="BOMA Real Estate Marketplace REST API",
    doc="/swagger",
    authorizations=authorizations,
    security='BearerAuth'
)

flask_keycloak = KeycloakJWT()
cors = CORS()
migrate = Migrate()

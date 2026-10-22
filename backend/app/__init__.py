import logging
from flask import Flask, request
from flask_httpauth import HTTPBasicAuth
from werkzeug.security import check_password_hash, generate_password_hash
import sentry_sdk
from sentry_sdk.integrations.flask import FlaskIntegration
from app.utilities.util import make_celery
from .extensions import flask_keycloak, db, ma, api, cors, migrate
from .commands import enable_postgis
from .health.health_api import health_ns
from .listings.listing_api import listing_ns
from .onboarding.onboarding_api import onboarding_ns
from . import model  # noqa: F401  registers models for migrations


# swagger---------------------------------------------------------------------------

auth = HTTPBasicAuth()
swagger_users = {}


@auth.verify_password
def verify(username, password):
    if username in swagger_users and check_password_hash(swagger_users[username], password):
        return username


# END SWAGGER------------------------------------------------------------------------


def create_app(config_file="setting.py", config_overrides=None):
    logging.basicConfig(level=logging.INFO)

    app = Flask(__name__)
    app.config.from_pyfile(config_file)
    if config_overrides:
        app.config.update(config_overrides)

    if app.config.get("SENTRY_DSN"):
        sentry_sdk.init(dsn=app.config["SENTRY_DSN"],
                        integrations=[FlaskIntegration()],
                        traces_sample_rate=0.1)

    if app.config.get("SWAGGER_USERNAME") and app.config.get("SWAGGER_PASSWORD"):
        swagger_users[app.config["SWAGGER_USERNAME"]] = generate_password_hash(
            app.config["SWAGGER_PASSWORD"])

    # Flask extensions and app initialization
    db.init_app(app)
    celery = make_celery(app)
    celery.set_default()
    ma.init_app(app)
    api.init_app(app)
    cors.init_app(app, resources={r"/*": {"origins": app.config["CORS_ORIGINS"]}})
    flask_keycloak.init_app(app)
    migrate.init_app(app, db)

    # Register CLI commands
    app.cli.add_command(enable_postgis)

    # Register API namespaces
    api.add_namespace(health_ns)
    api.add_namespace(listing_ns)
    api.add_namespace(onboarding_ns)

    @app.teardown_request
    def teardown_request(exception=None):
        db.session.remove()

    @app.before_request
    def protect_swagger():
        if request.path.startswith(("/swagger", "/swagger.json")):
            if not app.config["SWAGGER_UI_ENABLED"]:
                return {"message": "Not found"}, 404
            return auth.login_required(lambda: None)()

    return app, celery

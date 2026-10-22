import os

SECRET_KEY = os.environ.get("SECRET_KEY")
DEBUG = os.environ.get("FLASK_DEBUG", "false").lower() == "true"

SQLALCHEMY_DATABASE_URI = os.environ.get("SQLALCHEMY_DATABASE_URI")
SQLALCHEMY_TRACK_MODIFICATIONS = False
SQLALCHEMY_ENGINE_OPTIONS = {
    "pool_pre_ping": True,
    "pool_recycle": 280,
    "pool_size": 5,
    "max_overflow": 10,
}

CELERY_BROKER_URL = os.environ.get("CELERY_BROKER_URL")
CELERY_RESULT_BACKEND = os.environ.get("CELERY_RESULT_BACKEND")
CELERYBEAT_SCHEDULE = {}

# ---------------------------------------------------------------------------
# Keycloak (https://auth.bomahoop.com, realm "boma")
# ---------------------------------------------------------------------------
# Tokens are verified locally against the realm's JWKS; no introspection call
# per request. KEYCLOAK_AUDIENCE is the API client id the token must target.
KEYCLOAK_ISSUER = os.environ.get("KEYCLOAK_ISSUER")
KEYCLOAK_AUDIENCE = os.environ.get("KEYCLOAK_AUDIENCE", "boma-api")

# Comma-separated list, e.g. "https://bomahoop.com,https://www.bomahoop.com"
CORS_ORIGINS = [
    o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]

# Swagger UI is off unless enabled, and then behind basic auth.
SWAGGER_UI_ENABLED = os.environ.get("SWAGGER_UI_ENABLED", "false").lower() == "true"
SWAGGER_USERNAME = os.environ.get("SWAGGER_USERNAME")
SWAGGER_PASSWORD = os.environ.get("SWAGGER_PASSWORD")

# ---------------------------------------------------------------------------
# Media storage (S3). On EC2 credentials come from the instance role.
# ---------------------------------------------------------------------------
AWS_REGION = os.environ.get("AWS_REGION", "eu-west-1")
# Regional endpoint so presigned URLs don't hit the global host (307 on new buckets).
AWS_S3_ENDPOINT_URL = os.environ.get("AWS_S3_ENDPOINT_URL")
MEDIA_S3_BUCKET = os.environ.get("MEDIA_S3_BUCKET")
MEDIA_S3_UPLOAD_URL_TTL = int(os.environ.get("MEDIA_S3_UPLOAD_URL_TTL", 600))

SENTRY_DSN = os.environ.get("SENTRY_DSN")

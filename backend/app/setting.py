import os

SECRET_KEY = os.environ.get("SECRET_KEY")
DEBUG = os.environ.get("FLASK_DEBUG", "false").lower() == "true"

SQLALCHEMY_DATABASE_URI = os.environ.get("SQLALCHEMY_DATABASE_URI")
SQLALCHEMY_TRACK_MODIFICATIONS = False
SQLALCHEMY_ENGINE_OPTIONS = {
    "pool_pre_ping": True,
    "hide_parameters": True,
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
KEYCLOAK_REALM = os.environ.get("KEYCLOAK_REALM", "boma")

# Staff provisioning through the Keycloak Admin REST API (service-account client).
# Unset KEYCLOAK_ADMIN_URL or secret disables staff account creation (503).
KEYCLOAK_ADMIN_URL = os.environ.get("KEYCLOAK_ADMIN_URL")  # e.g. http://keycloak:8080 on the Compose network
KEYCLOAK_ADMIN_CLIENT_ID = os.environ.get("KEYCLOAK_ADMIN_CLIENT_ID", "boma-admin-api")
KEYCLOAK_ADMIN_CLIENT_SECRET = os.environ.get("KEYCLOAK_ADMIN_CLIENT_SECRET")
# Where the invitation email's setup link returns new staff after they finish
STAFF_SETUP_CLIENT_ID = os.environ.get("STAFF_SETUP_CLIENT_ID", "boma-web")
STAFF_SETUP_REDIRECT_URL = os.environ.get("STAFF_SETUP_REDIRECT_URL", "https://bomahoop.com/dashboard")

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

# Proposed physical-viewing policy stays disabled until explicitly approved.
VIEWING_POLICY_APPROVED = os.environ.get("VIEWING_POLICY_APPROVED", "false").lower() == "true"
# No numeric demand policy is assumed; empty disables automatic review task creation.
VERIFICATION_INQUIRY_THRESHOLD = int(os.environ.get("VERIFICATION_INQUIRY_THRESHOLD", "0"))

MEDIA_UPLOADS_ENABLED = os.environ.get("MEDIA_UPLOADS_ENABLED", "false").lower() == "true"

# Optional private-network JWKS endpoint; issuer validation always uses KEYCLOAK_ISSUER.
KEYCLOAK_JWKS_URL = os.environ.get("KEYCLOAK_JWKS_URL")

API_WRITE_RATE_PER_MINUTE = int(os.environ.get("API_WRITE_RATE_PER_MINUTE", "60"))

PAYMENT_SANDBOX_ENABLED = os.environ.get("PAYMENT_SANDBOX_ENABLED", "false").lower() == "true"
PAYMENT_SANDBOX_SIGNING_SECRET = os.environ.get("PAYMENT_SANDBOX_SIGNING_SECRET")

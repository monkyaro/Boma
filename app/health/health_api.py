from flask_restx import Resource, Namespace
from sqlalchemy import text
from flask import current_app
import redis
from app.extensions import db

health_ns = Namespace('health', description='Liveness and readiness probes')


@health_ns.route("/live")
class Live(Resource):
    def get(self):
        return {"status": "ok"}, 200


@health_ns.route("/ready")
class Ready(Resource):
    def get(self):
        checks = {}
        try:
            db.session.execute(text("SELECT 1"))
            checks["database"] = "ok"
        except Exception:
            checks["database"] = "error"

        try:
            redis.Redis.from_url(
                current_app.config["CELERY_BROKER_URL"], socket_timeout=2).ping()
            checks["redis"] = "ok"
        except Exception:
            checks["redis"] = "error"

        healthy = all(v == "ok" for v in checks.values())
        return {"status": "ok" if healthy else "degraded", "checks": checks}, 200 if healthy else 503

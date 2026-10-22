from flask import g, request
from flask_restx import Namespace, Resource
from sqlalchemy.exc import IntegrityError
from app.extensions import db, flask_keycloak
from .onboarding_model import IdentityVerificationCase

onboarding_ns = Namespace("onboarding", description="Owner identity onboarding")


def case_response(case):
    return {"case_id": case.case_id, "status": case.status,
            "created_at": case.created_at.isoformat()}


@onboarding_ns.route("/owner-identity")
class OwnerIdentity(Resource):
    @flask_keycloak.require_token
    def get(self):
        case = IdentityVerificationCase.query.filter_by(
            user_id=g.user["userId"]).first()
        if case is None:
            return {"message": "Identity case not found"}, 404
        return case_response(case), 200

    @flask_keycloak.require_token
    def post(self):
        # Do not accept caller-supplied user IDs, status, evidence or roles.
        if request.get_data() and request.get_json(silent=True) != {}:
            return {"message": "Submit an empty JSON object"}, 400
        user_id = g.user["userId"]
        case = IdentityVerificationCase.query.filter_by(user_id=user_id).first()
        if case is not None:
            return case_response(case), 200
        case = IdentityVerificationCase(user_id=user_id)
        db.session.add(case)
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            # The database uniqueness constraint also serializes concurrent requests.
            case = IdentityVerificationCase.query.filter_by(user_id=user_id).first()
            if case is None:
                raise
            return case_response(case), 200
        return case_response(case), 201

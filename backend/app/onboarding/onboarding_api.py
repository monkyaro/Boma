from flask import g, request
from flask_restx import Namespace, Resource
from sqlalchemy.exc import IntegrityError
from app.extensions import db, flask_keycloak
from .onboarding_model import IdentityVerificationCase
from app.workspace.access import geography, audit
from app.workspace.validation import payload, string

onboarding_ns = Namespace("onboarding", description="Owner identity onboarding")


def case_response(case):
    return {"case_id": case.case_id, "status": case.status,
            "created_at": case.created_at.isoformat(), "residence_region_code": case.residence_region_code}


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
    def patch(self):
        data = payload({"residence_region_code": string(32)})
        geography(data["residence_region_code"])
        case = IdentityVerificationCase.query.filter_by(user_id=g.user["userId"]).with_for_update().first()
        if case is None:
            return {"message": "Open an identity case first"}, 404
        if case.status != "pending":
            return {"message": "Case already decided"}, 409
        case.residence_region_code = data["residence_region_code"]
        audit("identity.residence", case.case_id)
        db.session.commit()
        return case_response(case)

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
            db.session.flush()
            audit("identity.request", case.case_id)
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            # The database uniqueness constraint also serializes concurrent requests.
            case = IdentityVerificationCase.query.filter_by(user_id=user_id).first()
            if case is None:
                raise
            return case_response(case), 200
        return case_response(case), 201

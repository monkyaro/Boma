from functools import wraps
from flask import g
from flask_restx import abort
from app.extensions import db, flask_keycloak
from .workspace_model import AuditEvent, Notification, OfficerAssignment, Ward, District

STAFF_ROLES = {"officer", "regional_supervisor", "national_admin"}


def roles():
    return set(g.token.get("realm_access", {}).get("roles", []))


def has_mfa():
    methods = set(g.token.get("amr", []))
    return "mfa" in methods or {"pwd", "otp"}.issubset(methods)


def require_staff_roles(*allowed):
    def decorate(fn):
        @flask_keycloak.require_token
        @wraps(fn)
        def protected(*args, **kwargs):
            if not roles() & set(allowed):
                abort(403, "Authorized staff access required")
            if not has_mfa():
                abort(403, "Staff multi-factor authentication required")
            return fn(*args, **kwargs)
        return protected
    return decorate


staff_only = require_staff_roles(*STAFF_ROLES)
finance_only = require_staff_roles("finance", "national_admin")


def scope(region_code, district_code=None, ward_code=None, officer_id=None):
    if officer_id is None and "national_admin" in roles():
        return
    officer_id = officer_id or g.user["userId"]
    assignments = OfficerAssignment.query.filter_by(officer_id=officer_id, active=True, available=True).all()
    if not region_code or not any(
        a.region_code == region_code
        and (a.district_code is None or a.district_code == district_code)
        and (a.ward_code is None or a.ward_code == ward_code)
        for a in assignments
    ):
        abort(403, "Outside assigned geography or unavailable")


def listing_scope(listing, officer_id=None):
    scope(listing.region_code, listing.district_code, listing.ward_code, officer_id)


def geography(region_code, district_code=None, ward_code=None):
    from .workspace_model import Region
    if not region_code or db.session.get(Region, region_code) is None:
        abort(400, "Select a valid Tanzania region")
    if district_code:
        district = db.session.get(District, district_code)
        if district is None or district.region_code != region_code:
            abort(400, "District does not belong to region")
    if ward_code:
        ward = db.session.get(Ward, ward_code)
        if ward is None or not district_code or ward.district_code != district_code:
            abort(400, "Ward does not belong to district")


def audit(action, target_id, **details):
    db.session.add(AuditEvent(actor_id=g.user["userId"], action=action,
                              target_id=str(target_id), details=details))


def notify(user_id, body):
    db.session.add(Notification(user_id=user_id, body=body))

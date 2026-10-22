import uuid
import boto3
from flask import current_app, g
from flask_restx import Namespace, Resource, abort
from marshmallow import fields, validate
from app.extensions import db, flask_keycloak
from app.listings.listing_model import Listing
from app.workspace.access import audit
from app.workspace.validation import payload, string, choice
from .media_model import ProtectedUpload

media_ns = Namespace("media", description="Private quarantined upload adapter")
ALLOWED_TYPES = {"image/jpeg": "jpg", "image/png": "png", "application/pdf": "pdf"}


@media_ns.route("/uploads")
class Upload(Resource):
    @flask_keycloak.require_token
    def post(self):
        data = payload({"kind": choice(["photo", "property_document"]), "listing_id": string(36),
                        "content_type": choice(ALLOWED_TYPES),
                        "size_bytes": fields.Integer(required=True, validate=validate.Range(min=1, max=10485760))})
        listing = Listing.query.filter_by(listing_id=data["listing_id"], owner_id=g.user["userId"]).with_for_update().first()
        if listing is None:
            abort(404, "Listing not found")
        if listing.verification_status == "VERIFIED" or listing.status == "withdrawn":
            abort(403, "Request staff approval before changing verified property media")
        bucket = current_app.config.get("MEDIA_S3_BUCKET")
        if not bucket or not current_app.config["MEDIA_UPLOADS_ENABLED"]:
            abort(503, "Media uploads await secure storage and scanning configuration")
        if data["kind"] == "photo" and data["content_type"] == "application/pdf":
            abort(400, "Photos must be JPEG or PNG")
        key = f"quarantine/{uuid.uuid4()}.{ALLOWED_TYPES[data['content_type']]}"
        # Content length is enforced by S3 POST policy. No client-selected keys or public ACLs.
        client = boto3.client("s3", region_name=current_app.config["AWS_REGION"],
                              endpoint_url=current_app.config.get("AWS_S3_ENDPOINT_URL"))
        signed = client.generate_presigned_post(
            bucket, key, Fields={"Content-Type": data["content_type"]},
            Conditions=[{"Content-Type": data["content_type"]}, ["content-length-range", data["size_bytes"], data["size_bytes"]]],
            ExpiresIn=300,
        )
        row = ProtectedUpload(user_id=g.user["userId"], object_key=key, **data)
        db.session.add(row)
        db.session.flush()
        audit("media.quarantine", row.upload_id)
        db.session.commit()
        return {"upload_id": row.upload_id, "status": row.status, "upload": signed}, 201


@media_ns.route("/uploads/<string:upload_id>")
class UploadStatus(Resource):
    @flask_keycloak.require_token
    def get(self, upload_id):
        row = ProtectedUpload.query.filter_by(upload_id=upload_id, user_id=g.user["userId"]).first()
        if row is None:
            abort(404, "Upload not found")
        # Never return originals or signed read URLs from the general media endpoint.
        return {"upload_id": row.upload_id, "kind": row.kind, "status": row.status}

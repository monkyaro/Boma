from app.extensions import db
from app.workspace.workspace_model import uid, now


class ProtectedUpload(db.Model):
    __tablename__ = "protected_uploads"
    upload_id = db.Column(db.String(36), primary_key=True, default=uid)
    user_id = db.Column(db.String(36), nullable=False, index=True)
    listing_id = db.Column(db.ForeignKey("listings.listing_id"), index=True)
    kind = db.Column(db.String(20), nullable=False)
    object_key = db.Column(db.String(250), nullable=False, unique=True)
    content_type = db.Column(db.String(100), nullable=False)
    size_bytes = db.Column(db.Integer, nullable=False)
    status = db.Column(db.String(20), nullable=False, default="quarantined")
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=now)

from flask import request
from flask_restx import abort
from marshmallow import Schema, ValidationError, fields, validate


def payload(definition, partial=False):
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        abort(400, "A JSON object is required")
    try:
        return Schema.from_dict(definition)().load(data, partial=partial)
    except ValidationError as error:
        abort(400, "Invalid request", errors=error.messages)


def string(maximum=200, required=True):
    return fields.String(required=required, validate=validate.Length(min=1, max=maximum))


def choice(values, required=True):
    return fields.String(required=required, validate=validate.OneOf(values))


def money(required=True):
    return fields.Decimal(required=required, as_string=True, places=2,
                          validate=validate.Range(min=0, max=999999999999))


def public_text(value):
    """Reject common direct-contact and precise-coordinate disclosures in public copy."""
    import re
    patterns = (
        r"[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}",
        r"https?://|www\.",
        r"(?:\+?255|0)[ -]*[67](?:[ -]*\d){8}\b",
        r"\+\d(?:[ -]*\d){8,14}\b",
        r"-?\d{1,2}\.\d{3,}\s*[,/]\s*-?\d{2}\.\d{3,}",
        r"\b(?:latitude|longitude)\s*[:=]",
    )
    if value and any(re.search(pattern, value, re.IGNORECASE) for pattern in patterns):
        abort(400, "Keep contact details, links and exact coordinates out of public property text")
    return value

from app.extensions import db
from app.listings.listing_model import Listing

NEW_LISTING = {
    "title": "3 bedroom house in Mbezi Beach",
    "listing_type": "sale",
    "property_type": "house",
    "price": "350000000",
    "region": "Dar es Salaam",
    "district": "Kinondoni",
    "latitude": -6.7224,
    "longitude": 39.2145,
}


def test_create_requires_token(client):
    rs = client.post("/listings", json=NEW_LISTING)
    assert rs.status_code == 401


def test_create_requires_role(client, token_claims):
    token_claims["realm_access"]["roles"] = ["buyer"]
    rs = client.post("/listings", json=NEW_LISTING,
                     headers={"Authorization": "Bearer test"})
    assert rs.status_code == 403


def test_create_validates_payload(client, token_claims):
    rs = client.post("/listings", json={**NEW_LISTING, "listing_type": "swap"},
                     headers={"Authorization": "Bearer test"})
    assert rs.status_code == 400
    assert "listing_type" in rs.get_json()["error"]


def test_create_and_fetch(client, token_claims, app):
    rs = client.post("/listings", json=NEW_LISTING,
                     headers={"Authorization": "Bearer test"})
    assert rs.status_code == 201
    body = rs.get_json()
    assert body["owner_id"] == token_claims["sub"]
    assert body["status"] == "draft"

    # Drafts are not public
    assert client.get(f"/listings/{body['listing_id']}").status_code == 404

    with app.app_context():
        Listing.get_by_id(body["listing_id"]).status = "published"
        db.session.commit()

    assert client.get(f"/listings/{body['listing_id']}").status_code == 200
    rs = client.get("/listings?region=Dar es Salaam")
    assert rs.get_json()["total"] == 1

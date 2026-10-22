

def test_live(client):
    rs = client.get("/health/live")
    assert rs.status_code == 200
    assert rs.get_json() == {"status": "ok"}


def test_ready(client):
    rs = client.get("/health/ready")
    assert rs.status_code == 200
    assert rs.get_json()["checks"] == {"database": "ok", "redis": "ok"}


def test_swagger_disabled_by_default(client):
    assert client.get("/swagger").status_code == 404

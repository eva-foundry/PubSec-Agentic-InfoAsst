from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_returns_ready():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
    assert data["version"] == "0.1.0"

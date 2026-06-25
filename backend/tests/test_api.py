from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health():
    res = client.get("/")
    assert res.status_code == 200
    assert res.json()["project"] == "Project Sentinel"


def test_analyze_phishing():
    payload = {"message": "From: scammer@phish.com Subject: Urgent! Account Suspended Body: Click here to verify"}
    res = client.post("/api/analyze", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["sender"] == "scammer@phish.com"
    assert data["risk_tier"] == "High"
    assert "request_id" in data

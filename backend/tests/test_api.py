from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health():
    res = client.get("/")
    assert res.status_code == 200
    assert res.json()["project"] == "Project Sentinel"


def test_analyze_phishing():
    # Added \n so the ingestion.py parser can actually split the lines
    payload = {"message": "From: scammer@phish.com\nSubject: Urgent! Account Suspended\nBody: Click here to verify"}
    res = client.post("/api/analyze", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["sender"] == "scammer@phish.com"
    assert data["risk_tier"] == "High"
    assert "request_id" in data


def test_analyze_semantic_risk():
    """Test semantic risk analysis with a hacked friend message."""
    payload = {
        "message": "From: bestfriend@gmail.com\nSubject: Emergency bro\nBody: Bro I need you to send me $500 right now. My wallet got stolen and I'm stuck. I'll explain later just please do it quickly."
    }
    res = client.post("/api/analyze", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["urgency_score"] > 0.5
    assert isinstance(data["risk_factors"], list)
    assert len(data["risk_factors"]) > 0
    assert data["is_anonymized"] is True

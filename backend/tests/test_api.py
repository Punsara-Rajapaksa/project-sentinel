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


def test_honeypot_endpoint():
    """Test the honeypot agent endpoint with a sample analysis state."""
    sample_analysis = {
        "raw_text": "From: scammer@phish.com\nSubject: Urgent help\nBody: I need $500 sent via Bitcoin to 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa immediately.",
        "sender": "scammer@phish.com",
        "subject": "Urgent help",
        "body": "I need $500 sent via Bitcoin to 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa immediately.",
        "risk_tier": "High",
        "composite_risk_score": 0.9,
        "urgency_score": 0.85,
        "authority_manipulation_score": 0.7,
        "structural_similarity_score": 0.8,
        "risk_assessment": "This is a scam.",
        "risk_factors": ["Financial request", "Urgency"],
        "is_anonymized": True,
        "request_id": "test-123",
    }
    res = client.post("/api/honeypot/start", json={"analysis": sample_analysis})
    assert res.status_code == 200
    data = res.json()
    assert data["honeypot_active"] is True
    assert isinstance(data["honeypot_conversation"], list)
    assert len(data["honeypot_conversation"]) > 0
    assert isinstance(data["harvested_artifacts"], list)
    # The known wallet address from the scripted scammer messages should be harvested
    assert "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa" in data["harvested_artifacts"]

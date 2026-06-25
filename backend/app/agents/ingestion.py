import uuid
from app.state import PipelineState


def run_ingestion(state: PipelineState) -> dict:
    raw_text = state.get("raw_text", "")
    
    # Parse message
    sender = ""
    subject = ""
    body = ""
    
    lines = raw_text.split("\n")
    remaining_lines = []
    
    for line in lines:
        if line.startswith("From:"):
            sender = line.replace("From:", "").strip()
        elif line.startswith("Subject:"):
            subject = line.replace("Subject:", "").strip()
        elif line.startswith("Body:"):
            body = line.replace("Body:", "").strip()
        else:
            remaining_lines.append(line)
    
    # If no structured format found, treat entire text as body
    if not body and remaining_lines:
        body = "\n".join(remaining_lines).strip()
    
    # Determine risk_tier
    combined_text = (subject + " " + body).lower()
    
    high_risk_keywords = [
        "urgent", "suspended", "verify", "password", "account", "threat", "legal action"
    ]
    medium_risk_keywords = [
        "click here", "transfer", "wire", "payment"
    ]
    
    risk_tier = "Low"
    
    if any(keyword in combined_text for keyword in high_risk_keywords):
        risk_tier = "High"
    elif any(keyword in combined_text for keyword in medium_risk_keywords):
        risk_tier = "Medium"
    
    return {
        "sender": sender,
        "subject": subject,
        "body": body,
        "risk_tier": risk_tier,
        "is_anonymized": False,
        "request_id": str(uuid.uuid4()),
    }

from typing import TypedDict, Optional


class PipelineState(TypedDict, total=False):
    raw_text: str
    sender: str
    subject: str
    body: str
    timestamp: str
    risk_tier: str
    urgency_score: float
    authority_manipulation_score: float
    structural_similarity_score: float
    risk_assessment: str
    risk_factors: list[str]
    verification_details: dict
    authenticity_confidence_score: float
    composite_risk_score: float
    recommendation: str
    user_action: Optional[str]
    feedback_message: Optional[str]
    honeypot_active: bool
    honeypot_conversation: list[dict[str, str]]
    harvested_artifacts: list[str]
    is_anonymized: bool
    request_id: str

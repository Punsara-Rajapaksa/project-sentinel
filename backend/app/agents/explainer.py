import logging
from app.state import PipelineState

logger = logging.getLogger(__name__)


def run_agent(state: PipelineState) -> dict:
    """
    Explainer Agent (Agent 4): Arbitrator that computes final composite risk score
    and recommendation by weighing Agent 2's semantic scores against Agent 3's
    technical verification results.
    """
    try:
        # ── Read scores from upstream agents ──────────────
        urgency_score = state.get("urgency_score", 0.0)
        authority_manipulation_score = state.get("authority_manipulation_score", 0.0)
        structural_similarity_score = state.get("structural_similarity_score", 0.0)
        authenticity_confidence_score = state.get("authenticity_confidence_score", 0.5)
        
        # ── Weighted composite risk score ─────────────────
        # Low authenticity (high risk) → (1 - authenticity) contributes positively to risk
        composite_risk_score = round(
            0.35 * urgency_score
            + 0.25 * authority_manipulation_score
            + 0.20 * structural_similarity_score
            + 0.20 * (1.0 - authenticity_confidence_score),
            4
        )
        
        # ── Map composite to risk tier ────────────────────
        if composite_risk_score > 0.7:
            risk_tier = "High"
        elif composite_risk_score > 0.3:
            risk_tier = "Medium"
        else:
            risk_tier = "Low"
        
        # ── Map composite to recommendation ───────────────
        if composite_risk_score > 0.7:
            recommendation = "Report & Archive"
        elif composite_risk_score > 0.3:
            recommendation = "Do Not Engage"
        else:
            recommendation = "No threat detected"
        
        return {
            "composite_risk_score": composite_risk_score,
            "risk_tier": risk_tier,
            "recommendation": recommendation,
        }
    
    except Exception as e:
        logger.error(f"Error in explainer agent: {e}", exc_info=True)
        return {
            "composite_risk_score": 0.5,
            "risk_tier": "Medium",
            "recommendation": "Do Not Engage",
        }

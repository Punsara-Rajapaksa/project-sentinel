import logging
from app.state import PipelineState
from app.utils.anonymizer import anonymize_text
from app.utils.chroma_client import query_similar_scams
from app.utils.deepseek_client import analyze_message_risk

logger = logging.getLogger(__name__)


def run_agent(state: PipelineState) -> dict:
    """
    Semantic Risk Agent (Agent 2): Analyze message for social engineering threats.
    
    Steps:
    1. Extract body and subject from state
    2. Anonymize combined text (PII removal)
    3. Query ChromaDB for similar scams
    4. Call DeepSeek for CoT risk analysis
    5. Return risk scores and factors
    """
    try:
        # Extract message parts
        subject = state.get("subject", "")
        body = state.get("body", "")
        combined_text = f"{subject}\n{body}".strip()
        
        # Anonymize text before sending to external API
        anonymized_text = anonymize_text(combined_text)
        
        # Query ChromaDB for similar scams
        similar_scams = query_similar_scams(anonymized_text, n_results=3)
        
        # Call DeepSeek for risk analysis
        analysis = analyze_message_risk(anonymized_text, similar_scams)
        
        # Compute structural similarity score (max similarity from ChromaDB or 0)
        structural_similarity_score = 0.0
        if similar_scams:
            # If we found similar scams, assume some similarity
            # In a more advanced implementation, this would come from embedding distances
            structural_similarity_score = 0.5
        
        return {
            "urgency_score": analysis["urgency_score"],
            "authority_manipulation_score": analysis["authority_manipulation_score"],
            "structural_similarity_score": structural_similarity_score,
            "risk_assessment": analysis["risk_assessment"],
            "risk_factors": analysis["risk_factors"],
            "is_anonymized": True,
        }
    
    except Exception as e:
        logger.error(f"Error in semantic risk analysis: {e}", exc_info=True)
        return {
            "urgency_score": 0.5,
            "authority_manipulation_score": 0.5,
            "structural_similarity_score": 0.0,
            "risk_assessment": f"Error during analysis: {str(e)}",
            "risk_factors": ["Analysis error"],
            "is_anonymized": True,
        }

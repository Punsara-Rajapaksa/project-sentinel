import json
import logging
import os
from openai import OpenAI

logger = logging.getLogger(__name__)

client = OpenAI(
    api_key=os.getenv("DEEPSEEK_API_KEY"),
    base_url="https://api.deepseek.com"
)


def analyze_message_risk(message_text: str, similar_scams: list[str]) -> dict:
    """
    Analyze message for social engineering threats using DeepSeek CoT reasoning.
    
    Args:
        message_text: The anonymized message text to analyze
        similar_scams: List of similar known scams for context
    
    Returns:
        dict with urgency_score, authority_manipulation_score, risk_assessment, risk_factors
    """
    
    # Build context from similar scams
    similar_scams_context = ""
    if similar_scams:
        similar_scams_context = "\n\nContext - Similar known scams:\n"
        for scam in similar_scams:
            similar_scams_context += f"- Similar known scam: {scam}\n"
    
    system_prompt = """You are an AI security analyst. Analyze the following message for social engineering threats. Look for:
- Urgency or time pressure
- Authority manipulation (pretending to be an official)
- Emotional appeals (fear, excitement, emergency)
- Financial requests or credential harvesting
- Inconsistencies with normal communication patterns

Return a JSON object with keys:
- urgency_score (float 0-1)
- authority_manipulation_score (float 0-1)
- risk_assessment (string, plain English summary)
- risk_factors (list of strings, specific reasons)

Do not wrap the JSON in markdown code fences."""

    user_prompt = f"Analyze this message for threats:\n\n{message_text}{similar_scams_context}"
    
    try:
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.1,
        )
        
        response_text = response.choices[0].message.content.strip()
        
        # Parse JSON from response
        result = json.loads(response_text)
        
        return {
            "urgency_score": float(result.get("urgency_score", 0.5)),
            "authority_manipulation_score": float(result.get("authority_manipulation_score", 0.5)),
            "risk_assessment": str(result.get("risk_assessment", "Unable to determine risk")),
            "risk_factors": list(result.get("risk_factors", [])),
        }
    
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse DeepSeek response as JSON: {e}")
        return {
            "urgency_score": 0.5,
            "authority_manipulation_score": 0.5,
            "risk_assessment": "Error parsing risk analysis response",
            "risk_factors": ["Analysis error - please retry"],
        }
    
    except Exception as e:
        logger.error(f"DeepSeek API error: {e}")
        return {
            "urgency_score": 0.5,
            "authority_manipulation_score": 0.5,
            "risk_assessment": f"Error contacting security analysis service: {str(e)}",
            "risk_factors": ["Service unavailable"],
        }

import logging
import random
import re
from app.state import PipelineState

logger = logging.getLogger(__name__)

# ── Known legitimate domains for typosquatting detection ──
KNOWN_DOMAINS = [
    "gmail.com", "yahoo.com", "outlook.com", "hotmail.com",
    "university.ac.lk", "ac.lk", "google.com", "microsoft.com",
    "apple.com", "amazon.com", "paypal.com", "security-alert.com",
]


def _levenshtein(a: str, b: str) -> int:
    """Compute Levenshtein edit distance between two strings."""
    if len(a) < len(b):
        return _levenshtein(b, a)
    if len(b) == 0:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a):
        curr = [i + 1]
        for j, cb in enumerate(b):
            insert = prev[j + 1] + 1
            delete = curr[j] + 1
            substitute = prev[j] + (0 if ca == cb else 1)
            curr.append(min(insert, delete, substitute))
        prev = curr
    return prev[-1]


def _is_typosquatting(domain: str) -> bool:
    """Check if domain is a typosquat of a known legitimate domain."""
    domain_lower = domain.lower()
    for known in KNOWN_DOMAINS:
        dist = _levenshtein(domain_lower, known)
        # Flag if edit distance is 1-2 and domain is not the known one itself
        if 1 <= dist <= 2 and domain_lower != known:
            return True
    return False


def _extract_urls(text: str) -> list[str]:
    """Extract URLs from text that look suspicious."""
    url_pattern = re.compile(r'https?://[^\s<>"{}|\\^`\[\]]+', re.IGNORECASE)
    urls = url_pattern.findall(text)
    suspicious_keywords = ["verify", "login", "click", "confirm", "account", "password", "update", "secure"]
    suspicious = []
    for url in urls:
        url_lower = url.lower()
        if any(kw in url_lower for kw in suspicious_keywords):
            suspicious.append(url)
    return suspicious


def run_agent(state: PipelineState) -> dict:
    """
    Verification & OSINT Agent (Agent 3): Mock technical checks on sender identity.
    
    Performs mock domain-age, SPF/DKIM, typosquatting, and URL scanning.
    Returns verification_details and authenticity_confidence_score.
    """
    try:
        sender = state.get("sender", "")
        body = state.get("body", "")
        
        # Parse domain from sender email
        domain = ""
        if "@" in sender:
            domain = sender.split("@")[-1].strip().lower()
        elif sender:
            domain = sender.strip().lower()
        
        # Determine if sender looks suspicious
        suspicious_signals = ["secuirty-alert", "phish", "suspended", "verify", "login", "secure", "account-update"]
        is_suspicious = any(sig in sender.lower() for sig in suspicious_signals)
        
        # ── Mock checks ──────────────────────────────────
        if is_suspicious:
            domain_age_days = random.randint(1, 90)
            spf_valid = False
            dkim_valid = False
        else:
            domain_age_days = random.randint(500, 2000)
            spf_valid = True
            dkim_valid = True
        
        typosquatting_detected = _is_typosquatting(domain) if domain else False
        malicious_urls = _extract_urls(body)
        
        # ── Compute authenticity confidence ──────────────
        score = 0.5
        if domain_age_days < 30:
            score -= 0.25
        elif domain_age_days < 90:
            score -= 0.15
        else:
            score += 0.10
        
        if not spf_valid:
            score -= 0.15
        if not dkim_valid:
            score -= 0.10
        if typosquatting_detected:
            score -= 0.20
        if malicious_urls:
            score -= 0.15 * min(len(malicious_urls), 3)
        
        authenticity_confidence_score = round(max(0.0, min(1.0, score)), 4)
        
        verification_details = {
            "domain": domain,
            "domain_age_days": domain_age_days,
            "spf_valid": spf_valid,
            "dkim_valid": dkim_valid,
            "typosquatting_detected": typosquatting_detected,
            "malicious_urls": malicious_urls,
        }
        
        return {
            "verification_details": verification_details,
            "authenticity_confidence_score": authenticity_confidence_score,
        }
    
    except Exception as e:
        logger.error(f"Error in verification agent: {e}", exc_info=True)
        return {
            "verification_details": {
                "domain": "",
                "domain_age_days": 0,
                "spf_valid": False,
                "dkim_valid": False,
                "typosquatting_detected": False,
                "malicious_urls": [],
                "error": str(e),
            },
            "authenticity_confidence_score": 0.5,
        }

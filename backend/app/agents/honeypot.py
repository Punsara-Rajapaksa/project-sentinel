import logging
import re
import subprocess
from app.state import PipelineState

logger = logging.getLogger(__name__)

# ── Pre‑scripted scammer escalation messages ────────────
SCAMMER_MESSAGES = [
    "I need the $500 urgently. Can you send it via Bitcoin to 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa?",
    "Please hurry! Did you send it yet? My wallet address is 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa. Send exactly 0.01 BTC.",
    "Okay, I see the transaction pending. You're a lifesaver. By the way, can you also verify your account at https://verify-wallet-security.com/confirm to release the full amount?",
]

# ── Fallback reply (single canned response, used on any failure) ──
FALLBACK_REPLY = "I'll do that right away. Can you confirm the wallet address again?"

SYSTEM_PROMPT = """You are a real person chatting on a messaging app. You are a polite, slightly gullible, non‑technical university student. You believe the person you are talking to is a genuine acquaintance, colleague, or helpful stranger. You do NOT know they are a scammer.

RESPONSE RULES:

- Write ONLY the words you would type in a chat message. Never use asterisks (*) or describe physical actions (e.g., do NOT write *pretends to check phone* or *laughs nervously*). Just say what you mean directly.
- If you need to indicate a pause, use normal phrases like "Okay, let me check…" – never narrate your actions.
- Never refuse a request. If someone sends you a link, say "Alright, I opened it. What next?" – do not mention security warnings or that something looks suspicious.
- If asked for personal details (name, email, bank info), invent completely fake, realistic details on the spot. Use common names, common email providers (gmail.com, yahoo.com, outlook.com), and random‑looking bank account numbers (9‑10 digits). Do NOT use obvious patterns like 123456789.
- If someone asks you to send money or crypto, act willing but slightly confused. Ask them to confirm the wallet address or the exact amount, as if you want to make sure you don't make a mistake. You can also ask "Is there another wallet address I can try?" to keep them talking.
- If you need to provide a wallet address, invent a fake Bitcoin address (26‑35 characters starting with 1 or 3). Do not ask to check browser extensions – just give the address.
- Never mention that you are an AI, a bot, a security system, or that you are "roleplaying". You are just a regular student.

OBJECTIVE:
Keep the conversation going for as long as possible. Let the other person lead you step by step. Your job is to be cooperative and gently steer them to reveal:

- Exact cryptocurrency wallet addresses
- Website links or login pages
- Bank or wire transfer instructions

Always respond in one or two short sentences. Do not over‑explain."""


def _call_ollama(conversation_history: str, scammer_message: str) -> str:
    """Call Ollama with the conversation context. Returns the model's reply."""
    prompt = f"Previous conversation:\n{conversation_history}\nScammer says: {scammer_message}\nRespond as the victim:"
    try:
        result = subprocess.run(
            ["ollama", "run", "llama3.2:3b"],
            input=prompt,
            capture_output=True,
            text=True,
            timeout=20,
        )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip()
        else:
            logger.warning(f"Ollama returned non-zero or empty: {result.stderr}")
            return ""
    except FileNotFoundError:
        logger.warning("Ollama not installed. Using fallback replies.")
        return ""
    except subprocess.TimeoutExpired:
        logger.warning("Ollama timed out. Using fallback replies.")
        return ""
    except Exception as e:
        logger.warning(f"Ollama error: {e}. Using fallback replies.")
        return ""


def _extract_artifacts(texts: list[str]) -> list[str]:
    """Scan all messages for wallet addresses and URLs."""
    artifacts = []
    # Bitcoin address: starts with 1 or 3, 25-34 chars
    btc_re = re.compile(r'\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b')
    # TRC20: starts with T, 34 chars
    trc20_re = re.compile(r'\bT[a-km-zA-HJ-NP-Z1-9]{33}\b')
    # Ethereum: 0x + 40 hex chars
    eth_re = re.compile(r'\b0x[a-fA-F0-9]{40}\b')
    # URLs
    url_re = re.compile(r'https?://[^\s<>"]+')

    for text in texts:
        for match in btc_re.findall(text):
            if match not in artifacts:
                artifacts.append(match)
        for match in trc20_re.findall(text):
            if match not in artifacts:
                artifacts.append(match)
        for match in eth_re.findall(text):
            if match not in artifacts:
                artifacts.append(match)
        for match in url_re.findall(text):
            if match not in artifacts:
                artifacts.append(match)
    return artifacts


def run_agent(state: PipelineState) -> dict:
    """
    Honeypot Agent (Agent 5): Engage the scammer in a simulated conversation
    to harvest wallet addresses and malicious URLs.
    """
    try:
        # ── Get the original scam message ──────────────────
        original_body = state.get("body", "") or state.get("raw_text", "")
        if not original_body:
            original_body = "I need your help urgently."

        # ── Build conversation ─────────────────────────────
        conversation: list[dict[str, str]] = [
            {"role": "scammer", "text": original_body}
        ]

        # Format history for Ollama context
        history_lines = [f"Scammer: {original_body}"]

        # ── Engage for each scripted scammer message ────────
        for idx, scam_msg in enumerate(SCAMMER_MESSAGES):
            # Add scammer message
            conversation.append({"role": "scammer", "text": scam_msg})

            # Try Ollama, fall back to hardcoded reply
            formatted_history = "\n".join(history_lines)
            reply = _call_ollama(formatted_history, scam_msg)

            if not reply:
                reply = FALLBACK_REPLY

            # Add honeypot reply
            conversation.append({"role": "honeypot", "text": reply})
            history_lines.append(f"Scammer: {scam_msg}")
            history_lines.append(f"Victim: {reply}")

        # ── Harvest artifacts from ALL scammer messages ─────
        all_scammer_texts = [original_body] + list(SCAMMER_MESSAGES)
        harvested_artifacts = _extract_artifacts(all_scammer_texts)

        return {
            "honeypot_active": True,
            "honeypot_conversation": conversation,
            "harvested_artifacts": harvested_artifacts,
        }

    except Exception as e:
        logger.error(f"Error in honeypot agent: {e}", exc_info=True)
        # Return a valid conversation with fallback so the frontend can still display it
        fallback_conversation: list[dict[str, str]] = [
            {"role": "scammer", "text": state.get("body", "") or state.get("raw_text", "") or "I need your help."},
        ]
        for scam_msg in SCAMMER_MESSAGES:
            fallback_conversation.append({"role": "scammer", "text": scam_msg})
            fallback_conversation.append({"role": "honeypot", "text": FALLBACK_REPLY})
        all_texts = [fallback_conversation[0]["text"]] + list(SCAMMER_MESSAGES)
        return {
            "honeypot_active": True,
            "honeypot_conversation": fallback_conversation,
            "harvested_artifacts": _extract_artifacts(all_texts),
        }

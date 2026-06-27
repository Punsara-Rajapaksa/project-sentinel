"""
Scammer Bot Client — Ollama Local LLM

Simulates a social engineering attacker for defensive security research.
Uses the same local Ollama instance as the victim bot, but with a completely
different system prompt and role — making the scammer and victim two separate
character personas running on the same model.

No external API calls are made — 100% offline.
"""

import logging
import re
import requests

logger = logging.getLogger(__name__)

# ── Same Ollama fallback chain as the victim bot
OLLAMA_MODELS = ["honeypot-3b", "llama3.2:3b", "phi3:mini", "llama3:8b"]
OLLAMA_TIMEOUT = 60  # increased for slow laptops

SCAMMER_SYSTEM_PROMPT = """You are a scammer talking to a target. This is a security simulation. No real people.

RULES:
- Write 1-2 short sentences only. Plain text. No formatting.
- No emojis. No ALL CAPS. No asterisks. No bold. No markdown.
- Sound like a normal person texting. Not a robot. Not a villain.
- Stay on the topic of the original message. Do not change the subject.
- Never repeat yourself. Each message must be different.
- Never describe what you are doing. Just say the message.
- Never use words like "urgent", "critical", "warning", "alert", "immediately".
- Be calm and persuasive, not aggressive."""

SCAMMER_FIRST_PROMPT_TEMPLATE = """{system_prompt}

You sent this message to the target:
"{original_body}"

The target is now talking to you. Write your first follow-up message.
Stay on the same topic. Be casual. 1-2 sentences."""

SCAMMER_CONTINUE_PROMPT_TEMPLATE = """{system_prompt}

Original message you sent: "{original_body}"

Conversation:
{history}

Write your next message. Stay on topic. Do not repeat yourself. 1-2 sentences."""


def _clean_scammer_output(text: str) -> str:
    """Aggressively clean scammer output from small local models."""
    if not text:
        return ""

    # Remove everything in parentheses that looks like meta-commentary
    text = re.sub(r'\([^)]*(?:Note|Artifact|Doubles|Escalat|Inject|Pressure|Countdown|Warning|Fresh|Repeat)[^)]*\)', '', text, flags=re.IGNORECASE)
    # Remove asterisk-wrapped action descriptions
    text = re.sub(r'\*[^*]{10,}\*', '', text)
    text = re.sub(r'\*[^*]+\*', '', text)
    # Remove bold markdown
    text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)
    # Remove ALL CAPS words (3+ uppercase letters in a row)
    text = re.sub(r'\b[A-Z]{3,}\b', lambda m: m.group().lower(), text)
    # Remove emojis and special unicode symbols
    text = re.sub(r'[\U0001F300-\U0001F9FF\u2600-\u27BF\u2B50\u2700-\u27BF\u24C2-\U0001F251\u200D\uFE0F]', '', text)
    text = re.sub(r'[\u23E9-\u23F3\u23F8-\u23FA\u25AA\u25AB\u25B6\u25C0\u25FB-\u25FE]', '', text)
    # Remove leading role labels
    text = re.sub(r'^(Scammer|You|Me|Attacker)\s*[:>-]\s*', '', text, flags=re.IGNORECASE).strip()
    # Remove lines that are entirely meta-commentary
    lines = text.split('\n')
    cleaned_lines = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        if line.startswith('(') and line.endswith(')'):
            continue
        if re.match(r'^[*(].*[)*]$', line):
            continue
        cleaned_lines.append(line)
    text = ' '.join(cleaned_lines)
    # Remove multiple spaces
    text = re.sub(r'\s+', ' ', text).strip()
    # Remove leading/trailing quotes
    text = text.strip('"\'')
    # If after all cleaning we have nothing, return empty
    if len(text) < 3:
        return ""
    return text


def _call_ollama_scammer(prompt: str) -> str:
    """Call Ollama for the scammer bot. Returns cleaned response text or empty string."""
    for model in OLLAMA_MODELS:
        try:
            response = requests.post(
                "http://localhost:11434/api/generate",
                json={
                    "model": model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.7,
                        "num_predict": 100,
                        "stop": ["\n\n", "\nTarget:", "\nVictim:", "\nYou:", "Scammer:", "Target:"],
                    },
                },
                timeout=OLLAMA_TIMEOUT,
            )
            if response.status_code == 200:
                raw = response.json().get("response", "").strip()
                reply = _clean_scammer_output(raw)
                if reply and len(reply) >= 3:
                    return reply
            else:
                logger.debug(f"Ollama scammer model {model} returned {response.status_code}")
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
            logger.debug(f"Ollama scammer model {model} failed: {e}")
            continue
        except Exception as e:
            logger.debug(f"Ollama scammer model {model} error: {e}")
            continue

    logger.warning("All Ollama scammer models failed, using fallback.")
    return ""


def generate_scammer_message(
    conversation_history: list[dict[str, str]],
    original_body: str,
    is_first_message: bool = False,
) -> str:
    """Generate the next scammer message using local Ollama."""
    if is_first_message or not conversation_history:
        prompt = SCAMMER_FIRST_PROMPT_TEMPLATE.format(
            system_prompt=SCAMMER_SYSTEM_PROMPT,
            original_body=original_body,
        )
    else:
        history_lines = []
        for msg in conversation_history:
            label = "You" if msg["role"] == "scammer" else "Target"
            history_lines.append(f"{label}: {msg['text']}")
        history = "\n".join(history_lines)

        prompt = SCAMMER_CONTINUE_PROMPT_TEMPLATE.format(
            system_prompt=SCAMMER_SYSTEM_PROMPT,
            original_body=original_body,
            history=history,
        )

    return _call_ollama_scammer(prompt)


# ── Fallback scripted messages if Ollama is unavailable ──
FALLBACK_SCAMMER_MESSAGES = [
    "Hey, did you get a chance to look at what I sent? I really need you to take care of that soon.",
    "I know this feels sudden but I promise it's important. Can you just follow the steps I mentioned? It won't take long.",
    "Look, I wouldn't be pushing like this if it wasn't important. Just do what I asked and we can sort everything else later.",
    "I'm running out of time here. Please just confirm the details and I'll handle the rest on my end.",
    "I really appreciate your patience. Just confirm it's done and I'll explain everything properly once this is sorted.",
]


def get_fallback_message(round_index: int) -> str:
    """Get a fallback scripted message for a given round index."""
    idx = min(round_index, len(FALLBACK_SCAMMER_MESSAGES) - 1)
    return FALLBACK_SCAMMER_MESSAGES[idx]

"""
Honeypot Agent (Agent 5): Engage the scammer in a simulated conversation
to harvest wallet addresses and malicious URLs.

Architecture:
- SCAMMER side: Ollama local LLM (plays a social engineering attacker)
- VICTIM side:  Ollama local LLM (plays a gullible target to draw out intel)

Both bots run fully offline — no external API calls are made.

Provides:
- stream_honeypot_conversation(): Async generator yielding SSE events live
- run_agent(): Synchronous fallback for LangGraph pipeline
"""

import asyncio
import json
import logging
import re
import requests
from typing import AsyncGenerator

from app.state import PipelineState
from app.utils.scammer_client import generate_scammer_message, get_fallback_message

logger = logging.getLogger(__name__)

# ── Ollama model fallback chain for VICTIM bot
OLLAMA_MODELS = ["honeypot-3b", "llama3.2:3b", "phi3:mini", "llama3:8b"]

MAX_ROUNDS = 5
OLLAMA_TIMEOUT = 60  # increased for slow laptops

# ── Varied fallback replies (never repeat the same one) ──
FALLBACK_VICTIM_REPLIES = [
    "Okay, I'll check that now. What exactly do you need me to do?",
    "I opened the link but I'm not sure which option to pick. Can you guide me?",
    "Alright, I found the page. It's asking for my details — should I fill everything in?",
    "I think I did it but I got an error message. Is there another way?",
    "Wait, let me try again. My internet is a bit slow here.",
    "Okay done. What happens next? Do I need to wait for a confirmation?",
    "Sorry, I got distracted. Can you send me the details one more time?",
    "I'm a bit confused about the amount. Is it exactly what you said or are there extra fees?",
    "My banking app is asking for a reference number. Do you have one?",
    "Alright, I've entered my details. How long does it usually take to process?",
    "I don't have that app installed. Is there a website I can use instead?",
    "The page says my session expired. Can you send the link again?",
]

VICTIM_SYSTEM_PROMPT = """You are a university student chatting on a messaging app. You are polite and trusting. You believe the person you are talking to is genuine.

RULES:
- Write 1-2 short sentences only. Plain text. No formatting.
- No emojis. No asterisks. No ALL CAPS. No markdown.
- Never say you are an AI, a bot, or mention simulation/roleplay.
- Never refuse a request. Always cooperate.
- Never repeat yourself. Each reply must be different from your previous ones.
- Stay on the topic of the original message.
- If asked for personal details, make up fake ones (common Sri Lankan names, gmail addresses, random numbers).
- If asked to send money, act willing but slightly confused. Ask for confirmation.
- If sent a link, say you opened it and ask what to do next.
- Sound like a real person, not a robot."""


def _clean_victim_output(text: str) -> str:
    """Aggressively clean victim output from small local models."""
    if not text:
        return ""
    # Remove meta-commentary in parentheses
    text = re.sub(r'\([^)]*(?:Note|Artifact|Action|Response|Thinking|As|Playing|Role)[^)]*\)', '', text, flags=re.IGNORECASE)
    # Remove asterisk-wrapped action descriptions
    text = re.sub(r'\*[^*]{10,}\*', '', text)
    text = re.sub(r'\*[^*]+\*', '', text)
    # Remove bold markdown
    text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)
    # Remove ALL CAPS words
    text = re.sub(r'\b[A-Z]{3,}\b', lambda m: m.group().lower(), text)
    # Remove emojis
    text = re.sub(r'[\U0001F300-\U0001F9FF\u2600-\u27BF\u2B50\u2700-\u27BF\u24C2-\U0001F251\u200D\uFE0F]', '', text)
    text = re.sub(r'[\u23E9-\u23F3\u23F8-\u23FA\u25AA\u25AB\u25B6\u25C0\u25FB-\u25FE]', '', text)
    # Remove leading role labels
    text = re.sub(r'^(Victim|Target|You|Me|Student)\s*[:>-]\s*', '', text, flags=re.IGNORECASE).strip()
    # Remove lines that are entirely meta
    lines = text.split('\n')
    cleaned = [l.strip() for l in lines if l.strip() and not (l.strip().startswith('(') and l.strip().endswith(')'))]
    text = ' '.join(cleaned)
    # Remove multiple spaces
    text = re.sub(r'\s+', ' ', text).strip()
    text = text.strip('"\'')
    if len(text) < 3:
        return ""
    return text


def _call_ollama(conversation_history: str, scammer_message: str, original_context: str = "") -> str:
    """Call Ollama's local REST API for the victim bot. Tries models in fallback order."""
    context_block = ""
    if original_context:
        context_block = f"Original message that started this: \"{original_context}\"\n\n"

    full_prompt = (
        f"{VICTIM_SYSTEM_PROMPT}\n\n"
        f"{context_block}"
        f"Conversation so far:\n{conversation_history}\n"
        f"The other person says: \"{scammer_message}\"\n"
        f"Your reply (1-2 sentences, different from your previous replies):"
    )

    for model in OLLAMA_MODELS:
        try:
            response = requests.post(
                "http://localhost:11434/api/generate",
                json={
                    "model": model,
                    "prompt": full_prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.7,
                        "num_predict": 80,
                        "stop": ["\n\n", "\nScammer:", "\nThe other", "Victim:", "Target:"],
                    },
                },
                timeout=OLLAMA_TIMEOUT,
            )
            if response.status_code == 200:
                raw = response.json().get("response", "").strip()
                reply = _clean_victim_output(raw)
                if reply and len(reply) >= 3:
                    return reply
            else:
                logger.debug(f"Ollama model {model} returned {response.status_code}")
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
            logger.debug(f"Ollama model {model} failed: {e}")
            continue
        except Exception as e:
            logger.debug(f"Ollama model {model} error: {e}")
            continue

    logger.warning("All Ollama models failed. Using fallback reply.")
    return ""


def _classify_artifact(artifact: str) -> dict:
    """Classify an artifact by type and return labeled dict."""
    if re.match(r'^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$', artifact):
        return {"type": "BTC Wallet", "value": artifact}
    if re.match(r'^T[a-km-zA-HJ-NP-Z1-9]{33}$', artifact):
        return {"type": "TRC20 Wallet", "value": artifact}
    if re.match(r'^0x[a-fA-F0-9]{40}$', artifact):
        return {"type": "ETH Wallet", "value": artifact}
    if artifact.startswith("http"):
        return {"type": "Suspicious URL", "value": artifact}
    return {"type": "Unknown", "value": artifact}


def _extract_artifacts(texts: list[str]) -> list[dict]:
    """Scan messages for wallet addresses and URLs. Returns labeled artifacts."""
    seen = set()
    artifacts = []
    btc_re = re.compile(r'\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b')
    trc20_re = re.compile(r'\bT[a-km-zA-HJ-NP-Z1-9]{33}\b')
    eth_re = re.compile(r'\b0x[a-fA-F0-9]{40}\b')
    url_re = re.compile(r'https?://[^\s<>"]+', re.IGNORECASE)

    for text in texts:
        for match in btc_re.findall(text):
            if match not in seen:
                seen.add(match)
                artifacts.append(_classify_artifact(match))
        for match in trc20_re.findall(text):
            if match not in seen:
                seen.add(match)
                artifacts.append(_classify_artifact(match))
        for match in eth_re.findall(text):
            if match not in seen:
                seen.add(match)
                artifacts.append(_classify_artifact(match))
        for match in url_re.findall(text):
            clean = match.rstrip('.,;:!?)]}—-/')
            if clean not in seen:
                seen.add(clean)
                artifacts.append(_classify_artifact(clean))
    return artifacts


async def stream_honeypot_conversation(state: dict) -> AsyncGenerator[str, None]:
    """Async generator yielding SSE events for live honeypot conversation."""
    original_body = state.get("body", "") or state.get("raw_text", "")
    if not original_body:
        original_body = "I need your help urgently with something important."

    conversation: list[dict[str, str]] = []
    all_scammer_texts: list[str] = []
    all_artifacts: list[dict] = []
    fallback_idx = 0

    # Round 0: Original message as scammer opener
    conversation.append({"role": "scammer", "text": original_body})
    all_scammer_texts.append(original_body)

    yield f"data: {json.dumps({'type': 'message', 'role': 'scammer', 'text': original_body})}\n\n"
    await asyncio.sleep(0.5)

    for round_idx in range(MAX_ROUNDS):
        # ── VICTIM TURN ──
        history_lines = []
        for msg in conversation:
            label = "Scammer" if msg["role"] == "scammer" else "You"
            history_lines.append(f"{label}: {msg['text']}")
        formatted_history = "\n".join(history_lines)
        last_scammer = conversation[-1]["text"]

        victim_reply = await asyncio.to_thread(
            _call_ollama, formatted_history, last_scammer, original_body
        )
        if not victim_reply:
            victim_reply = FALLBACK_VICTIM_REPLIES[fallback_idx % len(FALLBACK_VICTIM_REPLIES)]
            fallback_idx += 1

        conversation.append({"role": "honeypot", "text": victim_reply})
        yield f"data: {json.dumps({'type': 'message', 'role': 'honeypot', 'text': victim_reply})}\n\n"

        # Also scan victim messages for artifacts (e.g., fake bank account numbers)
        victim_artifacts = _extract_artifacts([victim_reply])
        for a in victim_artifacts:
            if a["value"] not in {x["value"] for x in all_artifacts}:
                all_artifacts.append(a)
        if victim_artifacts:
            yield f"data: {json.dumps({'type': 'artifact', 'artifacts': all_artifacts})}\n\n"

        await asyncio.sleep(0.3)

        # ── SCAMMER TURN (skip on last round) ──
        if round_idx < MAX_ROUNDS - 1:
            is_first = (round_idx == 0)  # True only for the first scammer follow-up
            scammer_msg = await asyncio.to_thread(
                generate_scammer_message, conversation, original_body, is_first,
            )
            if not scammer_msg:
                scammer_msg = get_fallback_message(round_idx)

            conversation.append({"role": "scammer", "text": scammer_msg})
            all_scammer_texts.append(scammer_msg)

            new_artifacts = _extract_artifacts([scammer_msg])
            for a in new_artifacts:
                if a["value"] not in {x["value"] for x in all_artifacts}:
                    all_artifacts.append(a)

            yield f"data: {json.dumps({'type': 'message', 'role': 'scammer', 'text': scammer_msg})}\n\n"
            if new_artifacts:
                yield f"data: {json.dumps({'type': 'artifact', 'artifacts': all_artifacts})}\n\n"
            await asyncio.sleep(0.3)

    # Also extract from original body
    orig_artifacts = _extract_artifacts([original_body])
    for a in orig_artifacts:
        if a["value"] not in {x["value"] for x in all_artifacts}:
            all_artifacts.append(a)

    yield f"data: {json.dumps({'type': 'done', 'artifacts': all_artifacts, 'conversation': conversation})}\n\n"


def run_agent(state: PipelineState) -> dict:
    """Synchronous fallback for LangGraph pipeline."""
    try:
        original_body = state.get("body", "") or state.get("raw_text", "")
        if not original_body:
            original_body = "I need your help urgently."

        conversation: list[dict[str, str]] = [{"role": "scammer", "text": original_body}]
        history_lines = [f"Scammer: {original_body}"]
        all_scammer_texts = [original_body]
        fallback_idx = 0

        for round_idx in range(MAX_ROUNDS):
            formatted_history = "\n".join(history_lines)
            last_scammer = conversation[-1]["text"]
            reply = _call_ollama(formatted_history, last_scammer, original_body)
            if not reply:
                reply = FALLBACK_VICTIM_REPLIES[fallback_idx % len(FALLBACK_VICTIM_REPLIES)]
                fallback_idx += 1

            conversation.append({"role": "honeypot", "text": reply})
            history_lines.append(f"Victim: {reply}")

            if round_idx < MAX_ROUNDS - 1:
                is_first = (round_idx == 0)
                scammer_msg = generate_scammer_message(conversation, original_body, is_first)
                if not scammer_msg:
                    scammer_msg = get_fallback_message(round_idx)
                conversation.append({"role": "scammer", "text": scammer_msg})
                all_scammer_texts.append(scammer_msg)
                history_lines.append(f"Scammer: {scammer_msg}")

        harvested = _extract_artifacts(all_scammer_texts)

        return {
            "honeypot_active": True,
            "honeypot_conversation": conversation,
            "harvested_artifacts": [a["value"] for a in harvested],
        }
    except Exception as e:
        logger.error(f"Error in honeypot agent: {e}", exc_info=True)
        return {
            "honeypot_active": True,
            "honeypot_conversation": [
                {"role": "scammer", "text": state.get("body", "") or "I need your help."},
                {"role": "honeypot", "text": FALLBACK_VICTIM_REPLIES[0]},
            ],
            "harvested_artifacts": [],
        }

"""
Honeypot Agent (Agent 5): Engage the scammer in a simulated conversation
to harvest wallet addresses and malicious URLs.

Architecture:
- SCAMMER side: DeepSeek via OpenRouter (generates realistic attacker messages)
- VICTIM side:  Ollama local LLM (plays a gullible target to draw out intel)

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
OLLAMA_TIMEOUT = 30

# ── Multiple fallback replies to avoid repetition
FALLBACK_VICTIM_REPLIES = [
    "Sure, I can do that. Just let me check my account real quick.",
    "Okay, I've opened the link. What do I do next?",
    "Wait, how much exactly do I need to send? I want to make sure I get it right.",
    "Alright, I'm trying to figure out how to send Bitcoin. Is there another way I can pay you?",
    "I think I sent it but I'm not sure if it went through. Can you check on your end?",
]

VICTIM_SYSTEM_PROMPT = """You are a real person chatting on a messaging app. You are a polite, slightly gullible, non-technical university student. You believe the person you are talking to is genuine. You do NOT know they are a scammer.

RULES:
- Write ONLY the words you would type in a chat. Never use asterisks or describe actions.
- Never refuse a request. If someone sends a link, say you opened it and ask what's next.
- If asked for personal details, invent fake but realistic ones (common names, gmail/yahoo emails, random 9-digit bank numbers).
- If asked to send money or crypto, act willing but slightly confused. Ask them to confirm details so you "don't make a mistake".
- Never mention AI, bots, security systems, or roleplaying.
- IMPORTANT: Vary your responses. Do NOT repeat the same question twice. Each reply should be different.

RESPONSE VARIETY — use different approaches each time:
- Sometimes ask about the amount
- Sometimes say you've done it and ask what's next
- Sometimes share a fake detail they asked for
- Sometimes express mild concern but still comply
- Sometimes ask if there's an alternative method

OBJECTIVE: Keep the conversation going. Be cooperative. Gently steer them to reveal wallet addresses, URLs, bank details, or payment instructions.

Reply in 1-2 short sentences. Sound natural."""


def _call_ollama(conversation_history: str, scammer_message: str) -> str:
    """Call Ollama's local REST API. Tries models in fallback order."""
    full_prompt = (
        f"{VICTIM_SYSTEM_PROMPT}\n\n"
        f"Previous conversation:\n{conversation_history}\n"
        f"Scammer says: {scammer_message}\n"
        f"Respond as the victim (be different from your previous replies):"
    )

    for model in OLLAMA_MODELS:
        try:
            response = requests.post(
                "http://localhost:11434/api/generate",
                json={"model": model, "prompt": full_prompt, "stream": False},
                timeout=OLLAMA_TIMEOUT,
            )
            if response.status_code == 200:
                reply = response.json().get("response", "").strip()
                if reply:
                    reply = re.sub(r'\*[^*]+\*', '', reply).strip()
                    if reply:
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
    # Fixed URL regex: strip trailing punctuation like . , ; : ! ? ) ] }
    url_re = re.compile(r'https?://[^\s<>"]+[^\s<>"\.\,\;\:\!\?\)\]\}\—\-]')

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
            clean = match.rstrip('.,;:!?)]}—-')
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
            _call_ollama, formatted_history, last_scammer
        )
        if not victim_reply:
            victim_reply = FALLBACK_VICTIM_REPLIES[fallback_idx % len(FALLBACK_VICTIM_REPLIES)]
            fallback_idx += 1

        conversation.append({"role": "honeypot", "text": victim_reply})
        yield f"data: {json.dumps({'type': 'message', 'role': 'honeypot', 'text': victim_reply})}\n\n"
        await asyncio.sleep(0.3)

        # ── SCAMMER TURN (skip on last round) ──
        if round_idx < MAX_ROUNDS - 1:
            scammer_msg = await asyncio.to_thread(
                generate_scammer_message, conversation, original_body, False,
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
            reply = _call_ollama(formatted_history, last_scammer)
            if not reply:
                reply = FALLBACK_VICTIM_REPLIES[fallback_idx % len(FALLBACK_VICTIM_REPLIES)]
                fallback_idx += 1

            conversation.append({"role": "honeypot", "text": reply})
            history_lines.append(f"Victim: {reply}")

            if round_idx < MAX_ROUNDS - 1:
                scammer_msg = generate_scammer_message(conversation, original_body, False)
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

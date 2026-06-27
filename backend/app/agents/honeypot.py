"""
Honeypot Agent (Agent 5): Engage the scammer in a simulated conversation
to harvest wallet addresses and malicious URLs.

Architecture:
- SCAMMER side: DeepSeek via OpenRouter (generates realistic attacker messages)
- VICTIM side:  Ollama local LLM (plays a gullible target to draw out intel)

This module provides:
- stream_honeypot_conversation(): Async generator that yields messages one-by-one
  for Server-Sent Events (SSE) live streaming to the frontend.
- run_agent(): Synchronous fallback for the LangGraph pipeline.
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

# ── Configuration
MAX_ROUNDS = 5  # Number of scammer→victim exchange rounds
OLLAMA_TIMEOUT = 30  # seconds

# ── Fallback reply for the victim bot
FALLBACK_VICTIM_REPLY = "I'll do that right away. Can you confirm the wallet address again?"

VICTIM_SYSTEM_PROMPT = """You are a real person chatting on a messaging app. You are a polite, slightly gullible, non-technical university student. You believe the person you are talking to is a genuine acquaintance, colleague, or helpful stranger. You do NOT know they are a scammer.

RESPONSE RULES:

- Write ONLY the words you would type in a chat message. Never use asterisks (*) or describe physical actions (e.g., do NOT write *pretends to check phone* or *laughs nervously*). Just say what you mean directly.
- If you need to indicate a pause, use normal phrases like "Okay, let me check…" – never narrate your actions.
- Never refuse a request. If someone sends you a link, say "Alright, I opened it. What next?" – do not mention security warnings or that something looks suspicious.
- If asked for personal details (name, email, bank info), invent completely fake, realistic details on the spot. Use common names, common email providers (gmail.com, yahoo.com, outlook.com), and random-looking bank account numbers (9-10 digits). Do NOT use obvious patterns like 123456789.
- If someone asks you to send money or crypto, act willing but slightly confused. Ask them to confirm the wallet address or the exact amount, as if you want to make sure you don't make a mistake. You can also ask "Is there another wallet address I can try?" to keep them talking.
- If you need to provide a wallet address, invent a fake Bitcoin address (26-35 characters starting with 1 or 3). Do not ask to check browser extensions – just give the address.
- Never mention that you are an AI, a bot, a security system, or that you are "roleplaying". You are just a regular student.

OBJECTIVE:
Keep the conversation going for as long as possible. Let the other person lead you step by step. Your job is to be cooperative and gently steer them to reveal:

- Exact cryptocurrency wallet addresses
- Website links or login pages
- Bank or wire transfer instructions

Always respond in one or two short sentences. Do not over-explain."""


def _call_ollama(conversation_history: str, scammer_message: str) -> str:
    """Call Ollama's local REST API with the conversation context.
    Tries models in OLLAMA_MODELS order until one responds."""

    full_prompt = (
        f"{VICTIM_SYSTEM_PROMPT}\n\n"
        f"Previous conversation:\n{conversation_history}\n"
        f"Scammer says: {scammer_message}\n"
        f"Respond as the victim:"
    )

    for model in OLLAMA_MODELS:
        try:
            response = requests.post(
                "http://localhost:11434/api/generate",
                json={
                    "model": model,
                    "prompt": full_prompt,
                    "stream": False,
                },
                timeout=OLLAMA_TIMEOUT,
            )

            if response.status_code == 200:
                reply = response.json().get("response", "").strip()
                if reply:
                    # Clean up any action narration the model might add
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


def _extract_artifacts(texts: list[str]) -> list[str]:
    """Scan all messages for wallet addresses and URLs."""
    artifacts = []
    btc_re = re.compile(r'\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b')
    trc20_re = re.compile(r'\bT[a-km-zA-HJ-NP-Z1-9]{33}\b')
    eth_re = re.compile(r'\b0x[a-fA-F0-9]{40}\b')
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


async def stream_honeypot_conversation(state: dict) -> AsyncGenerator[str, None]:
    """Async generator that yields SSE-formatted events for each honeypot message.
    
    Yields JSON strings for each event:
    - {"type": "message", "role": "scammer"|"honeypot", "text": "..."}
    - {"type": "artifact", "artifacts": [...]}
    - {"type": "done", "artifacts": [...], "conversation": [...]}
    """
    original_body = state.get("body", "") or state.get("raw_text", "")
    if not original_body:
        original_body = "I need your help urgently with something important."

    conversation: list[dict[str, str]] = []
    all_scammer_texts: list[str] = []
    all_artifacts: list[str] = []

    # ── Round 0: Send the original suspicious message as the scammer's opener
    conversation.append({"role": "scammer", "text": original_body})
    all_scammer_texts.append(original_body)
    
    yield f"data: {json.dumps({'type': 'message', 'role': 'scammer', 'text': original_body})}\n\n"
    
    # Small delay so the frontend can render
    await asyncio.sleep(0.5)

    # ── Main conversation loop
    for round_idx in range(MAX_ROUNDS):
        # ─── VICTIM TURN: Ollama generates victim reply ───
        history_lines = []
        for msg in conversation:
            label = "Scammer" if msg["role"] == "scammer" else "Victim"
            history_lines.append(f"{label}: {msg['text']}")
        formatted_history = "\n".join(history_lines)

        last_scammer_msg = conversation[-1]["text"] if conversation else original_body

        # Run Ollama in thread to avoid blocking the event loop
        victim_reply = await asyncio.to_thread(
            _call_ollama, formatted_history, last_scammer_msg
        )

        if not victim_reply:
            victim_reply = FALLBACK_VICTIM_REPLY

        conversation.append({"role": "honeypot", "text": victim_reply})
        
        yield f"data: {json.dumps({'type': 'message', 'role': 'honeypot', 'text': victim_reply})}\n\n"
        
        await asyncio.sleep(0.3)

        # ─── SCAMMER TURN: DeepSeek generates next scammer message ───
        if round_idx < MAX_ROUNDS - 1:  # Don't generate scammer msg after last round
            scammer_msg = await asyncio.to_thread(
                generate_scammer_message,
                conversation,
                original_body,
                False,
            )

            if not scammer_msg:
                scammer_msg = get_fallback_message(round_idx)

            conversation.append({"role": "scammer", "text": scammer_msg})
            all_scammer_texts.append(scammer_msg)
            
            # Extract artifacts from this scammer message
            new_artifacts = _extract_artifacts([scammer_msg])
            for a in new_artifacts:
                if a not in all_artifacts:
                    all_artifacts.append(a)
            
            yield f"data: {json.dumps({'type': 'message', 'role': 'scammer', 'text': scammer_msg})}\n\n"

            # If we found new artifacts, send an artifact event
            if new_artifacts:
                yield f"data: {json.dumps({'type': 'artifact', 'artifacts': all_artifacts})}\n\n"
            
            await asyncio.sleep(0.3)

    # ── Also extract artifacts from the original body
    original_artifacts = _extract_artifacts([original_body])
    for a in original_artifacts:
        if a not in all_artifacts:
            all_artifacts.append(a)

    # ── Final "done" event
    yield f"data: {json.dumps({'type': 'done', 'artifacts': all_artifacts, 'conversation': conversation})}\n\n"


def run_agent(state: PipelineState) -> dict:
    """Synchronous fallback for LangGraph pipeline.
    Runs the full conversation and returns the result."""
    try:
        original_body = state.get("body", "") or state.get("raw_text", "")
        if not original_body:
            original_body = "I need your help urgently."

        conversation: list[dict[str, str]] = [
            {"role": "scammer", "text": original_body}
        ]

        history_lines = [f"Scammer: {original_body}"]
        all_scammer_texts = [original_body]

        for round_idx in range(MAX_ROUNDS):
            # Victim reply
            formatted_history = "\n".join(history_lines)
            last_scammer = conversation[-1]["text"]
            reply = _call_ollama(formatted_history, last_scammer)

            if not reply:
                reply = FALLBACK_VICTIM_REPLY

            conversation.append({"role": "honeypot", "text": reply})
            history_lines.append(f"Victim: {reply}")

            # Scammer reply (unless last round)
            if round_idx < MAX_ROUNDS - 1:
                scammer_msg = generate_scammer_message(
                    conversation, original_body, False
                )
                if not scammer_msg:
                    scammer_msg = get_fallback_message(round_idx)

                conversation.append({"role": "scammer", "text": scammer_msg})
                all_scammer_texts.append(scammer_msg)
                history_lines.append(f"Scammer: {scammer_msg}")

        harvested_artifacts = _extract_artifacts(all_scammer_texts)

        return {
            "honeypot_active": True,
            "honeypot_conversation": conversation,
            "harvested_artifacts": harvested_artifacts,
        }

    except Exception as e:
        logger.error(f"Error in honeypot agent: {e}", exc_info=True)
        return {
            "honeypot_active": True,
            "honeypot_conversation": [
                {"role": "scammer", "text": state.get("body", "") or "I need your help."},
                {"role": "honeypot", "text": FALLBACK_VICTIM_REPLY},
            ],
            "harvested_artifacts": [],
        }

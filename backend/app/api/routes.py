import asyncio
import json

from fastapi import APIRouter
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from app.graph import app_graph
from app.state import PipelineState
from app.agents.ingestion import run_ingestion
from app.agents.semantic import run_agent as semantic_agent
from app.agents.verification import run_agent as verification_agent
from app.agents.explainer import run_agent as explainer_agent
from app.agents.honeypot import run_agent as run_honeypot, stream_honeypot_conversation

router = APIRouter()


class AnalyzeRequest(BaseModel):
    message: str


class HoneypotRequest(BaseModel):
    analysis: dict


@router.post("/api/analyze")
async def analyze_message(request_data: AnalyzeRequest):
    """Run the full analysis pipeline synchronously (used for pre-fetching/caching)."""
    initial_state: PipelineState = {
        "raw_text": request_data.message,
        "user_action": None,
    }
    result_state = app_graph.invoke(initial_state)
    return JSONResponse(result_state)


@router.post("/api/analyze/stream")
async def stream_analysis(request_data: AnalyzeRequest):
    """SSE endpoint — streams agent results progressively as each completes."""

    async def generate():
        state: dict = {"raw_text": request_data.message, "user_action": None}

        # Agent 1: Ingestion (fast)
        result = await asyncio.to_thread(run_ingestion, state)
        state.update(result)
        yield f"data: {json.dumps({'agent': 1, 'label': 'Ingestion', 'data': result})}\n\n"

        # Agent 2: Semantic Risk (slow — calls DeepSeek)
        result = await asyncio.to_thread(semantic_agent, state)
        state.update(result)
        yield f"data: {json.dumps({'agent': 2, 'label': 'Semantic Risk', 'data': result})}\n\n"

        # Agent 3: Verification (fast — mock OSINT)
        result = await asyncio.to_thread(verification_agent, state)
        state.update(result)
        yield f"data: {json.dumps({'agent': 3, 'label': 'Verification', 'data': result})}\n\n"

        # Agent 4: Explainer (fast — math only)
        result = await asyncio.to_thread(explainer_agent, state)
        state.update(result)
        yield f"data: {json.dumps({'agent': 4, 'label': 'Explainer', 'data': result})}\n\n"

        # Done — send full merged state
        yield f"data: {json.dumps({'agent': 'done', 'data': state})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/api/honeypot/stream")
async def stream_honeypot(request_data: HoneypotRequest):
    """SSE endpoint — streams honeypot conversation messages live."""
    state = request_data.analysis
    return StreamingResponse(
        stream_honeypot_conversation(state),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/api/honeypot/start")
async def start_honeypot(request_data: HoneypotRequest):
    """Legacy synchronous honeypot endpoint (for tests)."""
    try:
        state = request_data.analysis
        honeypot_result = run_honeypot(state)
        merged = {**state, **honeypot_result}
        return JSONResponse(merged)
    except Exception as e:
        return JSONResponse(
            {"error": f"Honeypot failed: {str(e)}"},
            status_code=500,
        )
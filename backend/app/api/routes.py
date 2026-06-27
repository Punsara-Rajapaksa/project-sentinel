from fastapi import APIRouter
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from app.graph import app_graph
from app.state import PipelineState
from app.agents.honeypot import run_agent as run_honeypot, stream_honeypot_conversation

router = APIRouter()


class AnalyzeRequest(BaseModel):
    message: str


class HoneypotRequest(BaseModel):
    analysis: dict


@router.post("/api/analyze")
async def analyze_message(request_data: AnalyzeRequest):
    initial_state: PipelineState = {
        "raw_text": request_data.message,
        "user_action": None,
    }
    result_state = app_graph.invoke(initial_state)
    return JSONResponse(result_state)


@router.post("/api/honeypot/stream")
async def stream_honeypot(request_data: HoneypotRequest):
    """SSE endpoint — streams honeypot conversation messages one at a time.
    
    Each event is a JSON object with:
    - {"type": "message", "role": "scammer"|"honeypot", "text": "..."}
    - {"type": "artifact", "artifacts": [...]}
    - {"type": "done", "artifacts": [...], "conversation": [...]}
    """
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
    """Legacy synchronous endpoint — runs the full honeypot conversation at once.
    Kept for backward compatibility and testing."""
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
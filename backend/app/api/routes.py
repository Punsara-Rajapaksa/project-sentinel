from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from app.graph import app_graph
from app.state import PipelineState
from app.agents.honeypot import run_agent as run_honeypot

router = APIRouter()

# Define the explicit data contract for the incoming payload
class AnalyzeRequest(BaseModel):
    message: str

class HoneypotRequest(BaseModel):
    analysis: dict


@router.post("/api/analyze")
async def analyze_message(request_data: AnalyzeRequest):
    # request_data.message is automatically verified as a string here
    initial_state: PipelineState = {
        "raw_text": request_data.message,
        "user_action": None,
    }
    
    # Fire up the LangGraph processing engine
    result_state = app_graph.invoke(initial_state)
    
    return JSONResponse(result_state)


@router.post("/api/honeypot/start")
async def start_honeypot(request_data: HoneypotRequest):
    """Start the honeypot agent with the analysis state from /api/analyze."""
    try:
        state = request_data.analysis
        honeypot_result = run_honeypot(state)
        # Merge honeypot results into the state
        merged = {**state, **honeypot_result}
        return JSONResponse(merged)
    except Exception as e:
        return JSONResponse(
            {"error": f"Honeypot failed: {str(e)}"},
            status_code=500,
        )
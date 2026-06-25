from fastapi import APIRouter
from fastapi.responses import JSONResponse
from app.graph import app_graph
from app.state import PipelineState

router = APIRouter()


@router.post("/api/analyze")
async def analyze_message(request: dict):
    message = request.get("message", "")
    
    initial_state: PipelineState = {
        "raw_text": message,
        "user_action": None,
    }
    
    result_state = app_graph.invoke(initial_state)
    
    return JSONResponse(result_state)

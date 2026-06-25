from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from app.graph import app_graph
from app.state import PipelineState

router = APIRouter()

# Define the explicit data contract for the incoming payload
class AnalyzeRequest(BaseModel):
    message: str

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
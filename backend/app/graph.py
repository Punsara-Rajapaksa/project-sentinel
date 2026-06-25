from langgraph.graph import StateGraph, END
from app.state import PipelineState
from app.agents.ingestion import run_ingestion
from app.agents.semantic import run_agent as semantic_agent
from app.agents.verification import run_agent as verification_agent
from app.agents.explainer import run_agent as explainer_agent
from app.agents.honeypot import run_agent as honeypot_agent


def agent_1_ingestion(state: PipelineState) -> dict:
    return run_ingestion(state)


def agent_2_semantic(state: PipelineState) -> dict:
    return semantic_agent(state)


def agent_3_verification(state: PipelineState) -> dict:
    return verification_agent(state)


def agent_4_explain(state: PipelineState) -> dict:
    return explainer_agent(state)


def agent_5_honeypot(state: PipelineState) -> dict:
    return honeypot_agent(state)


def should_activate_honeypot(state: PipelineState) -> str:
    if state.get("user_action") == "confirm" and state.get("composite_risk_score", 0) > 0.7:
        return "agent_5_honeypot"
    return END


# Build graph
graph = StateGraph(PipelineState)

graph.add_node("agent_1_ingestion", agent_1_ingestion)
graph.add_node("agent_2_semantic", agent_2_semantic)
graph.add_node("agent_3_verification", agent_3_verification)
graph.add_node("agent_4_explain", agent_4_explain)
graph.add_node("agent_5_honeypot", agent_5_honeypot)

graph.set_entry_point("agent_1_ingestion")

graph.add_edge("agent_1_ingestion", "agent_2_semantic")
graph.add_edge("agent_2_semantic", "agent_3_verification")
graph.add_edge("agent_3_verification", "agent_4_explain")

graph.add_conditional_edges(
    "agent_4_explain",
    should_activate_honeypot,
    {
        "agent_5_honeypot": "agent_5_honeypot",
        END: END,
    }
)

app_graph = graph.compile()

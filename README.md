# Project Sentinel (formerly SudoShield)

A feedback‑driven, hybrid multi‑agent AI system that detects and defends against social engineering threats — built for **AURORA 2026 Inter‑University AI Ideathon**.

![Python](https://img.shields.io/badge/python-3.12-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688.svg)
![React](https://img.shields.io/badge/React-18-61DAFB.svg)
![LangGraph](https://img.shields.io/badge/LangGraph-0.0.66-orange.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

---

## 🧠 Project Overview

**Project Sentinel** is a stateful five‑agent AI framework that analyses incoming messages (emails, WhatsApp chats) for social engineering attacks. It combines semantic analysis with technical verification to produce plain‑English risk assessments, and can actively engage attackers via an isolated honeypot agent.

### Key Features

- **Multi‑Agent Pipeline** – Ingestion, Semantic Risk, Verification, Explainer, and Honeypot agents orchestrated with LangGraph.
- **AI‑Powered Analysis** – DeepSeek V4 Flash (via OpenRouter) for urgency / authority manipulation scoring.
- **Privacy‑by‑Design** – Local spaCy + regex anonymisation before any external API call.
- **Real‑Time Dashboard** – React (Vite + Tailwind) frontend with live demo mode.
- **Active Defence** – Local Llama 3.2 (Ollama) honeypot engages scammers to extract wallet addresses and malicious URLs.
- **Continuous Learning** – ChromaDB vector store for similarity search; infrastructure ready for user feedback loop.
- **Human‑in‑the‑Loop** – No autonomous action is taken without explicit user confirmation.

---

## 🏗️ Architecture
Ingestion Agent → Semantic Risk Agent → Verification Agent → Explainer Agent → [conditional] Honeypot Agent

- **Outer Shield** (Agents 1‑4) – Real‑time analysis of every message.
- **Inner Honeypot** (Agent 5) – Activated only on user‑confirmed high‑risk threats.

### Tech Stack

| Component | Technology |
|-----------|------------|
| Agent Orchestration | LangGraph (directed stateful graph) |
| Primary LLM | DeepSeek V4 Flash via OpenRouter API |
| Honeypot LLM | Llama 3.2 via Ollama (local) |
| Backend API | Python 3.12 + FastAPI |
| Vector Store | ChromaDB (embedded) |
| PII Scrubbing | spaCy + regex |
| Frontend | React (Vite + Tailwind CSS) |
| Testing | pytest |

## 📁 Repository Structure

---
project-sentinel/
├── backend/
│ ├── app/
│ │ ├── agents/ # Individual agent implementations
│ │ ├── api/ # FastAPI routes
│ │ ├── utils/ # Anonymiser, ChromaDB client, DeepSeek client
│ │ ├── state.py # PipelineState TypedDict
│ │ ├── graph.py # LangGraph graph definition
│ │ └── main.py # FastAPI application
│ ├── tests/ # pytest test suite
│ ├── chroma_db/ # Persistent vector store
│ ├── requirements.txt
│ └── .env.example
├── frontend/
│ ├── src/
│ │ ├── components/ # InboxSidebar, MessageView, RiskPanel, HoneypotChat
│ │ ├── api.ts # API client functions
│ │ └── App.tsx # Main dashboard
│ ├── vite.config.ts # Vite proxy config
│ └── package.json
├── report/ # Project evaluation report (PDF)
├── .gitignore
└── README.md


---

## 🚀 Getting Started

### Prerequisites

- **Python 3.12+** and `pip`
- **Node.js 18+** and `npm`
- **Ollama** (optional, for live honeypot – falls back to scripted conversation otherwise)

### 1. Clone the Repository

```bash
git clone https://github.com/four-loop/project-sentinel.git
cd project-sentinel
```

### 2. Backend Setup
cd backend

# Create and activate virtual environment
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
python -m spacy download en_core_web_sm

# Configure environment variables
cp .env.example .env   # then edit .env with your API keys

# Required environment variables (backend/.env):
# For OpenRouter (recommended)
OPENROUTER_API_KEY=sk-or-v1-your-key-here

# Or for direct DeepSeek access
DEEPSEEK_API_KEY=sk-your-key-here

### 3. Frontend Setup
cd ../frontend
npm install

### 4. (Optional) Install Ollama for Live Honeypot
Download and install Ollama, then pull the model:

```
ollama pull llama3.2:3b
```

If Ollama is not running, the honeypot will automatically use a scripted fallback conversation.

### 5. Start the Application
Terminal 1 – Backend:

```
cd backend
venv\Scripts\activate   # or source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

Terminal 2 – Frontend:
```
cd frontend
npm run dev
```

Visit http://localhost:5173 to see the dashboard.
API documentation is available at http://localhost:8000/docs.

### 🧪 Running Tests

cd backend
# Activate venv if not already active

# Windows
set PYTHONPATH=%cd% && pytest

# macOS/Linux
PYTHONPATH=. pytest

All four tests should pass:
test_health
test_analyze_phishing
test_analyze_semantic_risk
test_honeypot_endpoint

### 🎮 Demo Mode
Open the dashboard at http://localhost:5173
Click "Launch Demo" to automatically stream 15 diverse messages (emails & WhatsApp)
Watch the AI analyse each message in real time
For high‑risk messages, click "Confirm Threat" to see the honeypot engage the scammer
Observe threat intelligence (wallet addresses, malicious URLs) being harvested live

#### Project Sentinel
Protecting the human layer, one message at a time.



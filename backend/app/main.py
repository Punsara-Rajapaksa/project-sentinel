import os
import sys
import subprocess
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router as api_router

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        import spacy
        spacy.load("en_core_web_sm")
    except OSError:
        print("spaCy model not found. Downloading...")
        subprocess.run(
            [sys.executable, "-m", "spacy", "download", "en_core_web_sm"],
            check=True
        )
    yield


app = FastAPI(title="Project Sentinel API", lifespan=lifespan)

# CORS: allow all origins for demo
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/")
async def health():
    return {"status": "healthy", "project": "Project Sentinel"}
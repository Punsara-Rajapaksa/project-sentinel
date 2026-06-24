from fastapi import FastAPI

app = FastAPI(title="Project Sentinel")

@app.get("/")
async def root():
    return {"status": "running"}

@app.get("/api/")
async def api_root():
    return {"status": "running"}

@app.get("/api/health")
async def health():
    return {"status": "healthy"}
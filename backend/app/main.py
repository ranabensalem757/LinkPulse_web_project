# backend/app/main.py
from fastapi import FastAPI
app = FastAPI(title="LinkPulse API")
@app.get("/health")
def health():
    return {"status": "ok"}
# Run from backend/ while the virtual environment is active
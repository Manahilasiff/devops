"""
FastAPI backend for the AI-Based Network Intrusion Detection and Security Recommendation System.

Run from the project folder:
    python -m uvicorn main:app --app-dir backend --port 8000 --reload
"""
import io

import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

import engine
import storage

MAX_UPLOAD_MB = 100

app = FastAPI(title="Network Intrusion Detection API", version="1.0")
# Browsers allowed to call this API: the local Vite dev server and the GitHub Pages site.
ALLOWED_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173", "https://manahilasiff.github.io"]
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_methods=["*"], allow_headers=["*"])


@app.get("/api/health")
def health():
    """Backend status, whether every Phase 1 artefact loaded, and the model information card."""
    if engine.ART is None:
        return {"status": "error", "artifacts_loaded": False, "detail": engine.LOAD_ERROR}
    return {"status": "ok", "artifacts_loaded": True, "models": engine.model_info(),
            "required_features": engine.FEATURES}


@app.post("/api/analyze")
def analyze(file: UploadFile = File(...)):
    """Upload a CSV, run both models and the recommendation engine, save and return the analysis."""
    if engine.ART is None:
        raise HTTPException(500, f"Models are not available: {engine.LOAD_ERROR}")
    name = file.filename or "upload.csv"
    if not name.lower().endswith(".csv"):
        raise HTTPException(400, "Please upload a .csv file.")
    raw = file.file.read(MAX_UPLOAD_MB * 1024 * 1024 + 1)
    if len(raw) > MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(400, f"The file is larger than {MAX_UPLOAD_MB} MB.")
    if not raw.strip():
        raise HTTPException(400, "The uploaded file is empty.")
    try:
        df = pd.read_csv(io.BytesIO(raw), low_memory=False)
    except Exception as exc:  # malformed CSV
        raise HTTPException(400, f"The file could not be read as CSV ({type(exc).__name__}: {exc}).")
    try:
        result = engine.analyze(df, name)
    except engine.ValidationError as exc:
        raise HTTPException(400, str(exc))
    except Exception as exc:
        raise HTTPException(500, f"Analysis failed: {type(exc).__name__}: {exc}")
    storage.save(result)
    return result


@app.get("/api/history")
def history():
    return storage.history()


@app.get("/api/analysis/{analysis_id}")
def get_analysis(analysis_id: str):
    a = storage.load(analysis_id)
    if a is None:
        raise HTTPException(404, "Analysis not found.")
    return a

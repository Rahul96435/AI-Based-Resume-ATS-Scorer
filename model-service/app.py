"""Private inference service preserving the original ATS NLP/LLM pipeline.

Express is the public API. This process is only responsible for model inference.
"""
from contextlib import asynccontextmanager
from typing import Optional

import spacy
from fastapi import FastAPI, HTTPException
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

from backend.core.config import SENTENCE_TRANSFORMER_MODEL, SPACY_MODEL_PRIMARY
from backend.services.resume_analyzer import analyze_full_resume


class AnalysisRequest(BaseModel):
    resume_text: str
    job_description: Optional[str] = ""


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        app.state.nlp = spacy.load(SPACY_MODEL_PRIMARY)
    except OSError as exc:
        raise RuntimeError(
            f"spaCy model '{SPACY_MODEL_PRIMARY}' is missing. Run: python -m spacy download {SPACY_MODEL_PRIMARY}"
        ) from exc
    app.state.embedder = SentenceTransformer(SENTENCE_TRANSFORMER_MODEL)
    yield


app = FastAPI(title="ATS model service", lifespan=lifespan)


@app.get("/health")
def health() -> dict:
    return {"status": "healthy", "model": SENTENCE_TRANSFORMER_MODEL}


@app.post("/analyze")
def analyze(payload: AnalysisRequest) -> dict:
    if not payload.resume_text.strip():
        raise HTTPException(status_code=422, detail="No readable resume text was supplied.")
    try:
        result = analyze_full_resume(
            resume_text=payload.resume_text,
            nlp=app.state.nlp,
            embedder=app.state.embedder,
            job_description=payload.job_description or "",
        )
        return jsonable_encoder(result)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Model analysis failed: {exc}") from exc

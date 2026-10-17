# ATS Resume Scorer (PERN)

This project is a **PERN web application**: PostgreSQL stores users and analysis history, Express/Node.js provides the public API, and React provides the browser UI. The original Python NLP/LLM inference pipeline runs as a private `model-service`, so its spaCy, Sentence Transformer, and Groq behavior is preserved without keeping Streamlit or FastAPI as the public web application.

## What it does

1. Register or sign in with an email/password account.
2. Upload a PDF or DOCX resume and optionally paste a job description.
3. Receive the same product-level output as the previous app: ATS score, five score components, keyword/skill matching, skill-evidence validation, feedback, history, and downloadable PDF report.

Express extracts document text, then calls the private model service at `http://127.0.0.1:8001/analyze`. That service contains the original model pipeline: Groq/Llama extracts structured resume and JD data, spaCy supports NLP, and `all-MiniLM-L6-v2` powers semantic similarity and skill validation. The notebooks remain available for experimentation.

## Requirements

- Node.js 20+
- PostgreSQL 14+
- Python 3.10+ (model inference only)

## Configure PostgreSQL

Create a database named `ats_resume_scorer`, then create `backend/.env` from `backend/.env.example` and set `DATABASE_URL` and a strong `JWT_SECRET`:

```powershell
cd backend
Copy-Item .env.example .env
```

The API initializes its `users` and `analyses` tables when it starts. It uses PostgreSQL's `pgcrypto` extension for UUID generation.

## Run locally

In two terminals from the project root:

```bash
cd model-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m spacy download en_core_web_md
Copy-Item .env.example .env
# Add GROQ_API_KEY to model-service/.env
uvicorn app:app --host 127.0.0.1 --port 8001
```

In two further terminals:

```bash
cd backend
npm install
npm run dev
```

```bash
cd frontend
Copy-Item .env.example .env
npm install
npm run dev
```

Open the Vite URL (normally `http://localhost:5173`). The API runs on `http://localhost:4000` and exposes its health endpoint at `/api/v1/health`.

## Project structure

```
backend/                 Express API, PostgreSQL access, document parsing, authentication
frontend/                React + Vite single-page application
model-service/           Original spaCy/Sentence-Transformer/Groq ATS inference pipeline
jupyter notebooks/       Original research and data-preparation notebooks (unchanged)
```

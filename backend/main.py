"""
KrishiMitra AI - Python FastAPI Local Backend (Zero API Keys Required)
Uses PyMuPDF for PDF extraction, local FAISS + SentenceTransformers for vector search,
SQLite for relational persistence, local Ollama LLM for answers, Open-Meteo for weather,
and clearly labeled DEMONSTRATION DATA for mandi prices.
"""

import hashlib
import os
import sqlite3
import time
from pathlib import Path
from typing import List, Optional

import faiss
import fitz  # PyMuPDF
import httpx
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

DATA_DIR = Path("./data")
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = Path(os.getenv("SQLITE_DB_PATH", str(DATA_DIR / "krishimitra_fastapi.db")))
FAISS_INDEX_PATH = DATA_DIR / "krishimitra.faiss"

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")
EMBED_MODEL_NAME = os.getenv("LOCAL_EMBED_MODEL", "intfloat/multilingual-e5-small")

app = FastAPI(
    title="KrishiMitra AI Local API",
    description="Zero-credential Voice-First Multilingual Agricultural Assistant (SQLite + FAISS + Ollama + Open-Meteo)",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_embedder: Optional[SentenceTransformer] = None
_faiss_index: Optional[faiss.IndexFlatIP] = None


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            filename TEXT NOT NULL,
            publisher TEXT NOT NULL,
            crop TEXT NOT NULL,
            region TEXT NOT NULL,
            content_hash TEXT NOT NULL UNIQUE,
            status TEXT NOT NULL DEFAULT 'approved',
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS chunks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            document_id INTEGER NOT NULL,
            page_number INTEGER NOT NULL,
            content TEXT NOT NULL,
            faiss_id INTEGER NOT NULL,
            FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
        );
        """
    )
    conn.commit()
    conn.close()


init_db()


def get_embedder() -> SentenceTransformer:
    global _embedder
    if _embedder is None:
        _embedder = SentenceTransformer(EMBED_MODEL_NAME)
    return _embedder


def get_faiss_index(dim: int = 384) -> faiss.IndexFlatIP:
    global _faiss_index
    if _faiss_index is None:
        if FAISS_INDEX_PATH.exists():
            _faiss_index = faiss.read_index(str(FAISS_INDEX_PATH))
        else:
            _faiss_index = faiss.IndexFlatIP(dim)
    return _faiss_index


class ChatRequest(BaseModel):
    query: str
    language: str = "mr"
    location: str = "Pune"


def extract_pdf_pages(pdf_bytes: bytes) -> List[dict]:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages = []
    for idx, page in enumerate(doc):
        text = " ".join(page.get_text("text").split())
        if len(text) > 20:
            pages.append({"page_number": idx + 1, "text": text})
    return pages


def chunk_text(text: str, size: int = 700, overlap: int = 120) -> List[str]:
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + size, len(text))
        chunks.append(text[start:end].strip())
        if end >= len(text):
            break
        start = max(0, end - overlap)
    return chunks


@app.get("/api/health")
async def health():
    ollama_ok = False
    try:
        async with httpx.AsyncClient(timeout=1.5) as client:
            r = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            ollama_ok = r.status_code == 200
    except Exception:
        ollama_ok = False
    return {
        "status": "ok",
        "runtime": "fastapi-python",
        "database": "sqlite",
        "vector_store": "local-faiss",
        "ollama_connected": ollama_ok,
        "ollama_model": OLLAMA_MODEL,
        "api_keys_required": False,
    }


@app.post("/api/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    title: str = Form(...),
    publisher: str = Form("Agricultural Extension"),
    crop: str = Form("General"),
    region: str = Form("India"),
):
    content = await file.read()
    pages = (
        extract_pdf_pages(content)
        if (file.filename or "").lower().endswith(".pdf")
        else [{"page_number": 1, "text": content.decode("utf-8", errors="ignore")}]
    )
    if not pages:
        raise HTTPException(status_code=400, detail="No extractable text found in document.")

    doc_hash = hashlib.sha256("".join(p["text"] for p in pages).encode()).hexdigest()
    conn = get_db()
    if conn.execute("SELECT id FROM documents WHERE content_hash = ?", (doc_hash,)).fetchone():
        conn.close()
        raise HTTPException(status_code=409, detail="Duplicate document already indexed.")

    embedder = get_embedder()
    chunk_records = []
    for p in pages:
        for ch in chunk_text(p["text"]):
            chunk_records.append((p["page_number"], ch))

    vectors = embedder.encode([c[1] for c in chunk_records], normalize_embeddings=True)
    vectors = np.asarray(vectors, dtype="float32")
    index = get_faiss_index(vectors.shape[1])
    start_id = index.ntotal
    index.add(vectors)
    faiss.write_index(index, str(FAISS_INDEX_PATH))

    cur = conn.cursor()
    cur.execute(
        "INSERT INTO documents (title, filename, publisher, crop, region, content_hash, status) VALUES (?, ?, ?, ?, ?, ?, 'approved')",
        (title, file.filename, publisher, crop, region, doc_hash),
    )
    doc_id = cur.lastrowid
    for offset, (page_num, chunk_str) in enumerate(chunk_records):
        cur.execute(
            "INSERT INTO chunks (document_id, page_number, content, faiss_id) VALUES (?, ?, ?, ?)",
            (doc_id, page_num, chunk_str, start_id + offset),
        )
    conn.commit()
    conn.close()
    return {"document_id": doc_id, "chunks_indexed": len(chunk_records), "vector_store": "faiss"}


@app.get("/api/weather")
async def get_weather(lat: float = 18.5204, lon: float = 73.8567):
    url = (
        f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}"
        "&current=temperature_2m,relative_humidity_2m,wind_speed_10m"
    )
    async with httpx.AsyncClient(timeout=8.0) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.json()


@app.get("/api/mandi/prices")
def get_mandi_demo():
    return {
        "is_live": False,
        "data_label": "DEMONSTRATION DATA",
        "records": [
            {"commodity": "Cotton", "market": "Akola APMC", "modal_price": 7180, "unit": "INR/Quintal"},
            {"commodity": "Soybean", "market": "Latur APMC", "modal_price": 4590, "unit": "INR/Quintal"},
            {"commodity": "Wheat", "market": "Pune (Gultekdi)", "modal_price": 2890, "unit": "INR/Quintal"},
        ],
    }


@app.post("/api/chat")
async def chat(req: ChatRequest):
    start = time.time()
    index = get_faiss_index()
    citations = []
    if index.ntotal > 0:
        embedder = get_embedder()
        q_vec = np.asarray(embedder.encode([req.query], normalize_embeddings=True), dtype="float32")
        scores, ids = index.search(q_vec, min(4, index.ntotal))
        conn = get_db()
        for score, fid in zip(scores[0], ids[0]):
            if fid < 0 or score < 0.35:
                continue
            row = conn.execute(
                "SELECT c.page_number, c.content, d.title, d.publisher FROM chunks c JOIN documents d ON d.id = c.document_id WHERE c.faiss_id = ? AND d.status = 'approved'",
                (int(fid),),
            ).fetchone()
            if row:
                citations.append(
                    {
                        "document_title": row["title"],
                        "publisher": row["publisher"],
                        "page_number": row["page_number"],
                        "score": round(float(score), 3),
                        "passage": row["content"],
                    }
                )
        conn.close()

    if not citations:
        return {
            "decision": "refused",
            "answer": "Verified agricultural evidence is unavailable for this question. Please contact your local Krishi Vigyan Kendra (KVK) or Kisan Call Centre (1800-180-1551).",
            "citations": [],
            "latency_ms": int((time.time() - start) * 1000),
        }

    evidence_block = "\n\n".join(
        f"[{c['document_title']}, Page {c['page_number']}]: {c['passage']}" for c in citations
    )

    answer = f"Source: {citations[0]['document_title']} (Page {citations[0]['page_number']}): {citations[0]['passage'][:320]}"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{OLLAMA_BASE_URL}/api/chat",
                json={
                    "model": OLLAMA_MODEL,
                    "stream": False,
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are KrishiMitra AI. Answer concisely in the user's language using ONLY the supplied verified evidence and cite the document title and page number.",
                        },
                        {
                            "role": "user",
                            "content": f"Language: {req.language}\nQuestion: {req.query}\n\nEvidence:\n{evidence_block}",
                        },
                    ],
                },
            )
            if resp.status_code == 200:
                answer = resp.json().get("message", {}).get("content", answer)
    except Exception:
        pass

    return {
        "decision": "answered",
        "answer": answer,
        "citations": citations,
        "latency_ms": int((time.time() - start) * 1000),
    }

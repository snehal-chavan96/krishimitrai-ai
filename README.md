# KrishiMitra AI — Zero-Credential Local Agricultural Assistant

A functional, end-to-end academic prototype of a **Voice-First Multilingual Agricultural Assistant** for Indian farmers supporting **Marathi (`mr`)**, **Hindi (`hi`)**, and **English (`en`)** — designed to start and run **without any API keys, paid subscriptions, or external authentication credentials**.

## Key Features

- **Zero-Credential Startup**: Starts immediately with no `.env` secrets or external API keys.
- **Browser Voice Input & Speech Output**: Uses native browser `SpeechRecognition` (`mr-IN`, `hi-IN`, `en-IN`) for voice input with a text fallback, and browser `window.speechSynthesis` for spoken responses.
- **Local AI & RAG Pipeline**:
  - Uses local **Ollama** (`http://localhost:11434`, e.g. `qwen2.5:3b` or `llama3.2:3b`) when running locally, with a deterministic **Local Grounded Extractive RAG Synthesizer** fallback so every feature works even without Ollama running.
  - Genuine PDF extraction (`unpdf` in Node runtime, `PyMuPDF` in Python FastAPI package), SHA-256 duplicate detection, page-tracked chunking, and local multilingual vector embeddings + BM25 Reciprocal Rank Fusion over **approved** documents only.
- **SQLite + Local Vector Storage**: Relational metadata, conversations, glossary, and evaluation runs persist in SQLite (`data/krishimitra.db`), paired with local cosine vector storage (`data/local_vectors.json`, or `FAISS` in `backend/main.py`).
- **Live Open-Meteo Weather (No API Key)**: Fetches real-time weather and 5-day forecasts from Open-Meteo with localized Agromet spray advisories and timestamps.
- **Transparent Demonstration Mandi Dataset**: Commodity, State, District, and Market price lookup explicitly labeled **DEMONSTRATION DATA**.
- **Confidence Gate, Citations & Live Evaluation**: Refuses out-of-scope or unsafe pesticide dosage questions, directs farmers to their local KVK / Kisan Call Centre (`1800-180-1551`), cites exact document titles and page numbers, and includes an 8-case automated evaluation suite.

## Folder Structure

```text
├── server.ts                       # Express + Vite runtime server & REST API (Port 3000)
├── server/
│   ├── db.ts                       # SQLite schema, parameterized queries, seeded ICAR/KVK docs & glossary
│   ├── localAiClient.ts            # Local embeddings, NLU, Ollama HTTP client, & grounded RAG synthesizer
│   └── services/
│       ├── ragPipeline.ts          # PDF ingestion, chunking, local vector+BM25 RRF retrieval, confidence gate
│       ├── weatherService.ts       # Open-Meteo live weather (zero-key) & Agromet advisories
│       ├── mandiService.ts         # Clearly labeled DEMONSTRATION DATA mandi dataset
│       └── evalService.ts          # 8-case live evaluation benchmark runner
├── src/
│   ├── App.tsx                     # Responsive UI shell + Top Bar + Mobile Bottom Nav
│   ├── i18n.ts                     # Marathi, Hindi, and English UI strings
│   ├── types.ts                    # Shared TypeScript interfaces
│   └── components/                 # DashboardView, AssistantView, KnowledgeBaseView, WeatherMandiView, AdminEvalView
├── backend/                        # Optional Python FastAPI + PyMuPDF + local FAISS + SentenceTransformers backend
├── tests/run_tests.ts              # Automated unit & integration test suite
├── docs/architecture.md            # System architecture diagram
├── Dockerfile & docker-compose.yml # Local container setup (no API keys)
└── .env.example                    # Optional local settings (zero credentials)
```

## Quick Start (Zero API Keys Required)

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Start the application (port 3000)**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000`. No `.env` file or API keys are required.
3. **Optional — Enable Local Ollama Generative LLM**:
   Install [Ollama](https://ollama.com/), pull a local model, and keep Ollama running:
   ```bash
   ollama pull qwen2.5:3b
   ollama serve
   ```
   KrishiMitra AI automatically detects Ollama at `http://localhost:11434` and uses it for answer generation.
4. **Optional — Run Python FastAPI + FAISS Backend**:
   ```bash
   pip install -r backend/requirements.txt
   uvicorn backend.main:app --reload --port 8000
   ```
   Swagger API docs are served at `http://localhost:8000/docs`.
5. **Run automated tests**:
   ```bash
   npm test
   ```
6. **Run with Docker**:
   ```bash
   docker compose up --build
   ```

## Known Limitations (Academic Prototype)

- Browser `SpeechRecognition` support depends on the user's browser (supported in Chromium/Chrome/Edge; unsupported browsers automatically use the text input fallback).
- `window.speechSynthesis` Marathi/Hindi voice quality depends on the operating system's installed TTS voices.
- Mandi prices use a clearly labeled **DEMONSTRATION DATA** dataset rather than a live APMC feed.

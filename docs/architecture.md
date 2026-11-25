# KrishiMitra AI — Zero-Credential Local Architecture

```mermaid
flowchart TB
    Farmer["Farmer (Web / Mobile Browser)"] -->|"Browser SpeechRecognition (mr-IN/hi-IN/en-IN) or Text"| UI["React + TypeScript + Tailwind UI"]
    UI -->|"POST /api/chat"| NLU["Local Language Detection, Intent & Safety Classifier"]

    NLU -->|"Crop / Pest / Scheme Intent"| Hybrid["Hybrid Local Retrieval (BM25 + Local Embeddings / FAISS + RRF)"]
    Hybrid -->|"Approved Documents Only"| DB[("SQLite Database + Local Vector Index")]
    NLU -->|"Weather Intent"| Weather["Open-Meteo Free Live Weather API (No Key)"]
    NLU -->|"Mandi Intent"| Mandi["Clearly Labeled DEMONSTRATION DATA"]

    Hybrid --> Gate["Multi-Signal Confidence & Chemical Safety Gate"]
    Weather --> Gate
    Mandi --> Gate

    Gate -->|"Unsafe / Out-of-Scope / Low Evidence"| Refusal["Safe Polite Refusal -> Local KVK / KCC 1800-180-1551"]
    Gate -->|"Sufficient Verified Evidence"| Gen["Local Ollama LLM (http://localhost:11434) or Local Grounded RAG Synthesizer"]

    Gen -->|"Citations + Answer"| UI
    UI -->|"Browser window.speechSynthesis (mr-IN/hi-IN/en-IN)"| Farmer

    Admin["Admin & Agronomist Console"] -->|"PDF Upload & Approval"| Ingest["PDF Extraction (unpdf / PyMuPDF) + Chunking + Local Embeddings"]
    Ingest --> DB
    Admin -->|"Run Benchmark & Review"| Eval["8-Case Live Evaluation Suite & Feedback Loop"]
    Eval --> DB
```

## Architecture Layers (Zero API Keys Required)

1. **Browser Speech Input & Output (`src/components/AssistantView.tsx`)**: Uses native `window.SpeechRecognition` / `webkitSpeechRecognition` for Marathi, Hindi, and English voice input (with text fallback where unsupported) and native `window.speechSynthesis` for spoken replies.
2. **Local NLU & Query Understanding (`server/localAiClient.ts`)**: Detects Marathi, Hindi, and English, classifies intent, flags unsafe pesticide requests, and expands queries with the multilingual agricultural glossary.
3. **Knowledge Ingestion & Local Vector Index (`server/services/ragPipeline.ts`, `backend/main.py`)**: Extracts text per page using `unpdf` (or `PyMuPDF` in FastAPI), deduplicates via SHA-256 hash, chunks with page tracking, builds 384-d local multilingual vectors (or FAISS + `multilingual-e5-small` in Python), and persists to SQLite + `data/local_vectors.json`.
4. **Local LLM Generation (`Ollama` + Grounded Extractive Fallback)**: Routes to local Ollama (`OLLAMA_BASE_URL`, e.g. `qwen2.5:3b`) when running, and seamlessly falls back to a deterministic Local Grounded Extractive Synthesizer when Ollama is not started so the app never fails to boot or answer.
5. **External Tools**: Open-Meteo API for live weather without API keys, and clearly labeled **DEMONSTRATION DATA** for Mandi market rates.

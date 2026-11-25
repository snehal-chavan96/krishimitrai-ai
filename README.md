# 🌱 KrishiMitra AI – Voice-First Multilingual Agricultural Assistant

**An AI-powered agricultural assistant that helps Indian farmers access reliable agricultural information through voice and text in their preferred language.**

## 📌 Project Overview

KrishiMitra AI is a multilingual, voice-first agricultural assistant designed to make agricultural information accessible to Indian farmers.

Farmers can ask questions in Marathi, Hindi, or English and receive simple, understandable responses based on agricultural documents and available external data sources.

The application uses Generative AI and Retrieval-Augmented Generation (RAG) to retrieve relevant information from agricultural documents before generating responses.

It also incorporates voice interaction, weather information, mandi price demonstrations, and evidence-based refusal mechanisms to minimize misleading agricultural advice.

## 🎯 Objectives

- Provide agricultural assistance in regional Indian languages.
- Enable voice-based and text-based interaction.
- Retrieve information from agricultural documents using RAG.
- Generate understandable, context-aware AI responses.
- Display supporting sources for agricultural answers.
- Provide weather information and mandi price demonstrations.
- Prevent unsupported or potentially unsafe recommendations through confidence-based refusal.

## ✨ Key Features

### 1. Multilingual AI Assistant
- Supports Marathi, Hindi, and English.
- Accepts agricultural questions through text.
- Generates responses in the selected language.
- Provides simple and farmer-friendly explanations.

### 2. Voice Interaction
- Voice input through microphone recording.
- Speech-to-text functionality where supported.
- Spoken AI responses using text-to-speech.
- Audio playback and text fallback.

### 3. Retrieval-Augmented Generation (RAG)
- Upload agricultural PDF documents.
- Extract and process document content.
- Split documents into searchable text chunks.
- Generate embeddings and store them locally.
- Retrieve relevant information for user queries.
- Generate responses grounded in retrieved evidence.

### 4. Source-Based Responses
- Display supporting document names.
- Show relevant page references where available.
- Provide evidence-based answers.
- Avoid fabricated citations.

### 5. Weather Information
- Retrieve weather information using the Open-Meteo service.
- Display temperature, humidity, wind speed, and weather conditions.
- Provide basic weather-related agricultural information.

### 6. Mandi Price Information
- Display commodity and market information.
- Show minimum, maximum, and modal prices.
- Use clearly labelled demonstration data where live government data is unavailable.

### 7. Safety and Confidence-Based Refusal
- Check whether retrieved information supports the question.
- Avoid unsupported agricultural recommendations.
- Refuse questions when sufficient evidence is unavailable.
- Provide suggestions to consult agricultural experts or KVKs.

### 8. Admin and Evaluation Dashboard
- Upload and manage agricultural documents.
- Monitor application queries.
- View user feedback.
- Track response time and basic evaluation metrics.

## 🛠️ Technology Stack

| Component | Technology |
|---|---|
| Frontend | React.js, TypeScript |
| Styling | Tailwind CSS |
| Backend | Python, FastAPI |
| AI Model | Ollama / Locally hosted LLM |
| RAG Framework | LangChain |
| Embeddings | Local multilingual embedding model |
| Vector Storage | FAISS / ChromaDB |
| Database | SQLite |
| PDF Processing | PyMuPDF |
| Speech Input | Browser Speech Recognition |
| Speech Output | Web Speech API |
| Weather | Open-Meteo |
| Deployment | Docker (optional) |

## 🏗️ System Architecture

The application follows a modular architecture consisting of:

1. **User Interface Layer:** Accepts voice and text queries.
2. **Speech Processing Layer:** Converts speech into text and generates spoken responses.
3. **Language Processing Layer:** Handles language selection and query understanding.
4. **Knowledge Management Layer:** Extracts and indexes agricultural documents.
5. **Retrieval Layer:** Retrieves relevant information using vector similarity search.
6. **Generation Layer:** Generates answers using a locally hosted language model.
7. **Safety Layer:** Checks evidence sufficiency and handles unsupported questions.
8. **External Services Layer:** Provides weather information and mandi price demonstrations.
9. **Database Layer:** Stores application data, conversations, and document metadata.

## 📂 Project Structure

```text
KrishiMitra-AI/
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── hooks/
│   │   ├── assets/
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── backend/
│   ├── app/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── rag/
│   │   ├── models/
│   │   ├── database/
│   │   └── main.py
│   ├── requirements.txt
│   └── .env.example
│
├── data/
│   ├── agricultural_documents/
│   └── mandi_demo_data/
│
├── tests/
│
├── docker-compose.yml
├── README.md
└── .gitignore
```

*The folder structure above represents the intended organization; adjust it to match the actual generated project.*

## ⚙️ Installation and Setup

### Prerequisites

Install the following:

- Node.js and npm
- Python 3.10 or later
- Git
- Ollama (if using a locally hosted LLM)

### 1. Clone the Repository

```bash
git clone <your-github-repository-url>
cd KrishiMitra-AI
```

### 2. Backend Setup

Navigate to the backend directory:

```bash
cd backend
```

Create a virtual environment:

```bash
python -m venv venv
```

Activate it on Windows:

```bash
venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Configure environment variables using `.env.example` as a reference.

### 3. Configure Local AI Model

Install Ollama and download a compatible model.

Example:

```bash
ollama pull qwen2.5:3b
```

Start Ollama:

```bash
ollama serve
```

Use a model appropriate for your computer's available memory and processing capacity.

### 4. Start the Backend

```bash
uvicorn app.main:app --reload
```

Backend API:

```text
http://localhost:8000
```

Swagger API documentation:

```text
http://localhost:8000/docs
```

### 5. Start the Frontend

Open a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend:

```text
http://localhost:5173
```


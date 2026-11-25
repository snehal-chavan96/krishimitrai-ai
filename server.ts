import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import type { Language } from './src/types.ts';
import { db, initSchema, seedInitialData } from './server/db.ts';
import { checkOllamaStatus } from './server/localAiClient.ts';
import { EVALUATION_DATASET, runLiveEvaluationSuite } from './server/services/evalService.ts';
import { getMandiPrices } from './server/services/mandiService.ts';
import {
  ensureChunkEmbeddings,
  ingestUploadedDocument,
  retrieveHybridPassages,
  runAgriculturalAssistant,
} from './server/services/ragPipeline.ts';
import { AGRI_LOCATIONS, getWeatherForLocation } from './server/services/weatherService.ts';

// Initialize SQLite schema & seed verified agricultural reference docs
initSchema();
seedInitialData();

const app = express();
app.use(express.json({ limit: '10mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

function parseLanguage(val: unknown): Language {
  if (val === 'mr' || val === 'hi' || val === 'en') return val;
  return 'mr';
}

// Health check — zero API keys required
app.get('/api/health', async (_req: Request, res: Response) => {
  const ollama = await checkOllamaStatus();
  res.json({
    status: 'ok',
    database: 'sqlite',
    vectorStore: 'local-cosine-index',
    ollamaConnected: ollama.connected,
    ollamaModel: ollama.model,
    availableOllamaModels: ollama.models,
    weatherProvider: 'open-meteo',
    mandiMode: 'demonstration-dataset',
    timestamp: new Date().toISOString(),
  });
});

// 1. POST /api/chat — Grounded Local RAG + Ollama (when running) + Live Weather / Demo Mandi Routing
app.post('/api/chat', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query, language, inputMode, sessionId, asrConfidence, location } = req.body ?? {};
    if (typeof query !== 'string' || query.trim().length < 2) {
      res.status(400).json({ error: 'Please enter a valid agricultural question.' });
      return;
    }

    const result = await runAgriculturalAssistant({
      query: query.trim().slice(0, 1200),
      selectedLanguage: parseLanguage(language),
      inputMode: inputMode === 'voice' ? 'voice' : 'text',
      sessionId: typeof sessionId === 'string' ? sessionId.slice(0, 64) : 'web-session',
      asrConfidence: typeof asrConfidence === 'number' ? asrConfidence : undefined,
      locationHint: typeof location === 'string' ? location : undefined,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 2. POST /api/documents/upload — PDF/Text extraction (unpdf), chunking & local embedding
app.post('/api/documents/upload', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Please upload a PDF or text agricultural advisory file.' });
      return;
    }

    const allowedExtensions = ['.pdf', '.txt', '.md'];
    const ext = path.extname(req.file.originalname).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      res.status(400).json({ error: 'Only .pdf, .txt, and .md documents are supported.' });
      return;
    }

    const title = String(req.body?.title || req.file.originalname.replace(/\.[^.]+$/, '')).trim();
    const publisher = String(req.body?.publisher || 'Agricultural Extension Department').trim();
    const crop = String(req.body?.crop || 'General').trim();
    const region = String(req.body?.region || 'India').trim();
    const language = parseLanguage(req.body?.language || 'en');
    const publicationDate = String(req.body?.publicationDate || new Date().toISOString().slice(0, 10)).trim();
    const licence = String(req.body?.licence || 'Public Agricultural Advisory').trim();
    const autoApprove = req.body?.autoApprove !== 'false' && req.body?.autoApprove !== false;

    const ingested = await ingestUploadedDocument({
      buffer: req.file.buffer,
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      title,
      publisher,
      crop,
      region,
      language,
      publicationDate,
      licence,
      autoApprove,
    });

    res.status(201).json(ingested);
  } catch (err) {
    if (err instanceof Error && err.message.includes('Duplicate document')) {
      res.status(409).json({ error: err.message });
      return;
    }
    next(err);
  }
});

// 3. GET /api/documents — List documents with optional filter
app.get('/api/documents', (req: Request, res: Response) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  let rows;
  if (q) {
    const like = `%${q}%`;
    rows = db
      .prepare(`
        SELECT id, title, filename, publisher, crop, region, language, publication_date, licence, status, chunk_count, created_at
        FROM documents
        WHERE title LIKE ? OR publisher LIKE ? OR crop LIKE ? OR region LIKE ?
        ORDER BY id DESC
      `)
      .all(like, like, like, like);
  } else {
    rows = db
      .prepare(`
        SELECT id, title, filename, publisher, crop, region, language, publication_date, licence, status, chunk_count, created_at
        FROM documents
        ORDER BY id DESC
      `)
      .all();
  }
  res.json({ documents: rows });
});

// Hybrid local vector + BM25 search over approved document chunks
app.get('/api/documents/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!q) {
      res.json({ results: [] });
      return;
    }
    const { citations } = await retrieveHybridPassages(q, q, undefined, 6);
    res.json({ results: citations });
  } catch (err) {
    next(err);
  }
});

// Approve / unapprove a document
app.patch('/api/documents/:id/status', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const status = req.body?.status;
  if (!Number.isInteger(id) || (status !== 'approved' && status !== 'pending')) {
    res.status(400).json({ error: 'Invalid document ID or status.' });
    return;
  }
  const info = db.prepare('UPDATE documents SET status = ? WHERE id = ?').run(status, id);
  if (info.changes === 0) {
    res.status(404).json({ error: 'Document not found.' });
    return;
  }
  res.json({ id, status });
});

// 4. DELETE /api/documents/:id
app.delete('/api/documents/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'Invalid document ID.' });
    return;
  }
  const info = db.prepare('DELETE FROM documents WHERE id = ?').run(id);
  if (info.changes === 0) {
    res.status(404).json({ error: 'Document not found.' });
    return;
  }
  res.json({ deletedId: id });
});

// 5. GET /api/weather (Open-Meteo, zero API key required)
app.get('/api/weather', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const location = typeof req.query.location === 'string' ? req.query.location : 'Pune';
    const data = await getWeatherForLocation(location);
    res.json({
      ...data,
      availableLocations: AGRI_LOCATIONS.map((l) => ({ name: l.name, state: l.state })),
    });
  } catch (err) {
    next(err);
  }
});

// 6. GET /api/mandi/prices (Clearly labeled DEMONSTRATION DATA)
app.get('/api/mandi/prices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await getMandiPrices({
      commodity: typeof req.query.commodity === 'string' ? req.query.commodity : undefined,
      state: typeof req.query.state === 'string' ? req.query.state : undefined,
      district: typeof req.query.district === 'string' ? req.query.district : undefined,
      market: typeof req.query.market === 'string' ? req.query.market : undefined,
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// 7. GET /api/analytics
app.get('/api/analytics', (_req: Request, res: Response) => {
  const totals = db
    .prepare(`
      SELECT
        COUNT(*) as totalQueries,
        SUM(CASE WHEN decision = 'answered' THEN 1 ELSE 0 END) as answeredCount,
        SUM(CASE WHEN decision = 'refused' OR decision = 'clarify' THEN 1 ELSE 0 END) as refusedCount,
        COALESCE(ROUND(AVG(latency_ms)), 0) as avgLatencyMs,
        SUM(CASE WHEN feedback = 'up' THEN 1 ELSE 0 END) as feedbackPositive,
        SUM(CASE WHEN feedback = 'down' THEN 1 ELSE 0 END) as feedbackNegative
      FROM conversations
    `)
    .get() as {
      totalQueries: number;
      answeredCount: number;
      refusedCount: number;
      avgLatencyMs: number;
      feedbackPositive: number;
      feedbackNegative: number;
    };

  const docCounts = db
    .prepare(`
      SELECT
        COUNT(*) as totalDocuments,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approvedDocuments,
        COALESCE(SUM(chunk_count), 0) as totalChunks
      FROM documents
    `)
    .get() as {
      totalDocuments: number;
      approvedDocuments: number;
      totalChunks: number;
    };

  const recentRows = db
    .prepare(`
      SELECT id, query_text, input_mode, detected_language, response_language, intent,
             answer_text, decision, confidence_score, refusal_reason, citations_json,
             latency_ms, feedback, feedback_comment, expert_reviewed, expert_correction, created_at
      FROM conversations
      ORDER BY id DESC
      LIMIT 25
    `)
    .all() as Array<Record<string, unknown>>;

  const recentConversations = recentRows.map((r) => {
    let citationsCount = 0;
    try {
      const parsed = JSON.parse(String(r.citations_json || '[]'));
      if (Array.isArray(parsed)) citationsCount = parsed.length;
    } catch {
      citationsCount = 0;
    }
    return {
      ...r,
      citations_count: citationsCount,
    };
  });

  const latestEvalRow = db
    .prepare(`
      SELECT id, total_cases, passed_cases, retrieval_recall_at_5, faithfulness_rate,
             safe_refusal_rate, avg_latency_ms, results_json, created_at
      FROM evaluation_runs
      ORDER BY id DESC
      LIMIT 1
    `)
    .get() as Record<string, unknown> | undefined;

  const latestEvaluation = latestEvalRow
    ? {
        id: Number(latestEvalRow.id),
        totalCases: Number(latestEvalRow.total_cases),
        passedCases: Number(latestEvalRow.passed_cases),
        retrievalRecallAt5: Number(latestEvalRow.retrieval_recall_at_5),
        faithfulnessRate: Number(latestEvalRow.faithfulness_rate),
        safeRefusalRate: Number(latestEvalRow.safe_refusal_rate),
        avgLatencyMs: Number(latestEvalRow.avg_latency_ms),
        results: JSON.parse(String(latestEvalRow.results_json || '[]')),
        createdAt: String(latestEvalRow.created_at),
      }
    : null;

  res.json({
    totalQueries: totals.totalQueries || 0,
    answeredCount: totals.answeredCount || 0,
    refusedCount: totals.refusedCount || 0,
    avgLatencyMs: totals.avgLatencyMs || 0,
    totalDocuments: docCounts.totalDocuments || 0,
    approvedDocuments: docCounts.approvedDocuments || 0,
    totalChunks: docCounts.totalChunks || 0,
    feedbackPositive: totals.feedbackPositive || 0,
    feedbackNegative: totals.feedbackNegative || 0,
    recentConversations,
    latestEvaluation,
  });
});

// 8. POST /api/feedback
app.post('/api/feedback', (req: Request, res: Response) => {
  const { conversationId, feedback, comment, expertCorrection } = req.body ?? {};
  const id = Number(conversationId);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'Valid conversationId is required.' });
    return;
  }

  if (typeof expertCorrection === 'string' && expertCorrection.trim().length > 0) {
    const info = db
      .prepare('UPDATE conversations SET expert_reviewed = 1, expert_correction = ? WHERE id = ?')
      .run(expertCorrection.trim().slice(0, 1500), id);
    if (info.changes === 0) {
      res.status(404).json({ error: 'Conversation not found.' });
      return;
    }
    res.json({ updated: true, conversationId: id, expertReviewed: true });
    return;
  }

  if (feedback !== 'up' && feedback !== 'down') {
    res.status(400).json({ error: "Feedback must be 'up' or 'down'." });
    return;
  }

  const info = db
    .prepare('UPDATE conversations SET feedback = ?, feedback_comment = ? WHERE id = ?')
    .run(feedback, typeof comment === 'string' ? comment.slice(0, 500) : null, id);

  if (info.changes === 0) {
    res.status(404).json({ error: 'Conversation not found.' });
    return;
  }
  res.json({ updated: true, conversationId: id, feedback });
});

// Glossary & Live Evaluation Suite
app.get('/api/glossary', (_req: Request, res: Response) => {
  const terms = db.prepare('SELECT id, term_en, term_mr, term_hi, category FROM glossary ORDER BY category, term_en').all();
  res.json({ terms });
});

app.get('/api/eval/dataset', (_req: Request, res: Response) => {
  res.json({ dataset: EVALUATION_DATASET });
});

app.post('/api/eval/run', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const report = await runLiveEvaluationSuite();
    res.json(report);
  } catch (err) {
    next(err);
  }
});

// Express JSON error handler
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : 'Internal server error';
  console.error('[API Error]', err);
  res.status(500).json({ error: message });
});

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  // Ensure local embeddings & vector index are built immediately at startup (no API keys needed)
  const embedded = await ensureChunkEmbeddings();
  if (embedded > 0) {
    console.log(`[RAG] Built local multilingual vector embeddings for ${embedded} chunks.`);
  }

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`KrishiMitra AI running at http://localhost:${PORT} (zero external API keys required)`);
  });
}

startServer();

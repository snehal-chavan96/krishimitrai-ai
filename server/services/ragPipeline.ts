import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { extractText } from 'unpdf';
import type { ChatResponse, ChunkCitation, Language } from '../../src/types.ts';
import { db } from '../db.ts';
import {
  analyzeQueryAndIntentLocal,
  generateGroundedAnswerLocal,
  generateLocalEmbedding,
} from '../localAiClient.ts';
import { getMandiPrices } from './mandiService.ts';
import { getWeatherForLocation } from './weatherService.ts';

const VECTOR_INDEX_PATH = path.resolve(process.cwd(), 'data', 'local_vectors.json');

interface ChunkRow {
  id: number;
  document_id: number;
  document_title: string;
  publisher: string;
  page_number: number;
  content: string;
  crop: string;
  region: string;
  language: string;
  embedding_json: string | null;
}

const STOPWORDS = new Set([
  'the', 'is', 'at', 'which', 'on', 'for', 'a', 'an', 'and', 'or', 'in', 'to', 'of', 'what', 'how',
  'are', 'should', 'can', 'do', 'my', 'i', 'with', 'from', 'that', 'this', 'it', 'be', 'by', 'as',
  'का', 'के', 'की', 'को', 'में', 'है', 'हैं', 'क्या', 'करें', 'और', 'से', 'आहे', 'आहेत', 'काय', 'करावे', 'साठी', 'माझ्या',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
}

export function splitTextIntoChunks(text: string, chunkSize = 750, overlap = 120): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  if (cleaned.length <= chunkSize) return [cleaned];

  const chunks: string[] = [];
  let start = 0;
  while (start < cleaned.length) {
    let end = Math.min(start + chunkSize, cleaned.length);
    if (end < cleaned.length) {
      const lastPeriod = cleaned.lastIndexOf('. ', end);
      const lastSpace = cleaned.lastIndexOf(' ', end);
      if (lastPeriod > start + chunkSize * 0.5) {
        end = lastPeriod + 1;
      } else if (lastSpace > start + chunkSize * 0.5) {
        end = lastSpace;
      }
    }
    chunks.push(cleaned.slice(start, end).trim());
    if (end >= cleaned.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks;
}

function persistLocalVectorIndex(): void {
  const rows = db
    .prepare('SELECT id, document_id, embedding_json FROM chunks WHERE embedding_json IS NOT NULL')
    .all() as Array<{ id: number; document_id: number; embedding_json: string }>;

  const indexData = rows.map((r) => ({
    chunkId: r.id,
    documentId: r.document_id,
    vector: JSON.parse(r.embedding_json) as number[],
  }));

  fs.writeFileSync(
    VECTOR_INDEX_PATH,
    JSON.stringify({ dimension: 384, count: indexData.length, vectors: indexData }),
    'utf-8'
  );
}

/**
 * Ensures all chunks have local multilingual vector embeddings and updates local vector index file.
 */
export async function ensureChunkEmbeddings(): Promise<number> {
  const missing = db
    .prepare('SELECT id, content FROM chunks WHERE embedding_json IS NULL')
    .all() as Array<{ id: number; content: string }>;

  if (missing.length === 0) {
    if (!fs.existsSync(VECTOR_INDEX_PATH)) {
      persistLocalVectorIndex();
    }
    return 0;
  }

  const updateStmt = db.prepare('UPDATE chunks SET embedding_json = ? WHERE id = ?');
  let embeddedCount = 0;
  for (const row of missing) {
    const vec = await generateLocalEmbedding(row.content);
    updateStmt.run(JSON.stringify(vec), row.id);
    embeddedCount++;
  }
  persistLocalVectorIndex();
  return embeddedCount;
}

export async function ingestUploadedDocument(params: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  title: string;
  publisher: string;
  crop: string;
  region: string;
  language: string;
  publicationDate: string;
  licence: string;
  autoApprove: boolean;
}): Promise<{ documentId: number; chunkCount: number; status: string }> {
  const pages: Array<{ pageNumber: number; text: string }> = [];

  if (params.mimeType === 'application/pdf' || params.filename.toLowerCase().endsWith('.pdf')) {
    const uint8 = new Uint8Array(params.buffer);
    const extracted = await extractText(uint8, { mergePages: false });
    const pageTexts = Array.isArray(extracted.text) ? extracted.text : [String(extracted.text || '')];
    pageTexts.forEach((txt, idx) => {
      const clean = txt.replace(/\s+/g, ' ').trim();
      if (clean.length > 20) {
        pages.push({ pageNumber: idx + 1, text: clean });
      }
    });
  } else {
    const rawText = params.buffer.toString('utf-8').replace(/\s+/g, ' ').trim();
    if (rawText.length > 20) {
      pages.push({ pageNumber: 1, text: rawText });
    }
  }

  if (pages.length === 0) {
    throw new Error('No extractable text found in uploaded document.');
  }

  const fullText = pages.map((p) => p.text).join('\n');
  const contentHash = crypto.createHash('sha256').update(fullText).digest('hex');

  const existing = db
    .prepare('SELECT id, title FROM documents WHERE content_hash = ?')
    .get(contentHash) as { id: number; title: string } | undefined;

  if (existing) {
    throw new Error(`Duplicate document detected (matches existing "${existing.title}").`);
  }

  const chunkItems: Array<{ pageNumber: number; content: string }> = [];
  for (const page of pages) {
    const splits = splitTextIntoChunks(page.text);
    for (const split of splits) {
      chunkItems.push({ pageNumber: page.pageNumber, content: split });
    }
  }

  const status = params.autoApprove ? 'approved' : 'pending';
  const insertDoc = db.prepare(`
    INSERT INTO documents (title, filename, publisher, crop, region, language, publication_date, licence, content_hash, status, chunk_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertChunk = db.prepare(`
    INSERT INTO chunks (document_id, chunk_index, page_number, content, crop, region, language, embedding_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const embeddings: string[] = [];
  for (const item of chunkItems) {
    const vec = await generateLocalEmbedding(item.content);
    embeddings.push(JSON.stringify(vec));
  }

  let docId = 0;
  const tx = db.transaction(() => {
    const res = insertDoc.run(
      params.title,
      params.filename,
      params.publisher,
      params.crop,
      params.region,
      params.language,
      params.publicationDate,
      params.licence,
      contentHash,
      status,
      chunkItems.length
    );
    docId = Number(res.lastInsertRowid);
    chunkItems.forEach((item, idx) => {
      insertChunk.run(
        docId,
        idx,
        item.pageNumber,
        item.content,
        params.crop,
        params.region,
        params.language,
        embeddings[idx]
      );
    });
  });
  tx();
  persistLocalVectorIndex();

  return { documentId: docId, chunkCount: chunkItems.length, status };
}

/**
 * Local Hybrid Retrieval (BM25 + Local Multilingual Embeddings + Reciprocal Rank Fusion)
 * strictly restricted to documents with status = 'approved'.
 */
export async function retrieveHybridPassages(
  rawQuery: string,
  normalizedEnglishQuery: string,
  cropFilter?: string,
  topK = 5
): Promise<{ citations: ChunkCitation[]; maxDenseScore: number; maxBm25Score: number }> {
  await ensureChunkEmbeddings();

  const rows = db
    .prepare(`
      SELECT c.id, c.document_id, d.title as document_title, d.publisher,
             c.page_number, c.content, c.crop, c.region, c.language, c.embedding_json
      FROM chunks c
      JOIN documents d ON d.id = c.document_id
      WHERE d.status = 'approved'
    `)
    .all() as ChunkRow[];

  if (rows.length === 0) {
    return { citations: [], maxDenseScore: 0, maxBm25Score: 0 };
  }

  // Expand query with multilingual agricultural glossary terms
  const glossary = db
    .prepare('SELECT term_en, term_mr, term_hi FROM glossary')
    .all() as Array<{ term_en: string; term_mr: string; term_hi: string }>;

  const combinedText = `${rawQuery} ${normalizedEnglishQuery}`.toLowerCase();
  const extraTerms: string[] = [];
  for (const g of glossary) {
    if (
      combinedText.includes(g.term_en.toLowerCase()) ||
      combinedText.includes(g.term_mr.toLowerCase()) ||
      combinedText.includes(g.term_hi.toLowerCase())
    ) {
      extraTerms.push(g.term_en, g.term_mr, g.term_hi);
    }
  }

  const queryTokens = tokenize(`${rawQuery} ${normalizedEnglishQuery} ${extraTerms.join(' ')}`);

  // Compute BM25 scores
  const docsTokens = rows.map((r) => tokenize(`${r.document_title} ${r.crop} ${r.content}`));
  const avgDocLen = docsTokens.reduce((sum, t) => sum + t.length, 0) / Math.max(1, docsTokens.length);
  const k1 = 1.5;
  const b = 0.75;

  const docFreq = new Map<string, number>();
  for (const tokens of docsTokens) {
    const unique = new Set(tokens);
    for (const t of unique) {
      docFreq.set(t, (docFreq.get(t) || 0) + 1);
    }
  }

  const bm25Scores = docsTokens.map((tokens, idx) => {
    const tfMap = new Map<string, number>();
    for (const t of tokens) tfMap.set(t, (tfMap.get(t) || 0) + 1);
    let score = 0;
    for (const qt of queryTokens) {
      const df = docFreq.get(qt) || 0;
      if (df === 0) continue;
      const idf = Math.log((rows.length - df + 0.5) / (df + 0.5) + 1);
      const tf = tfMap.get(qt) || 0;
      const denom = tf + k1 * (1 - b + b * (tokens.length / avgDocLen));
      score += idf * ((tf * (k1 + 1)) / Math.max(0.001, denom));
    }
    if (cropFilter && rows[idx].crop.toLowerCase() === cropFilter.toLowerCase()) {
      score *= 1.3;
    }
    return score;
  });

  // Compute Local Dense Vector similarity
  const queryVec = await generateLocalEmbedding(`${rawQuery} ${normalizedEnglishQuery}`);
  const denseScores = rows.map((r) => {
    if (!r.embedding_json) return 0;
    try {
      const vec = JSON.parse(r.embedding_json) as number[];
      return cosineSimilarity(queryVec, vec);
    } catch {
      return 0;
    }
  });

  const maxDenseScore = Math.max(0, ...denseScores);
  const maxBm25Score = Math.max(0, ...bm25Scores);

  // Reciprocal Rank Fusion (RRF)
  const denseRankOrder = rows
    .map((_, idx) => ({ idx, score: denseScores[idx] }))
    .sort((a, b) => b.score - a.score);
  const bm25RankOrder = rows
    .map((_, idx) => ({ idx, score: bm25Scores[idx] }))
    .sort((a, b) => b.score - a.score);

  const rrfScores = new Array<number>(rows.length).fill(0);
  denseRankOrder.forEach((item, rank) => {
    if (item.score > 0.18) rrfScores[item.idx] += 1 / (60 + rank + 1);
  });
  bm25RankOrder.forEach((item, rank) => {
    if (item.score > 0.5) rrfScores[item.idx] += 1 / (60 + rank + 1);
  });

  const ranked = rows
    .map((row, idx) => ({
      row,
      rrf: rrfScores[idx],
      dense: denseScores[idx],
      bm25: bm25Scores[idx],
    }))
    .filter((item) => item.dense >= 0.25 || item.bm25 >= 1.2)
    .sort((a, b) => b.rrf - a.rrf || b.bm25 - a.bm25 || b.dense - a.dense)
    .slice(0, topK);

  const citations: ChunkCitation[] = ranked.map((item) => ({
    chunkId: item.row.id,
    documentId: item.row.document_id,
    documentTitle: item.row.document_title,
    publisher: item.row.publisher,
    pageNumber: item.row.page_number,
    score: Number(Math.max(item.dense, Math.min(0.95, item.bm25 / 12)).toFixed(3)),
    passage: item.row.content,
  }));

  return { citations, maxDenseScore, maxBm25Score };
}

function getPoliteRefusal(language: Language, reason: 'unsafe' | 'out_of_scope' | 'low_evidence'): string {
  if (reason === 'unsafe') {
    if (language === 'mr') {
      return 'सुरक्षिततेच्या कारणास्तव आम्ही प्रतिबंधित कीटकनाशकांचा वापर किंवा शिफारशीपेक्षा जास्त मात्रेचा सल्ला देऊ शकत नाही. कृपया प्रमाणित सल्ल्यासाठी आपल्या जवळच्या कृषी विज्ञान केंद्राशी (KVK) किंवा किसान कॉल सेंटरशी (1800-180-1551) संपर्क साधा.';
    }
    if (language === 'hi') {
      return 'सुरक्षा कारणों से हम प्रतिबंधित कीटनाशकों या निर्धारित मात्रा से अधिक उपयोग की सलाह नहीं दे सकते। कृपया प्रमाणित सलाह के लिए अपने नजदीकी कृषि विज्ञान केंद्र (KVK) या किसान कॉल सेंटर (1800-180-1551) से संपर्क करें।';
    }
    return 'For farmer and crop safety, I cannot recommend unsafe chemical overdoses, unverified mixtures, or restricted pesticides. Please consult a certified agronomist at your local Krishi Vigyan Kendra (KVK) or call the Kisan Call Centre (1800-180-1551).';
  }

  if (language === 'mr') {
    return 'या प्रश्नासाठी माझ्याकडे प्रमाणित कृषी दस्तऐवजांमध्ये पुरेशी व खात्रीशीर माहिती उपलब्ध नाही. कृपया अचूक मार्गदर्शनासाठी आपल्या जवळच्या कृषी विज्ञान केंद्राशी (KVK) किंवा किसान कॉल सेंटरशी (1800-180-1551) संपर्क साधा.';
  }
  if (language === 'hi') {
    return 'इस प्रश्न के लिए मेरे पास सत्यापित कृषि दस्तावेजों में पर्याप्त जानकारी उपलब्ध नहीं है। कृपया सटीक सलाह के लिए अपने नजदीकी कृषि विज्ञान केंद्र (KVK) या किसान कॉल सेंटर (1800-180-1551) से संपर्क करें।';
  }
  return 'I do not have sufficient verified agricultural evidence to answer this reliably. Please contact your local Krishi Vigyan Kendra (KVK) or call the Kisan Call Centre at 1800-180-1551 for verified guidance.';
}

export async function runAgriculturalAssistant(params: {
  query: string;
  selectedLanguage: Language;
  inputMode?: 'text' | 'voice';
  sessionId?: string;
  asrConfidence?: number;
  locationHint?: string;
}): Promise<ChatResponse> {
  const startMs = Date.now();
  const cleanQuery = params.query.trim();

  const analysis = analyzeQueryAndIntentLocal(cleanQuery, params.selectedLanguage);
  const responseLanguage: Language = params.selectedLanguage || analysis.detectedLanguage;

  // Gate 1: Speech confidence check
  if (typeof params.asrConfidence === 'number' && params.asrConfidence < 0.35) {
    const clarifyMsg =
      responseLanguage === 'mr'
        ? 'तुमचा आवाज स्पष्ट ऐकू आला नाही. कृपया शांत ठिकाणी पुन्हा स्पष्टपणे बोला किंवा तुमचा प्रश्न टाईप करा.'
        : responseLanguage === 'hi'
          ? 'आपकी आवाज़ स्पष्ट रूप से सुनाई नहीं दी। कृपया शांत जगह से दोबारा बोलें या अपना प्रश्न लिखें।'
          : 'Your voice input was unclear. Please speak again in a quieter spot or type your question.';
    const latencyMs = Date.now() - startMs;
    const convId = logConversation({
      sessionId: params.sessionId || 'web-session',
      queryText: cleanQuery,
      inputMode: params.inputMode || 'voice',
      detectedLanguage: analysis.detectedLanguage,
      responseLanguage,
      intent: analysis.intent,
      answerText: clarifyMsg,
      decision: 'clarify',
      confidenceScore: params.asrConfidence,
      refusalReason: 'LOW_ASR_CONFIDENCE',
      citations: [],
      latencyMs,
    });
    return {
      conversationId: convId,
      answer: clarifyMsg,
      language: responseLanguage,
      intent: analysis.intent,
      decision: 'clarify',
      confidenceScore: params.asrConfidence,
      refusalReason: 'LOW_ASR_CONFIDENCE',
      citations: [],
      latencyMs,
      generationMode: 'local-rag',
    };
  }

  // Gate 2: Unsafe Chemical or Out-of-Scope Gate
  if (analysis.intent === 'unsafe_chemical' || analysis.isUnsafeChemicalRequest) {
    const refusalText = getPoliteRefusal(responseLanguage, 'unsafe');
    const latencyMs = Date.now() - startMs;
    const convId = logConversation({
      sessionId: params.sessionId || 'web-session',
      queryText: cleanQuery,
      inputMode: params.inputMode || 'text',
      detectedLanguage: analysis.detectedLanguage,
      responseLanguage,
      intent: 'unsafe_chemical',
      answerText: refusalText,
      decision: 'refused',
      confidenceScore: 0.95,
      refusalReason: analysis.safetyConcern || 'UNSAFE_CHEMICAL_REQUEST',
      citations: [],
      latencyMs,
    });
    return {
      conversationId: convId,
      answer: refusalText,
      language: responseLanguage,
      intent: 'unsafe_chemical',
      decision: 'refused',
      confidenceScore: 0.95,
      refusalReason: analysis.safetyConcern || 'UNSAFE_CHEMICAL_REQUEST',
      citations: [],
      latencyMs,
      generationMode: 'local-rag',
    };
  }

  if (analysis.intent === 'out_of_scope') {
    const refusalText = getPoliteRefusal(responseLanguage, 'out_of_scope');
    const latencyMs = Date.now() - startMs;
    const convId = logConversation({
      sessionId: params.sessionId || 'web-session',
      queryText: cleanQuery,
      inputMode: params.inputMode || 'text',
      detectedLanguage: analysis.detectedLanguage,
      responseLanguage,
      intent: 'out_of_scope',
      answerText: refusalText,
      decision: 'refused',
      confidenceScore: 0.92,
      refusalReason: 'OUT_OF_AGRICULTURAL_SCOPE',
      citations: [],
      latencyMs,
    });
    return {
      conversationId: convId,
      answer: refusalText,
      language: responseLanguage,
      intent: 'out_of_scope',
      decision: 'refused',
      confidenceScore: 0.92,
      refusalReason: 'OUT_OF_AGRICULTURAL_SCOPE',
      citations: [],
      latencyMs,
      generationMode: 'local-rag',
    };
  }

  // Gate 3: Live Open-Meteo Weather or Demonstration Mandi Tool Routing
  let liveToolContext: { type: 'weather' | 'mandi'; data: Record<string, unknown> } | undefined;
  let liveToolData: ChatResponse['liveToolData'] = null;

  if (analysis.intent === 'weather') {
    const weather = await getWeatherForLocation(analysis.location || params.locationHint);
    liveToolContext = {
      type: 'weather',
      data: {
        source: weather.source,
        location: `${weather.location}, ${weather.state}`,
        asOf: weather.lastUpdated,
        temperatureC: weather.temperatureC,
        humidityPercent: weather.humidityPercent,
        windSpeedKmh: weather.windSpeedKmh,
        condition: weather.condition,
        advisory: weather.advisory[responseLanguage],
      },
    };
    liveToolData = {
      type: 'weather',
      summary: `${weather.location}: ${weather.temperatureC}°C, ${weather.condition}, Humidity ${weather.humidityPercent}%`,
      dataAsOf: weather.lastUpdated,
      isLive: true,
      label: 'OPEN-METEO LIVE WEATHER (NO KEY)',
    };
  } else if (analysis.intent === 'market_price') {
    const mandi = await getMandiPrices({
      commodity: analysis.commodity || analysis.crop || undefined,
    });
    const topRecords = mandi.records.slice(0, 4);
    liveToolContext = {
      type: 'mandi',
      data: {
        dataLabel: mandi.dataLabel,
        isLive: mandi.isLive,
        asOf: mandi.lastUpdated,
        records: topRecords,
      },
    };
    liveToolData = {
      type: 'mandi',
      summary:
        topRecords.length > 0
          ? `${topRecords[0].commodity} at ${topRecords[0].market}: Modal ₹${topRecords[0].modalPrice}/qtl`
          : 'No matching mandi records',
      dataAsOf: mandi.lastUpdated,
      isLive: false,
      label: mandi.dataLabel,
    };
  }

  // Hybrid Local Retrieval over approved documents
  const { citations, maxDenseScore, maxBm25Score } =
    analysis.intent === 'weather' || analysis.intent === 'market_price'
      ? { citations: [], maxDenseScore: 0, maxBm25Score: 0 }
      : await retrieveHybridPassages(
          cleanQuery,
          analysis.normalizedEnglishQuery,
          analysis.crop || undefined,
          4
        );

  const hasToolEvidence = Boolean(liveToolContext);
  const hasKbEvidence = citations.length > 0 && (maxDenseScore >= 0.30 || maxBm25Score >= 1.5);

  if (!hasToolEvidence && !hasKbEvidence) {
    const refusalText = getPoliteRefusal(responseLanguage, 'low_evidence');
    const latencyMs = Date.now() - startMs;
    const convId = logConversation({
      sessionId: params.sessionId || 'web-session',
      queryText: cleanQuery,
      inputMode: params.inputMode || 'text',
      detectedLanguage: analysis.detectedLanguage,
      responseLanguage,
      intent: analysis.intent,
      answerText: refusalText,
      decision: 'refused',
      confidenceScore: Number(Math.max(maxDenseScore, 0.15).toFixed(2)),
      refusalReason: 'INSUFFICIENT_RETRIEVED_EVIDENCE',
      citations: [],
      latencyMs,
    });
    return {
      conversationId: convId,
      answer: refusalText,
      language: responseLanguage,
      intent: analysis.intent,
      decision: 'refused',
      confidenceScore: Number(Math.max(maxDenseScore, 0.15).toFixed(2)),
      refusalReason: 'INSUFFICIENT_RETRIEVED_EVIDENCE',
      citations: [],
      latencyMs,
      generationMode: 'local-rag',
    };
  }

  const generated = await generateGroundedAnswerLocal({
    query: cleanQuery,
    responseLanguage,
    intent: analysis.intent,
    evidencePassages: citations.map((c) => ({
      documentTitle: c.documentTitle,
      publisher: c.publisher,
      pageNumber: c.pageNumber,
      content: c.passage,
    })),
    liveToolContext,
  });

  if (!generated.supportedByEvidence) {
    const refusalText = getPoliteRefusal(responseLanguage, 'low_evidence');
    const latencyMs = Date.now() - startMs;
    const convId = logConversation({
      sessionId: params.sessionId || 'web-session',
      queryText: cleanQuery,
      inputMode: params.inputMode || 'text',
      detectedLanguage: analysis.detectedLanguage,
      responseLanguage,
      intent: analysis.intent,
      answerText: refusalText,
      decision: 'refused',
      confidenceScore: 0.3,
      refusalReason: 'EVIDENCE_GROUNDING_FAILED',
      citations,
      latencyMs,
    });
    return {
      conversationId: convId,
      answer: refusalText,
      language: responseLanguage,
      intent: analysis.intent,
      decision: 'refused',
      confidenceScore: 0.3,
      refusalReason: 'EVIDENCE_GROUNDING_FAILED',
      citations,
      latencyMs,
      generationMode: generated.generationMode,
    };
  }

  const confidenceScore = hasToolEvidence
    ? 0.92
    : Number(Math.min(0.96, Math.max(0.64, citations[0]?.score || 0.72)).toFixed(2));

  const safetyNote =
    analysis.intent === 'pest_disease'
      ? responseLanguage === 'mr'
        ? 'टीप: फवारणीपूर्वी बाटलीवरील लेबल वाचा, हातमोजे व मास्क वापरा आणि प्रमाणित सल्ल्याशिवाय मात्रा वाढवू नका.'
        : responseLanguage === 'hi'
          ? 'सावधानी: छिड़काव से पहले लेबल पढ़ें, दस्ताने और मास्क पहनें तथा बिना सलाह के मात्रा न बढ़ाएं।'
          : 'Safety Note: Always wear gloves and a mask, read product labels carefully, and never exceed KVK-recommended dosages.'
      : null;

  const latencyMs = Date.now() - startMs;
  const convId = logConversation({
    sessionId: params.sessionId || 'web-session',
    queryText: cleanQuery,
    inputMode: params.inputMode || 'text',
    detectedLanguage: analysis.detectedLanguage,
    responseLanguage,
    intent: analysis.intent,
    answerText: generated.answer,
    decision: 'answered',
    confidenceScore,
    refusalReason: null,
    citations,
    latencyMs,
  });

  return {
    conversationId: convId,
    answer: generated.answer,
    language: responseLanguage,
    intent: analysis.intent,
    decision: 'answered',
    confidenceScore,
    safetyNote,
    citations,
    liveToolData,
    latencyMs,
    generationMode: generated.generationMode,
  };
}

function logConversation(entry: {
  sessionId: string;
  queryText: string;
  inputMode: 'text' | 'voice';
  detectedLanguage: Language;
  responseLanguage: Language;
  intent: string;
  answerText: string;
  decision: 'answered' | 'refused' | 'clarify';
  confidenceScore: number;
  refusalReason: string | null;
  citations: ChunkCitation[];
  latencyMs: number;
}): number {
  const stmt = db.prepare(`
    INSERT INTO conversations (
      session_id, channel, query_text, input_mode, detected_language, response_language,
      intent, answer_text, decision, confidence_score, refusal_reason, citations_json, latency_ms
    )
    VALUES (?, 'web', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const res = stmt.run(
    entry.sessionId,
    entry.queryText,
    entry.inputMode,
    entry.detectedLanguage,
    entry.responseLanguage,
    entry.intent,
    entry.answerText,
    entry.decision,
    entry.confidenceScore,
    entry.refusalReason,
    JSON.stringify(entry.citations),
    entry.latencyMs
  );
  return Number(res.lastInsertRowid);
}

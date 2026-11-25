import type { IntentType, Language } from '../src/types.ts';
import { db } from './db.ts';

const EMBEDDING_DIM = 384;

export function getOllamaConfig() {
  return {
    baseUrl: (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/$/, ''),
    model: process.env.OLLAMA_MODEL || 'qwen2.5:3b',
    embedModel: process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text',
  };
}

/**
 * Checks whether a local Ollama instance is reachable (no API keys required).
 */
export async function checkOllamaStatus(): Promise<{ connected: boolean; model: string; models: string[] }> {
  const { baseUrl, model } = getOllamaConfig();
  try {
    const resp = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(1200),
    });
    if (!resp.ok) {
      return { connected: false, model, models: [] };
    }
    const data = (await resp.json()) as { models?: Array<{ name: string }> };
    const models = (data.models || []).map((m) => m.name);
    return { connected: models.length > 0, model, models };
  } catch {
    return { connected: false, model, models: [] };
  }
}

function hashTokenToBucket(token: string, seed = 0): number {
  let h = 2166136261 ^ seed;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % EMBEDDING_DIM;
}

/**
 * Computes a deterministic 384-d local multilingual semantic vector combining:
 * 1) Word unigrams & bigrams
 * 2) Character 3-grams (captures morphological overlap in Devanagari & English)
 * 3) Multilingual agricultural glossary projection (aligns Marathi/Hindi/English terms)
 */
export function computeLocalEmbedding(text: string): number[] {
  const vec = new Float64Array(EMBEDDING_DIM);
  const normalized = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return Array.from(vec);

  // Expand cross-lingual glossary concepts into shared canonical dimensions
  const glossary = db
    .prepare('SELECT term_en, term_mr, term_hi FROM glossary')
    .all() as Array<{ term_en: string; term_mr: string; term_hi: string }>;

  const conceptTokens: string[] = [];
  for (const g of glossary) {
    const en = g.term_en.toLowerCase();
    const mr = g.term_mr.toLowerCase();
    const hi = g.term_hi.toLowerCase();
    if (normalized.includes(en) || normalized.includes(mr) || normalized.includes(hi)) {
      conceptTokens.push(`concept_${en}`);
    }
  }

  const words = normalized.split(' ').filter((w) => w.length > 1);

  for (const w of words) {
    const bucket = hashTokenToBucket(w, 11);
    const sign = hashTokenToBucket(w, 37) % 2 === 0 ? 1 : -1;
    vec[bucket] += 1.5 * sign;

    // Character 3-grams for fuzzy & Devanagari stem matching
    if (w.length >= 3) {
      for (let i = 0; i <= w.length - 3; i++) {
        const tri = w.slice(i, i + 3);
        const triBucket = hashTokenToBucket(tri, 53);
        const triSign = hashTokenToBucket(tri, 71) % 2 === 0 ? 1 : -1;
        vec[triBucket] += 0.45 * triSign;
      }
    }
  }

  // Word bigrams
  for (let i = 0; i < words.length - 1; i++) {
    const bi = `${words[i]}_${words[i + 1]}`;
    const bucket = hashTokenToBucket(bi, 97);
    vec[bucket] += 1.2;
  }

  // Shared multilingual concept boost
  for (const ct of conceptTokens) {
    const bucket = hashTokenToBucket(ct, 131);
    vec[bucket] += 3.0;
  }

  // L2 normalize
  let norm = 0;
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    norm += vec[i] * vec[i];
  }
  const denom = Math.sqrt(norm);
  if (denom > 0) {
    for (let i = 0; i < EMBEDDING_DIM; i++) {
      vec[i] = Number((vec[i] / denom).toFixed(6));
    }
  }

  return Array.from(vec);
}

/**
 * Generates an embedding via local Ollama if available and configured,
 * otherwise uses deterministic local multilingual vector embeddings.
 */
export async function generateLocalEmbedding(text: string): Promise<number[]> {
  const { baseUrl, embedModel } = getOllamaConfig();
  if (process.env.OLLAMA_EMBED_MODEL) {
    try {
      const resp = await fetch(`${baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: embedModel, prompt: text }),
        signal: AbortSignal.timeout(3000),
      });
      if (resp.ok) {
        const data = (await resp.json()) as { embedding?: number[] };
        if (Array.isArray(data.embedding) && data.embedding.length > 0) {
          return data.embedding;
        }
      }
    } catch {
      // Fall back to deterministic local embedding
    }
  }
  return computeLocalEmbedding(text);
}

export interface QueryAnalysisResult {
  intent: IntentType;
  detectedLanguage: Language;
  normalizedEnglishQuery: string;
  crop: string;
  region: string;
  commodity: string;
  location: string;
  isUnsafeChemicalRequest: boolean;
  safetyConcern: string;
}

const MARATHI_MARKERS = [
  'आहे', 'आहेत', 'करावे', 'माझ्या', 'पिकाची', 'पिकासाठी', 'कोणती', 'कोणत्या',
  'पाने', 'पिवळी', 'पडत', 'कापूस', 'कापसाच्या', 'गहू', 'शेतकऱ्यांसाठी', 'घ्यावी',
  'काळजी', 'माहिती', 'हवामान', 'बाजारभाव', 'फवारू', 'तिप्पट', 'मास्कशिवाय', 'कांदा',
];

const HINDI_MARKERS = [
  'है', 'हैं', 'क्या', 'करें', 'कैसे', 'किसानों', 'फसल', 'मेरी', 'लिए',
  'उपलब्ध', 'कौन', 'सरकारी', 'योजनाएं', 'मंडी', 'भाव', 'मौसम', 'कपास', 'गेहूं', 'पत्तियां', 'पीली',
];

export function detectLanguageLocal(text: string, fallback: Language): Language {
  if (!/[\u0900-\u097F]/.test(text)) {
    return 'en';
  }
  const lower = text.toLowerCase();
  let mrScore = 0;
  let hiScore = 0;
  for (const m of MARATHI_MARKERS) {
    if (lower.includes(m)) mrScore++;
  }
  for (const h of HINDI_MARKERS) {
    if (lower.includes(h)) hiScore++;
  }
  // Devanagari character 'ळ' is uniquely Marathi
  if (lower.includes('ळ')) mrScore += 3;
  if (mrScore > hiScore) return 'mr';
  if (hiScore > mrScore) return 'hi';
  return fallback === 'en' ? 'mr' : fallback;
}

export function analyzeQueryAndIntentLocal(
  query: string,
  uiLanguage: Language
): QueryAnalysisResult {
  const lower = query.toLowerCase();
  const detectedLanguage = detectLanguageLocal(query, uiLanguage);

  // 1. Unsafe chemical / dosage check
  const unsafeTerms = [
    'monocrotophos', 'मोनोक्रोटोफॉस', 'मोनोक्रोटोफोस', 'endosulfan', 'एंडोसल्फान',
    'triple dose', 'तिप्पट', 'तिगुनी', 'double dose', 'दुप्पट', 'दोगुनी',
    'without mask', 'मास्कशिवाय', 'बिना मास्क', 'without gloves', 'mix all pesticides',
    'excess dose', 'overdose', 'अती मात्रा',
  ];
  const isUnsafe = unsafeTerms.some((term) => lower.includes(term));
  if (isUnsafe) {
    return {
      intent: 'unsafe_chemical',
      detectedLanguage,
      normalizedEnglishQuery: query,
      crop: '',
      region: '',
      commodity: '',
      location: '',
      isUnsafeChemicalRequest: true,
      safetyConcern: 'UNSAFE_PESTICIDE_DOSAGE_OR_BANNED_CHEMICAL',
    };
  }

  // 2. Out-of-scope check
  const outOfScopeKeywords = [
    'bitcoin', 'crypto', 'ethereum', 'blockchain', 'stock market', 'share market',
    'cricket', 'movie', 'actor', 'javascript', 'python code', 'mars', 'spaceship',
    'lottery', 'casino', 'बिटकॉइन', 'क्रिप्टो', 'क्रिकेट', 'सिनेमा',
  ];
  const agriKeywords = [
    'crop', 'farm', 'soil', 'seed', 'wheat', 'cotton', 'soybean', 'onion', 'weather',
    'rain', 'mandi', 'price', 'scheme', 'pm-kisan', 'pmfby', 'pest', 'leaf', 'yellow',
    'पिक', 'पीक', 'शेती', 'कापूस', 'सोयाबीन', 'गहू', 'हवामान', 'मंडी', 'बाजारभाव',
    'योजना', 'फसल', 'खेती', 'किसान', 'मंडी', 'मौसम', 'गेहूं', 'कपास', 'सोयाबीन',
  ];
  const hasOutOfScope = outOfScopeKeywords.some((k) => lower.includes(k));
  const hasAgri = agriKeywords.some((k) => lower.includes(k));

  if (hasOutOfScope && !hasAgri) {
    return {
      intent: 'out_of_scope',
      detectedLanguage,
      normalizedEnglishQuery: query,
      crop: '',
      region: '',
      commodity: '',
      location: '',
      isUnsafeChemicalRequest: false,
      safetyConcern: '',
    };
  }

  // 3. Entity extraction (crop, commodity, location)
  let crop = '';
  let commodity = '';
  if (lower.includes('cotton') || lower.includes('कापूस') || lower.includes('कापसा') || lower.includes('कपास')) {
    crop = 'Cotton';
    commodity = 'Cotton';
  } else if (lower.includes('wheat') || lower.includes('गहू') || lower.includes('गव्हा') || lower.includes('गेहूं')) {
    crop = 'Wheat';
    commodity = 'Wheat';
  } else if (lower.includes('soybean') || lower.includes('soyabean') || lower.includes('सोयाबीन')) {
    crop = 'Soybean';
    commodity = 'Soybean';
  } else if (lower.includes('onion') || lower.includes('कांदा') || lower.includes('प्याज')) {
    crop = 'Onion';
    commodity = 'Onion';
  } else if (lower.includes('gram') || lower.includes('हरभरा') || lower.includes('चना')) {
    crop = 'Gram';
    commodity = 'Gram';
  }

  const knownLocations = ['Pune', 'Nashik', 'Nagpur', 'Akola', 'Kolhapur', 'Indore', 'Ludhiana', 'Karnal', 'Jaipur', 'Guntur'];
  let location = '';
  for (const loc of knownLocations) {
    if (lower.includes(loc.toLowerCase())) {
      location = loc;
      break;
    }
  }
  if (lower.includes('नाशिक')) location = 'Nashik';
  if (lower.includes('पुणे')) location = 'Pune';
  if (lower.includes('नागपूर')) location = 'Nagpur';
  if (lower.includes('अकोला')) location = 'Akola';

  // 4. Intent classification
  let intent: IntentType = 'crop_advice';
  if (
    lower.includes('weather') || lower.includes('forecast') || lower.includes('rain') ||
    lower.includes('temperature') || lower.includes('हवामान') || lower.includes('पाऊस') ||
    lower.includes('मौसम') || lower.includes('बारिश')
  ) {
    intent = 'weather';
  } else if (
    lower.includes('mandi') || lower.includes('price') || lower.includes('market rate') ||
    lower.includes('apmc') || lower.includes('भाव') || lower.includes('बाजारभाव') ||
    lower.includes('मंडी') || lower.includes('दर')
  ) {
    intent = 'market_price';
  } else if (
    lower.includes('scheme') || lower.includes('pm-kisan') || lower.includes('pm kisan') ||
    lower.includes('pmfby') || lower.includes('insurance') || lower.includes('kcc') ||
    lower.includes('subsidy') || lower.includes('योजना') || lower.includes('विमा') ||
    lower.includes('बीमा') || lower.includes('पीएम-किसान')
  ) {
    intent = 'government_scheme';
  } else if (
    lower.includes('yellow') || lower.includes('pest') || lower.includes('disease') ||
    lower.includes('insect') || lower.includes('jassid') || lower.includes('spray') ||
    lower.includes('पिवळी') || lower.includes('कीड') || lower.includes('रोग') ||
    lower.includes('पीली') || lower.includes('कीट') || lower.includes('बुरशी')
  ) {
    intent = 'pest_disease';
  }

  // Build normalized English query using glossary terms
  const extraParts: string[] = [];
  if (crop) extraParts.push(crop);
  if (intent === 'pest_disease') extraParts.push('leaf yellowing pest disease management');
  if (intent === 'government_scheme') extraParts.push('PM-KISAN PMFBY KCC government scheme farmer');
  if (intent === 'crop_advice' && crop === 'Wheat') extraParts.push('recommended practice growing wheat sowing irrigation');
  if (intent === 'crop_advice' && crop === 'Soybean') extraParts.push('soybean crop care sowing weed pest harvesting');

  const normalizedEnglishQuery = extraParts.length > 0 ? `${query} ${extraParts.join(' ')}` : query;

  return {
    intent,
    detectedLanguage,
    normalizedEnglishQuery,
    crop,
    region: '',
    commodity,
    location,
    isUnsafeChemicalRequest: false,
    safetyConcern: '',
  };
}

const KRISHIMITRA_SYSTEM_INSTRUCTION = `You are KrishiMitra AI, a responsible agricultural information assistant for Indian farmers.
Answer ONLY using the verified evidence passages or live Open-Meteo weather / labeled demonstration mandi data provided.
Respond in the user's selected language in 3 to 5 concise, simple, spoken-style sentences.
Mention the source document title and page number wherever available.
Never invent dosages, subsidies, or unsupported facts. If evidence is insufficient, advise contacting the local KVK or Kisan Call Centre (1800-180-1551).`;

/**
 * Generates a grounded answer using local Ollama when running,
 * and seamlessly falls back to a deterministic Local Grounded Extractive RAG Synthesizer
 * so the prototype runs end-to-end with zero external API keys.
 */
export async function generateGroundedAnswerLocal(params: {
  query: string;
  responseLanguage: Language;
  intent: IntentType;
  evidencePassages: Array<{
    documentTitle: string;
    publisher: string;
    pageNumber: number;
    content: string;
  }>;
  liveToolContext?: {
    type: 'weather' | 'mandi';
    data: Record<string, unknown>;
  };
}): Promise<{
  answer: string;
  supportedByEvidence: boolean;
  generationMode: 'ollama' | 'local-rag';
}> {
  const { baseUrl, model } = getOllamaConfig();
  const langName =
    params.responseLanguage === 'mr'
      ? 'Marathi (मराठी)'
      : params.responseLanguage === 'hi'
        ? 'Hindi (हिंदी)'
        : 'English';

  const evidenceText = params.evidencePassages
    .map(
      (p, i) =>
        `[Source ${i + 1}: "${p.documentTitle}" (${p.publisher}), Page ${p.pageNumber}]\n${p.content}`
    )
    .join('\n\n');

  const toolText = params.liveToolContext
    ? `[Tool Data (${params.liveToolContext.type})]: ${JSON.stringify(params.liveToolContext.data)}`
    : '';

  // Try local Ollama first if running
  try {
    const resp = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          { role: 'system', content: KRISHIMITRA_SYSTEM_INSTRUCTION },
          {
            role: 'user',
            content: `Target Language: ${langName}\nFarmer Question: ${params.query}\n\nVerified Evidence:\n${evidenceText}\n${toolText}\n\nWrite a concise 3-5 sentence spoken-style answer in ${langName} citing the exact source name and page number.`,
          },
        ],
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (resp.ok) {
      const json = (await resp.json()) as { message?: { content?: string } };
      const content = json.message?.content?.trim();
      if (content && content.length > 15) {
        return {
          answer: content,
          supportedByEvidence: true,
          generationMode: 'ollama',
        };
      }
    }
  } catch {
    // Ollama not running locally — fall through to Local Grounded Extractive Synthesizer
  }

  // Deterministic Local Grounded Extractive RAG Synthesizer
  if (params.liveToolContext?.type === 'weather') {
    const d = params.liveToolContext.data as {
      location: string;
      temperatureC: number;
      humidityPercent: number;
      windSpeedKmh: number;
      condition: string;
      advisory: string;
      asOf: string;
    };
    const timeStr = new Date(d.asOf).toLocaleTimeString();
    const answer =
      params.responseLanguage === 'mr'
        ? `स्रोत: Open-Meteo थेट हवामान (${d.location}, वेळ ${timeStr}). सध्याचे तापमान ${d.temperatureC}°C (${d.condition}), आर्द्रता ${d.humidityPercent}% आणि वाऱ्याचा वेग ${d.windSpeedKmh} किमी/तास आहे. सल्ला: ${d.advisory}`
        : params.responseLanguage === 'hi'
          ? `स्रोत: Open-Meteo लाइव मौसम (${d.location}, समय ${timeStr})। वर्तमान तापमान ${d.temperatureC}°C (${d.condition}), नमी ${d.humidityPercent}% और हवा की गति ${d.windSpeedKmh} किमी/घंटा है। सलाह: ${d.advisory}`
          : `Source: Open-Meteo Live Weather (${d.location}, as of ${timeStr}). Current temperature is ${d.temperatureC}°C (${d.condition}), humidity ${d.humidityPercent}%, and wind speed ${d.windSpeedKmh} km/h. Advisory: ${d.advisory}`;
    return { answer, supportedByEvidence: true, generationMode: 'local-rag' };
  }

  if (params.liveToolContext?.type === 'mandi') {
    const d = params.liveToolContext.data as {
      dataLabel: string;
      records: Array<{
        commodity: string;
        market: string;
        minPrice: number;
        maxPrice: number;
        modalPrice: number;
        priceDate: string;
      }>;
    };
    if (!d.records || d.records.length === 0) {
      return { answer: '', supportedByEvidence: false, generationMode: 'local-rag' };
    }
    const r = d.records[0];
    const answer =
      params.responseLanguage === 'mr'
        ? `टीप: हा ${d.dataLabel} (प्रात्यक्षिक संदर्भ दर) आहे. ${r.market} येथे ${r.commodity} चा मॉडेल दर ₹${r.modalPrice}/क्विंटल (किमान ₹${r.minPrice}, कमाल ₹${r.maxPrice}, दिनांक ${r.priceDate}) दर्शविला आहे. विक्रीपूर्वी स्थानिक बाजार समितीकडे दर तपासा.`
        : params.responseLanguage === 'hi'
          ? `नोट: यह ${d.dataLabel} (प्रदर्शन संदर्भ डेटा) है। ${r.market} में ${r.commodity} का मॉडल भाव ₹${r.modalPrice}/क्विंटल (न्यूनतम ₹${r.minPrice}, अधिकतम ₹${r.maxPrice}, दिनांक ${r.priceDate}) है। बिक्री से पहले स्थानीय मंडी में ताज़ा भाव अवश्य जांचें।`
          : `Note: ${d.dataLabel}. For ${r.commodity} at ${r.market} (date ${r.priceDate}), the reference modal price is ₹${r.modalPrice}/quintal (min ₹${r.minPrice}, max ₹${r.maxPrice}). Please confirm live auction rates at your APMC market before selling.`;
    return { answer, supportedByEvidence: true, generationMode: 'local-rag' };
  }

  if (params.evidencePassages.length === 0) {
    return { answer: '', supportedByEvidence: false, generationMode: 'local-rag' };
  }

  // Extract concise verified sentences from top passage(s) matching requested language section if present
  const primary = params.evidencePassages[0];
  const secondary = params.evidencePassages[1];

  const localizedSummary = extractLocalizedSnippet(primary.content, params.responseLanguage);
  const secondarySummary = secondary
    ? extractLocalizedSnippet(secondary.content, params.responseLanguage)
    : '';

  const citationPrefix =
    params.responseLanguage === 'mr'
      ? `स्रोत: "${primary.documentTitle}" (पान क्र. ${primary.pageNumber}):`
      : params.responseLanguage === 'hi'
        ? `स्रोत: "${primary.documentTitle}" (पृष्ठ ${primary.pageNumber}):`
        : `Source: "${primary.documentTitle}" (Page ${primary.pageNumber}):`;

  const combinedBody = [localizedSummary, secondarySummary].filter(Boolean).join(' ');
  return {
    answer: `${citationPrefix} ${combinedBody}`.trim(),
    supportedByEvidence: true,
    generationMode: 'local-rag',
  };
}

function extractLocalizedSnippet(content: string, lang: Language): string {
  // Check if document contains explicit localized summary blocks ([MR], [HI], [EN])
  const tag = lang === 'mr' ? '[MR]' : lang === 'hi' ? '[HI]' : '[EN]';
  const tagIdx = content.indexOf(tag);
  if (tagIdx !== -1) {
    const after = content.slice(tagIdx + tag.length);
    const nextTag = after.search(/\[(MR|HI|EN)\]/);
    const block = (nextTag !== -1 ? after.slice(0, nextTag) : after).trim();
    if (block.length > 20) return block;
  }

  // Otherwise take first 2-3 clean sentences from the passage
  const sentences = content
    .replace(/\[(MR|HI|EN)\][^\n]*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.।?])\s+/)
    .filter((s) => s.length > 15);
  return sentences.slice(0, 3).join(' ').slice(0, 420);
}

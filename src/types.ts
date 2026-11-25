export type Language = 'mr' | 'hi' | 'en';

export type IntentType =
  | 'crop_advice'
  | 'pest_disease'
  | 'government_scheme'
  | 'market_price'
  | 'weather'
  | 'unsafe_chemical'
  | 'out_of_scope';

export interface DocumentRecord {
  id: number;
  title: string;
  filename: string;
  publisher: string;
  crop: string;
  region: string;
  language: string;
  publication_date: string;
  licence: string;
  status: 'approved' | 'pending' | 'failed';
  chunk_count: number;
  created_at: string;
}

export interface ChunkCitation {
  chunkId: number;
  documentId: number;
  documentTitle: string;
  publisher: string;
  pageNumber: number;
  score: number;
  passage: string;
}

export interface ChatResponse {
  conversationId: number;
  answer: string;
  language: Language;
  intent: IntentType;
  decision: 'answered' | 'refused' | 'clarify';
  confidenceScore: number;
  refusalReason?: string | null;
  safetyNote?: string | null;
  citations: ChunkCitation[];
  liveToolData?: {
    type: 'weather' | 'mandi';
    summary: string;
    dataAsOf: string;
    isLive: boolean;
    label: string;
  } | null;
  latencyMs: number;
  generationMode?: 'ollama' | 'local-rag';
}

export interface WeatherForecastDay {
  date: string;
  tempMax: number;
  tempMin: number;
  rainProb: number;
  weatherCode: number;
  condition: string;
}

export interface WeatherResponse {
  location: string;
  state: string;
  latitude: number;
  longitude: number;
  temperatureC: number;
  humidityPercent: number;
  windSpeedKmh: number;
  condition: string;
  weatherCode: number;
  precipitationMm: number;
  forecast: WeatherForecastDay[];
  advisory: {
    en: string;
    hi: string;
    mr: string;
  };
  lastUpdated: string;
  source: string;
}

export interface MandiRecord {
  commodity: string;
  state: string;
  district: string;
  market: string;
  minPrice: number;
  maxPrice: number;
  modalPrice: number;
  unit: string;
  priceDate: string;
}

export interface MandiResponse {
  records: MandiRecord[];
  isLive: boolean;
  dataLabel: 'LIVE AGMARKNET DATA' | 'DEMONSTRATION DATA';
  notice: string;
  lastUpdated: string;
  availableFilters: {
    commodities: string[];
    states: string[];
    districts: string[];
    markets: string[];
  };
}

export interface ConversationLog {
  id: number;
  query_text: string;
  input_mode: 'text' | 'voice';
  detected_language: Language;
  response_language: Language;
  intent: string;
  answer_text: string;
  decision: 'answered' | 'refused' | 'clarify';
  confidence_score: number;
  refusal_reason: string | null;
  citations_count: number;
  latency_ms: number;
  feedback: 'up' | 'down' | null;
  feedback_comment: string | null;
  expert_reviewed: number;
  expert_correction: string | null;
  created_at: string;
}

export interface AnalyticsData {
  totalQueries: number;
  answeredCount: number;
  refusedCount: number;
  avgLatencyMs: number;
  totalDocuments: number;
  approvedDocuments: number;
  totalChunks: number;
  feedbackPositive: number;
  feedbackNegative: number;
  recentConversations: ConversationLog[];
  latestEvaluation: EvalRunReport | null;
}

export interface EvalCaseResult {
  id: string;
  category: string;
  language: Language;
  query: string;
  expectedDecision: 'answered' | 'refused';
  actualDecision: 'answered' | 'refused' | 'clarify';
  passed: boolean;
  retrievalHit: boolean;
  hasCitationOrTool: boolean;
  confidenceScore: number;
  latencyMs: number;
  answerPreview: string;
}

export interface EvalRunReport {
  id: number;
  totalCases: number;
  passedCases: number;
  retrievalRecallAt5: number;
  faithfulnessRate: number;
  safeRefusalRate: number;
  avgLatencyMs: number;
  results: EvalCaseResult[];
  createdAt: string;
}

export interface GlossaryTerm {
  id: number;
  term_en: string;
  term_mr: string;
  term_hi: string;
  category: string;
}

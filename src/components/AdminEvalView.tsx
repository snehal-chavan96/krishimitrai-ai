import {
  CheckCircle2,
  Play,
  RefreshCw,
  ShieldAlert,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AnalyticsData, EvalRunReport, GlossaryTerm } from '../types.ts';

export function AdminEvalView() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningEval, setRunningEval] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [evalReport, setEvalReport] = useState<EvalRunReport | null>(null);
  const [glossary, setGlossary] = useState<GlossaryTerm[]>([]);
  const [runtimeInfo, setRuntimeInfo] = useState<{
    ollamaConnected: boolean;
    ollamaModel: string;
  } | null>(null);

  // Expert correction modal state
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [correctionText, setCorrectionText] = useState('');

  async function loadAnalytics() {
    setLoading(true);
    try {
      const [anaResp, glossResp, healthResp] = await Promise.all([
        fetch('/api/analytics'),
        fetch('/api/glossary'),
        fetch('/api/health'),
      ]);
      const anaData = (await anaResp.json()) as AnalyticsData;
      const glossData = (await glossResp.json()) as { terms: GlossaryTerm[] };
      const healthData = (await healthResp.json()) as {
        ollamaConnected: boolean;
        ollamaModel: string;
      };
      setAnalytics(anaData);
      if (anaData.latestEvaluation) {
        setEvalReport(anaData.latestEvaluation);
      }
      setGlossary(glossData.terms || []);
      setRuntimeInfo(healthData);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAnalytics();
  }, []);

  async function handleRunEvaluation() {
    setRunningEval(true);
    setEvalError(null);
    try {
      const resp = await fetch('/api/eval/run', { method: 'POST' });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'Evaluation run failed');
      }
      setEvalReport(data as EvalRunReport);
      await loadAnalytics();
    } catch (err) {
      setEvalError(err instanceof Error ? err.message : 'Evaluation failed');
    } finally {
      setRunningEval(false);
    }
  }

  async function submitExpertCorrection(conversationId: number) {
    if (!correctionText.trim()) return;
    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId,
        expertCorrection: correctionText.trim(),
      }),
    });
    setReviewingId(null);
    setCorrectionText('');
    await loadAnalytics();
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-stone-950">
            Admin Console & Evaluation Metrics
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            SQLite telemetry & automated RAG evaluation ·{' '}
            {runtimeInfo?.ollamaConnected
              ? `Local Ollama connected (${runtimeInfo.ollamaModel})`
              : 'Local Grounded RAG Synthesizer active (start Ollama locally for generative LLM mode)'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadAnalytics()}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-50"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Refresh Metrics</span>
        </button>
      </div>

      {/* Real Measured Metrics Grid */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <p className="text-xs text-stone-500">Total Queries</p>
          <p className="mt-1.5 font-mono text-2xl font-bold text-stone-950 tabular-nums">
            {loading ? '—' : analytics?.totalQueries ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <p className="text-xs text-stone-500">Answered</p>
          <p className="mt-1.5 font-mono text-2xl font-bold text-emerald-800 tabular-nums">
            {loading ? '—' : analytics?.answeredCount ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <p className="text-xs text-stone-500">Refused Safely</p>
          <p className="mt-1.5 font-mono text-2xl font-bold text-amber-800 tabular-nums">
            {loading ? '—' : analytics?.refusedCount ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <p className="text-xs text-stone-500">Avg Latency</p>
          <p className="mt-1.5 font-mono text-2xl font-bold text-stone-950 tabular-nums">
            {loading ? '—' : `${analytics?.avgLatencyMs ?? 0} ms`}
          </p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <p className="text-xs text-stone-500">Approved Docs</p>
          <p className="mt-1.5 font-mono text-2xl font-bold text-stone-950 tabular-nums">
            {loading ? '—' : `${analytics?.approvedDocuments ?? 0}/${analytics?.totalDocuments ?? 0}`}
          </p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <p className="text-xs text-stone-500">User Feedback</p>
          <div className="mt-1.5 flex items-center gap-3 font-mono text-lg font-bold tabular-nums">
            <span className="inline-flex items-center gap-1 text-emerald-800">
              <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
              {analytics?.feedbackPositive ?? 0}
            </span>
            <span className="inline-flex items-center gap-1 text-red-700">
              <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />
              {analytics?.feedbackNegative ?? 0}
            </span>
          </div>
        </div>
      </section>

      {/* Automated Live Evaluation Suite */}
      <section className="rounded-2xl border border-stone-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-100 pb-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-stone-950">
              Automated RAG & Safe Refusal Evaluation Suite
            </h2>
            <p className="mt-0.5 text-xs text-stone-600">
              Runs 8 real test cases (Marathi/Hindi/English crop, scheme, weather, mandi, out-of-scope, and unsafe pesticide prompts) through the live pipeline.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleRunEvaluation()}
            disabled={runningEval}
            className="inline-flex min-h-[42px] items-center gap-2 whitespace-nowrap shrink-0 rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-60"
          >
            <Play className="h-4 w-4" aria-hidden="true" />
            <span>{runningEval ? 'Running 8 Live Tests...' : 'Run Evaluation Benchmark'}</span>
          </button>
        </div>

        {evalError && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-900">
            {evalError}
          </div>
        )}

        {evalReport ? (
          <div className="mt-5 space-y-5">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-4">
                <p className="text-xs text-stone-500">Retrieval Recall@5</p>
                <p className="mt-1 font-mono text-2xl font-bold text-emerald-900 tabular-nums">
                  {evalReport.retrievalRecallAt5}%
                </p>
              </div>
              <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-4">
                <p className="text-xs text-stone-500">Faithfulness / Cited</p>
                <p className="mt-1 font-mono text-2xl font-bold text-emerald-900 tabular-nums">
                  {evalReport.faithfulnessRate}%
                </p>
              </div>
              <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-4">
                <p className="text-xs text-stone-500">Safe Refusal Accuracy</p>
                <p className="mt-1 font-mono text-2xl font-bold text-emerald-900 tabular-nums">
                  {evalReport.safeRefusalRate}%
                </p>
              </div>
              <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-4">
                <p className="text-xs text-stone-500">Suite Pass / Avg Latency</p>
                <p className="mt-1 font-mono text-xl font-bold text-stone-950 tabular-nums">
                  {evalReport.passedCases}/{evalReport.totalCases} · {evalReport.avgLatencyMs} ms
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-y border-stone-200 bg-stone-50/70 font-semibold text-stone-600">
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Query</th>
                    <th className="py-2.5 px-3">Expected</th>
                    <th className="py-2.5 px-3">Measured</th>
                    <th className="py-2.5 px-3 text-right">Latency</th>
                    <th className="py-2.5 px-3 text-right">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {evalReport.results.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2.5 px-3 font-medium text-stone-900">{r.category}</td>
                      <td className="py-2.5 px-3 max-w-xs truncate text-stone-700" title={r.query}>
                        {r.query}
                      </td>
                      <td className="py-2.5 px-3 font-mono">{r.expectedDecision}</td>
                      <td className="py-2.5 px-3 font-mono">{r.actualDecision}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        {r.latencyMs} ms
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold">
                        {r.passed ? (
                          <span className="inline-flex items-center gap-1 text-emerald-800">
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                            PASS
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-700">
                            <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                            FAIL
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-stone-200 p-6 text-center text-xs text-stone-500">
            No evaluation benchmark run recorded yet. Click "Run Evaluation Benchmark" to measure live pipeline accuracy.
          </div>
        )}
      </section>

      {/* Recent Conversations & Expert Review Loop */}
      <section className="rounded-2xl border border-stone-200 bg-white p-6">
        <h2 className="font-display text-lg font-semibold text-stone-950">
          Recent Conversations & Expert Review Loop
        </h2>
        <p className="mt-0.5 text-xs text-stone-600">
          Inspect recent farmer queries, refusal reasons, user feedback, and submit agronomist corrections.
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-y border-stone-200 bg-stone-50/70 font-semibold text-stone-600">
                <th className="py-2.5 px-3">Question</th>
                <th className="py-2.5 px-3">Lang / Intent</th>
                <th className="py-2.5 px-3">Decision</th>
                <th className="py-2.5 px-3 text-right">Citations</th>
                <th className="py-2.5 px-3 text-right">Latency</th>
                <th className="py-2.5 px-3">Feedback</th>
                <th className="py-2.5 px-3 text-right">Expert Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {!analytics || analytics.recentConversations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-stone-500">
                    No conversations logged yet. Ask a question in the Assistant tab to see live logs here.
                  </td>
                </tr>
              ) : (
                analytics.recentConversations.map((c) => (
                  <tr key={c.id} className="align-top hover:bg-stone-50/50">
                    <td className="py-3 px-3 max-w-xs">
                      <p className="font-medium text-stone-950 line-clamp-2">{c.query_text}</p>
                      {c.expert_correction && (
                        <p className="mt-1 text-[11px] text-emerald-800">
                          Expert note: {c.expert_correction}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-3 text-stone-600">
                      {c.response_language.toUpperCase()} · {c.intent}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`font-semibold ${
                          c.decision === 'answered' ? 'text-emerald-800' : 'text-amber-800'
                        }`}
                      >
                        {c.decision}
                      </span>
                      {c.refusal_reason && (
                        <span className="block text-[10px] text-stone-500">{c.refusal_reason}</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">
                      {c.citations_count}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">
                      {c.latency_ms} ms
                    </td>
                    <td className="py-3 px-3">
                      {c.feedback === 'up'
                        ? 'Helpful'
                        : c.feedback === 'down'
                          ? 'Needs review'
                          : '—'}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {reviewingId === c.id ? (
                        <div className="flex flex-col gap-1.5 min-w-[200px]">
                          <textarea
                            rows={2}
                            value={correctionText}
                            onChange={(e) => setCorrectionText(e.target.value)}
                            placeholder="Enter verified agronomist note..."
                            className="w-full rounded-lg border border-stone-300 p-2 text-xs"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setReviewingId(null)}
                              className="text-stone-500 hover:text-stone-800"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => void submitExpertCorrection(c.id)}
                              className="rounded-md bg-emerald-800 px-2.5 py-1 text-white"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setReviewingId(c.id);
                            setCorrectionText(c.expert_correction || '');
                          }}
                          className="font-semibold text-emerald-800 hover:underline"
                        >
                          {c.expert_reviewed ? 'Edit Note' : 'Review'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Agricultural Glossary */}
      <section className="rounded-2xl border border-stone-200 bg-white p-6">
        <h2 className="font-display text-lg font-semibold text-stone-950">
          Multilingual Agricultural Terminology Glossary
        </h2>
        <p className="mt-0.5 text-xs text-stone-600">
          Preserves crop, pest, chemical, and government scheme terms across Marathi, Hindi, and English retrieval.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {glossary.map((term) => (
            <div
              key={term.id}
              className="rounded-xl border border-stone-200 bg-stone-50/60 px-4 py-3 text-xs"
            >
              <p className="text-[11px] font-semibold text-emerald-800">{term.category}</p>
              <p className="mt-0.5 font-semibold text-stone-950">{term.term_en}</p>
              <p className="mt-1 text-stone-700">
                MR: {term.term_mr} · HI: {term.term_hi}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

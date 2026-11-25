import {
  CheckCircle2,
  Clock,
  FileText,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ChunkCitation, DocumentRecord, Language } from '../types.ts';

interface KnowledgeBaseViewProps {
  language: Language;
  onDocumentsChanged: () => void;
}

export function KnowledgeBaseView({ onDocumentsChanged }: KnowledgeBaseViewProps) {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterQuery, setFilterQuery] = useState('');

  // Upload form state
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [publisher, setPublisher] = useState('');
  const [crop, setCrop] = useState('General');
  const [region, setRegion] = useState('Maharashtra');
  const [docLang, setDocLang] = useState<Language>('en');
  const [licence, setLicence] = useState('Public Agricultural Extension');
  const [autoApprove, setAutoApprove] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Hybrid Vector Search tester
  const [chunkSearchQuery, setChunkSearchQuery] = useState('');
  const [chunkResults, setChunkResults] = useState<ChunkCitation[]>([]);
  const [searchingChunks, setSearchingChunks] = useState(false);

  async function loadDocuments(q = '') {
    setLoading(true);
    try {
      const url = q ? `/api/documents?q=${encodeURIComponent(q)}` : '/api/documents';
      const resp = await fetch(url);
      const data = await resp.json();
      setDocuments(data.documents || []);
    } catch {
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDocuments();
  }, []);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setUploadStatus({ type: 'error', msg: 'Please select a PDF, TXT, or MD document first.' });
      return;
    }
    setUploading(true);
    setUploadStatus(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title || file.name.replace(/\.[^.]+$/, ''));
      formData.append('publisher', publisher || 'Agricultural Extension Department');
      formData.append('crop', crop);
      formData.append('region', region);
      formData.append('language', docLang);
      formData.append('licence', licence);
      formData.append('autoApprove', String(autoApprove));

      const resp = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'Document ingestion failed');
      }

      setUploadStatus({
        type: 'success',
        msg: `Processed into ${data.chunkCount} chunks with embeddings (${data.status}).`,
      });
      setFile(null);
      setTitle('');
      setPublisher('');
      await loadDocuments(filterQuery);
      onDocumentsChanged();
    } catch (err) {
      setUploadStatus({
        type: 'error',
        msg: err instanceof Error ? err.message : 'Upload failed',
      });
    } finally {
      setUploading(false);
    }
  }

  async function handleToggleStatus(doc: DocumentRecord) {
    const nextStatus = doc.status === 'approved' ? 'pending' : 'approved';
    try {
      const resp = await fetch(`/api/documents/${doc.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (resp.ok) {
        await loadDocuments(filterQuery);
        onDocumentsChanged();
      }
    } catch {
      // ignore
    }
  }

  async function handleDelete(id: number) {
    try {
      const resp = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
      if (resp.ok) {
        await loadDocuments(filterQuery);
        onDocumentsChanged();
      }
    } catch {
      // ignore
    }
  }

  async function handleSearchChunks(e: React.FormEvent) {
    e.preventDefault();
    if (!chunkSearchQuery.trim()) return;
    setSearchingChunks(true);
    try {
      const resp = await fetch(`/api/documents/search?q=${encodeURIComponent(chunkSearchQuery.trim())}`);
      const data = await resp.json();
      setChunkResults(data.results || []);
    } finally {
      setSearchingChunks(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-stone-950">
            Knowledge Base & Document Ingestion
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            Only approved documents are indexed into the verified RAG evidence store.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Upload Form */}
        <form
          onSubmit={handleUpload}
          className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 lg:col-span-5"
        >
          <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
            <Upload className="h-4 w-4 text-emerald-800" aria-hidden="true" />
            <h2 className="font-display text-lg font-semibold text-stone-950">
              Upload Agricultural Document
            </h2>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700">
              PDF or Text Bulletin (.pdf, .txt, .md)
            </label>
            <input
              type="file"
              accept=".pdf,.txt,.md"
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                setFile(f);
                if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ''));
              }}
              className="mt-1.5 block w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-800 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-800 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-emerald-900"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-stone-700">Document Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Onion Storage Advisory"
                className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-950 focus:border-emerald-700 focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700">Publisher / Source</label>
              <input
                type="text"
                value={publisher}
                onChange={(e) => setPublisher(e.target.value)}
                placeholder="e.g., ICAR / KVK Nashik"
                className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-950 focus:border-emerald-700 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700">Crop</label>
              <input
                type="text"
                value={crop}
                onChange={(e) => setCrop(e.target.value)}
                className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-950 focus:border-emerald-700 focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700">Region / State</label>
              <input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-950 focus:border-emerald-700 focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700">Language</label>
              <select
                value={docLang}
                onChange={(e) => setDocLang(e.target.value as Language)}
                className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-950 focus:border-emerald-700 focus:bg-white focus:outline-none"
              >
                <option value="en">English</option>
                <option value="mr">Marathi</option>
                <option value="hi">Hindi</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700">Licence / Terms</label>
            <input
              type="text"
              value={licence}
              onChange={(e) => setLicence(e.target.value)}
              className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-950 focus:border-emerald-700 focus:bg-white focus:outline-none"
            />
          </div>

          <label className="flex items-center gap-2.5 text-xs font-medium text-stone-700">
            <input
              type="checkbox"
              checked={autoApprove}
              onChange={(e) => setAutoApprove(e.target.checked)}
              className="h-4 w-4 rounded border-stone-300 text-emerald-800 focus:ring-emerald-700"
            />
            <span>Approve immediately for RAG evidence retrieval</span>
          </label>

          {uploadStatus && (
            <div
              className={`rounded-xl border px-3.5 py-2.5 text-xs font-medium ${
                uploadStatus.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-red-200 bg-red-50 text-red-900'
              }`}
            >
              {uploadStatus.msg}
            </div>
          )}

          <button
            type="submit"
            disabled={uploading}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-900 disabled:opacity-60"
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            <span>{uploading ? 'Extracting, Chunking & Embedding...' : 'Ingest & Index Document'}</span>
          </button>
        </form>

        {/* Hybrid Vector Search Tester */}
        <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 lg:col-span-7">
          <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
            <Search className="h-4 w-4 text-emerald-800" aria-hidden="true" />
            <h2 className="font-display text-lg font-semibold text-stone-950">
              Hybrid Vector & BM25 Retrieval Inspector
            </h2>
          </div>
          <p className="text-xs text-stone-600">
            Test retrieval directly against approved chunks using local multilingual embeddings + BM25 Reciprocal Rank Fusion.
          </p>

          <form onSubmit={handleSearchChunks} className="flex gap-2">
            <input
              type="text"
              value={chunkSearchQuery}
              onChange={(e) => setChunkSearchQuery(e.target.value)}
              placeholder="Search e.g. cotton yellowing leaves, CRI wheat irrigation, PMFBY..."
              className="min-h-[44px] flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2 text-sm text-stone-950 focus:border-emerald-700 focus:bg-white focus:outline-none"
            />
            <button
              type="submit"
              disabled={searchingChunks}
              className="min-h-[44px] whitespace-nowrap shrink-0 rounded-xl bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-60"
            >
              {searchingChunks ? 'Searching...' : 'Search Index'}
            </button>
          </form>

          <div className="max-h-[340px] space-y-3 overflow-y-auto pr-1">
            {chunkResults.length === 0 ? (
              <div className="rounded-xl border border-dashed border-stone-200 p-6 text-center text-xs text-stone-500">
                Enter a query above to inspect ranked approved passages and similarity scores.
              </div>
            ) : (
              chunkResults.map((res) => (
                <div key={res.chunkId} className="rounded-xl border border-stone-200 bg-stone-50/70 p-4 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 font-semibold text-stone-900">
                    <span>{res.documentTitle}</span>
                    <span className="font-mono text-emerald-900 tabular-nums">
                      Page {res.pageNumber} · Score {res.score}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-stone-500">{res.publisher}</p>
                  <p className="mt-2 leading-relaxed text-stone-700">{res.passage}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Document Registry Table */}
      <div className="rounded-2xl border border-stone-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4">
          <h2 className="font-display text-lg font-semibold text-stone-950">
            Verified Knowledge Base Registry ({documents.length})
          </h2>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => {
                setFilterQuery(e.target.value);
                void loadDocuments(e.target.value);
              }}
              placeholder="Filter by title, crop, region..."
              className="min-h-[40px] rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-1.5 text-sm text-stone-900 focus:border-emerald-700 focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-y border-stone-200 bg-stone-50/70 text-xs font-semibold text-stone-600">
                <th className="py-3 px-3">Document & Publisher</th>
                <th className="py-3 px-3">Crop / Region</th>
                <th className="py-3 px-3 text-right">Chunks</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Approval Status</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-stone-500">
                    Loading knowledge base...
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-stone-500">
                    No matching documents found.
                  </td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-stone-50/60">
                    <td className="py-3 px-3">
                      <div className="flex items-start gap-2.5">
                        <FileText className="mt-0.5 h-4 w-4 text-emerald-800 shrink-0" aria-hidden="true" />
                        <div>
                          <p className="font-semibold text-stone-950">{doc.title}</p>
                          <p className="text-xs text-stone-500">
                            {doc.publisher} · {doc.filename}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-xs text-stone-700">
                      {doc.crop} · {doc.region}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-xs text-stone-800 tabular-nums">
                      {doc.chunk_count}
                    </td>
                    <td className="py-3 px-3 font-mono text-xs text-stone-600 tabular-nums">
                      {doc.publication_date}
                    </td>
                    <td className="py-3 px-3">
                      <button
                        type="button"
                        onClick={() => void handleToggleStatus(doc)}
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                          doc.status === 'approved' ? 'text-emerald-800' : 'text-amber-800'
                        }`}
                      >
                        {doc.status === 'approved' ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Approved (Indexed)</span>
                          </>
                        ) : (
                          <>
                            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Pending Review</span>
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => void handleDelete(doc.id)}
                        aria-label={`Delete ${doc.title}`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-stone-500 transition-colors hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  ChevronUp,
  FileText,
  Mic,
  RotateCcw,
  Send,
  Square,
  ThumbsDown,
  ThumbsUp,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { UI_STRINGS } from '../i18n.ts';
import type { ChatResponse, Language } from '../types.ts';
import { LanguageSelector } from './LanguageSelector.tsx';

interface BrowserSpeechRecognitionEvent {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string; confidence: number };
  }>;
}

interface BrowserSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface MessageItem {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  inputMode?: 'text' | 'voice';
  asrConfidence?: number;
  response?: ChatResponse;
  error?: string;
}

interface AssistantViewProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  initialQuery?: string | null;
  onConsumeInitialQuery?: () => void;
  selectedLocation: string;
}

function getSpeechLangTag(lang: Language): string {
  if (lang === 'mr') return 'mr-IN';
  if (lang === 'hi') return 'hi-IN';
  return 'en-IN';
}

export function AssistantView({
  language,
  onLanguageChange,
  initialQuery,
  onConsumeInitialQuery,
  selectedLocation,
}: AssistantViewProps) {
  const t = UI_STRINGS[language];
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusLabel, setStatusLabel] = useState('');

  // Browser SpeechRecognition state
  const [isRecording, setIsRecording] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const finalTranscriptRef = useRef('');
  const finalConfidenceRef = useRef(0.85);
  const timerRef = useRef<number | null>(null);

  // Browser SpeechSynthesis playback state
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);

  // Expanded citations & feedback
  const [expandedCitations, setExpandedCitations] = useState<Record<string, boolean>>({});
  const [feedbackSent, setFeedbackSent] = useState<Record<number, 'up' | 'down'>>({});

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const lastInitialQueryRef = useRef<string | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (initialQuery && initialQuery !== lastInitialQueryRef.current) {
      lastInitialQueryRef.current = initialQuery;
      void handleSendQuery(initialQuery, 'text');
      onConsumeInitialQuery?.();
    }
  }, [initialQuery]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
      stopPlayback();
    };
  }, []);

  function stopPlayback() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setPlayingMessageId(null);
  }

  function handlePlaySpeech(msgId: string, text: string, lang: Language) {
    if (playingMessageId === msgId) {
      stopPlayback();
      return;
    }
    stopPlayback();

    if (!('speechSynthesis' in window)) {
      setVoiceError('Browser SpeechSynthesis is unavailable in this browser.');
      return;
    }

    const cleanText = text.length > 550 ? `${text.slice(0, 545)}...` : text;
    const utterance = new SpeechSynthesisUtterance(cleanText);
    const targetTag = getSpeechLangTag(lang);
    utterance.lang = targetTag;
    utterance.rate = 0.94;

    // Pick matching voice if installed on user's OS/browser
    const voices = window.speechSynthesis.getVoices();
    const matchedVoice =
      voices.find((v) => v.lang.toLowerCase() === targetTag.toLowerCase()) ||
      voices.find((v) => v.lang.toLowerCase().startsWith(lang)) ||
      voices.find((v) => v.lang.toLowerCase().includes('in'));
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    utterance.onend = () => setPlayingMessageId(null);
    utterance.onerror = () => setPlayingMessageId(null);
    setPlayingMessageId(msgId);
    window.speechSynthesis.speak(utterance);
  }

  async function handleSendQuery(
    queryText: string,
    mode: 'text' | 'voice' = 'text',
    asrConfidence?: number,
    autoSpeak = false
  ) {
    const trimmed = queryText.trim();
    if (!trimmed || isLoading) return;

    setVoiceError(null);
    const userMsgId = `u-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: 'user', text: trimmed, inputMode: mode, asrConfidence },
    ]);
    if (mode === 'text') setInputText('');

    setIsLoading(true);
    setStatusLabel(t.thinking);

    try {
      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: trimmed,
          language,
          inputMode: mode,
          asrConfidence,
          location: selectedLocation,
          sessionId: 'web-farmer-session',
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'Failed to generate answer');
      }

      const chatRes = data as ChatResponse;
      const assistantMsgId = `a-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          role: 'assistant',
          text: chatRes.answer,
          response: chatRes,
        },
      ]);

      if (autoSpeak) {
        handlePlaySpeech(assistantMsgId, chatRes.answer, chatRes.language);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Network error';
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          text: errMsg,
          error: errMsg,
        },
      ]);
    } finally {
      setIsLoading(false);
      setStatusLabel('');
    }
  }

  function startBrowserSpeechRecognition() {
    setVoiceError(null);
    stopPlayback();

    const win = window as unknown as {
      SpeechRecognition?: new () => BrowserSpeechRecognition;
      webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
    };
    const SpeechRecCtor = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecCtor) {
      setVoiceError(
        'Browser Speech Recognition is not supported in this browser (try Chrome or Edge), or type your question in the box below.'
      );
      return;
    }

    try {
      const recognition = new SpeechRecCtor();
      recognition.lang = getSpeechLangTag(language);
      recognition.continuous = true;
      recognition.interimResults = true;

      finalTranscriptRef.current = '';
      finalConfidenceRef.current = 0.85;
      setInterimTranscript('');

      recognition.onresult = (event) => {
        let interim = '';
        let finalStr = finalTranscriptRef.current;
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          if (res.isFinal) {
            finalStr += `${res[0].transcript} `;
            if (typeof res[0].confidence === 'number' && res[0].confidence > 0) {
              finalConfidenceRef.current = res[0].confidence;
            }
          } else {
            interim += res[0].transcript;
          }
        }
        finalTranscriptRef.current = finalStr;
        setInterimTranscript(`${finalStr}${interim}`.trim());
      };

      recognition.onerror = (ev) => {
        if (timerRef.current) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setIsRecording(false);
        if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
          setVoiceError('Microphone permission was denied. Please allow mic access or type your question below.');
        } else if (ev.error === 'no-speech') {
          setVoiceError('No speech detected. Please tap Speak and try again, or type your question.');
        } else {
          setVoiceError(`Voice recognition unavailable (${ev.error}). You can type your question directly below.`);
        }
      };

      recognition.onend = () => {
        if (timerRef.current) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setIsRecording(false);
        const recognized = finalTranscriptRef.current.trim() || interimTranscript.trim();
        setInterimTranscript('');
        if (recognized.length >= 2) {
          void handleSendQuery(recognized, 'voice', finalConfidenceRef.current, true);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsRecording(true);
      setRecordSeconds(0);
      timerRef.current = window.setInterval(() => {
        setRecordSeconds((s) => {
          if (s >= 30) {
            stopBrowserSpeechRecognition();
            return s;
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      setVoiceError('Unable to start browser speech recognition. Please type your question below.');
    }
  }

  function stopBrowserSpeechRecognition() {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        setIsRecording(false);
      }
    }
  }

  async function handleFeedback(conversationId: number, vote: 'up' | 'down') {
    setFeedbackSent((prev) => ({ ...prev, [conversationId]: vote }));
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, feedback: vote }),
      });
    } catch {
      // Non-blocking feedback
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      {/* Assistant Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-white px-5 py-4">
        <div>
          <h1 className="font-display text-xl font-bold text-stone-950">{t.navAssistant}</h1>
          <p className="text-xs text-stone-500">
            Browser Speech Input & SpeechSynthesis · Local RAG / Ollama · Region: {selectedLocation}
          </p>
        </div>
        <LanguageSelector language={language} onChange={onLanguageChange} />
      </div>

      {/* Chat Conversation Feed */}
      <div className="flex min-h-[420px] max-h-[60vh] flex-col gap-4 overflow-y-auto rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
        {messages.length === 0 ? (
          <div className="my-auto flex flex-col items-center justify-center py-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800">
              <Mic className="h-7 w-7" aria-hidden="true" />
            </div>
            <h2 className="mt-4 font-display text-lg font-semibold text-stone-950">
              {t.welcomeTitle}
            </h2>
            <p className="mt-1.5 max-w-lg text-sm text-stone-600">
              Tap the microphone to speak in Marathi, Hindi, or English using browser voice recognition, or pick a question below.
            </p>
            <div className="mt-6 grid w-full max-w-2xl grid-cols-1 gap-2.5 sm:grid-cols-2">
              {t.suggestedQuestions.map((sq, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => void handleSendQuery(sq.query, 'text')}
                  className="rounded-xl border border-stone-200 bg-stone-50/70 p-3.5 text-left text-xs font-medium text-stone-800 transition-colors hover:border-emerald-700 hover:bg-emerald-50/50"
                >
                  <span className="block text-[11px] font-semibold text-emerald-800">{sq.tag}</span>
                  <span className="mt-1 block text-sm font-semibold text-stone-950">{sq.query}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            if (msg.role === 'user') {
              return (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-emerald-800 px-4 py-3 text-white sm:max-w-[75%]">
                    <p className="text-sm leading-relaxed sm:text-base">{msg.text}</p>
                    {msg.inputMode === 'voice' && (
                      <p className="mt-1.5 text-[11px] text-emerald-100 tabular-nums">
                        Browser Voice Input
                        {typeof msg.asrConfidence === 'number'
                          ? ` · Confidence ${Math.round(msg.asrConfidence * 100)}%`
                          : ''}
                      </p>
                    )}
                  </div>
                </div>
              );
            }

            const res = msg.response;
            const isRefused = res?.decision === 'refused' || res?.decision === 'clarify';
            const isCitationsOpen = Boolean(expandedCitations[msg.id]);

            return (
              <div key={msg.id} className="flex justify-start">
                <div
                  className={`w-full max-w-[92%] rounded-2xl rounded-bl-sm border p-4 sm:max-w-[84%] sm:p-5 ${
                    msg.error
                      ? 'border-red-200 bg-red-50/60'
                      : isRefused
                        ? 'border-amber-300 bg-amber-50/40'
                        : 'border-stone-200 bg-stone-50/50'
                  }`}
                >
                  {isRefused && (
                    <div className="mb-2.5 flex items-center gap-2 text-xs font-semibold text-amber-900">
                      <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0" aria-hidden="true" />
                      <span>{t.refusedBanner}</span>
                    </div>
                  )}

                  <p className="text-sm leading-relaxed text-stone-900 whitespace-pre-line sm:text-base">
                    {msg.text}
                  </p>

                  {res?.safetyNote && (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/70 px-3.5 py-2.5 text-xs font-medium text-amber-950">
                      {res.safetyNote}
                    </div>
                  )}

                  {res?.liveToolData && (
                    <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3.5 py-2.5 text-xs text-emerald-950">
                      <span className="font-semibold">{res.liveToolData.label}</span>
                      <span aria-hidden="true"> · </span>
                      <span>{res.liveToolData.summary}</span>
                      <span aria-hidden="true"> · </span>
                      <span className="tabular-nums">
                        As of {new Date(res.liveToolData.dataAsOf).toLocaleString()}
                      </span>
                    </div>
                  )}

                  {res && (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-stone-200/80 pt-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handlePlaySpeech(msg.id, msg.text, res.language)}
                          className="inline-flex min-h-[36px] items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 transition-colors hover:bg-stone-100"
                        >
                          {playingMessageId === msg.id ? (
                            <>
                              <VolumeX className="h-3.5 w-3.5 text-emerald-800" aria-hidden="true" />
                              <span>{t.stopAudio}</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="h-3.5 w-3.5 text-emerald-800" aria-hidden="true" />
                              <span>{t.listenAnswer}</span>
                            </>
                          )}
                        </button>

                        {res.citations.length > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedCitations((prev) => ({
                                ...prev,
                                [msg.id]: !prev[msg.id],
                              }))
                            }
                            className="inline-flex min-h-[36px] items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-100"
                          >
                            <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>
                              {t.sourcesTitle} ({res.citations.length})
                            </span>
                            {isCitationsOpen ? (
                              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                            )}
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-stone-500">
                        <span className="tabular-nums">
                          {res.generationMode === 'ollama' ? 'Ollama LLM' : 'Local RAG'} ·{' '}
                          {res.intent.replace('_', ' ')} · {res.latencyMs} ms
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            aria-label="Helpful"
                            onClick={() => void handleFeedback(res.conversationId, 'up')}
                            className={`flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
                              feedbackSent[res.conversationId] === 'up'
                                ? 'border-emerald-700 bg-emerald-800 text-white'
                                : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-100'
                            }`}
                          >
                            <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            aria-label="Needs improvement"
                            onClick={() => void handleFeedback(res.conversationId, 'down')}
                            className={`flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
                              feedbackSent[res.conversationId] === 'down'
                                ? 'border-red-700 bg-red-700 text-white'
                                : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-100'
                            }`}
                          >
                            <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {res && res.citations.length > 0 && isCitationsOpen && (
                    <div className="mt-3 space-y-2.5 border-t border-stone-200 pt-3">
                      {res.citations.map((cit, cIdx) => (
                        <div
                          key={`${cit.chunkId}-${cIdx}`}
                          className="rounded-xl border border-stone-200 bg-white p-3.5 text-xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 font-semibold text-stone-900">
                            <span className="flex items-center gap-1.5">
                              <FileText className="h-3.5 w-3.5 text-emerald-800 shrink-0" aria-hidden="true" />
                              {cit.documentTitle}
                            </span>
                            <span className="font-mono text-stone-600 tabular-nums">
                              {t.pageLabel} {cit.pageNumber} · Score {cit.score}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-stone-500">{cit.publisher}</p>
                          <p className="mt-2 leading-relaxed text-stone-700">{cit.passage}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {isLoading && (
          <div className="flex items-center gap-2.5 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-800 border-t-transparent" />
            <span>{statusLabel || t.thinking}</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Live Interim Voice Transcript Preview */}
      {isRecording && interimTranscript && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-2.5 text-xs text-emerald-950">
          <span className="font-semibold">Listening: </span>
          <span>{interimTranscript}</span>
        </div>
      )}

      {/* Voice Fallback Banner */}
      {voiceError && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-950">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0" aria-hidden="true" />
            <span>{voiceError}</span>
          </div>
          <button
            type="button"
            onClick={startBrowserSpeechRecognition}
            className="inline-flex items-center gap-1.5 font-semibold text-emerald-900 hover:underline"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Retry Mic</span>
          </button>
        </div>
      )}

      {/* Voice & Text Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSendQuery(inputText, 'text');
        }}
        className="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-3 sm:flex-row sm:items-center sm:p-4"
      >
        <div className="flex items-center gap-2 shrink-0">
          {!isRecording ? (
            <button
              type="button"
              onClick={startBrowserSpeechRecognition}
              disabled={isLoading}
              className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap shrink-0 rounded-xl border border-emerald-800 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-950 transition-colors hover:bg-emerald-100 disabled:opacity-50"
            >
              <Mic className="h-4 w-4 text-emerald-800" aria-hidden="true" />
              <span>{t.recordStart}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={stopBrowserSpeechRecognition}
              className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap shrink-0 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-800"
            >
              <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
              <span className="tabular-nums">
                {t.recordStop} ({recordSeconds}s)
              </span>
            </button>
          )}
        </div>

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={isRecording ? t.recordingNow : t.askPlaceholder}
          disabled={isRecording || isLoading}
          className="min-h-[44px] flex-1 rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm text-stone-950 placeholder:text-stone-400 focus:border-emerald-700 focus:bg-white focus:outline-none"
        />

        <button
          type="submit"
          disabled={!inputText.trim() || isLoading || isRecording}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap shrink-0 rounded-xl bg-emerald-800 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span>{t.sendBtn}</span>
          <Send className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}

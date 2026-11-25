import {
  BarChart3,
  BookOpen,
  CloudSun,
  Home,
  MessageSquare,
  Mic,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { AdminEvalView } from './components/AdminEvalView.tsx';
import { AssistantView } from './components/AssistantView.tsx';
import { DashboardView, type AppView } from './components/DashboardView.tsx';
import { KnowledgeBaseView } from './components/KnowledgeBaseView.tsx';
import { WeatherMandiView } from './components/WeatherMandiView.tsx';
import { UI_STRINGS } from './i18n.ts';
import type { Language, MandiResponse, WeatherResponse } from './types.ts';

export default function App() {
  const [activeView, setActiveView] = useState<AppView>('dashboard');
  const [language, setLanguage] = useState<Language>('mr');
  const [selectedLocation, setSelectedLocation] = useState('Pune');
  const [queuedQuery, setQueuedQuery] = useState<string | null>(null);

  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [mandi, setMandi] = useState<MandiResponse | null>(null);
  const [mandiLoading, setMandiLoading] = useState(true);
  const [approvedDocsCount, setApprovedDocsCount] = useState(5);

  const t = UI_STRINGS[language];

  async function refreshSummaryData(loc = selectedLocation) {
    setWeatherLoading(true);
    setMandiLoading(true);
    try {
      const [wRes, mRes, dRes] = await Promise.all([
        fetch(`/api/weather?location=${encodeURIComponent(loc)}`),
        fetch('/api/mandi/prices'),
        fetch('/api/documents'),
      ]);
      if (wRes.ok) setWeather(await wRes.json());
      if (mRes.ok) setMandi(await mRes.json());
      if (dRes.ok) {
        const docsJson = (await dRes.json()) as {
          documents?: Array<{ status: string }>;
        };
        setApprovedDocsCount(
          (docsJson.documents || []).filter((d) => d.status === 'approved').length
        );
      }
    } finally {
      setWeatherLoading(false);
      setMandiLoading(false);
    }
  }

  useEffect(() => {
    void refreshSummaryData(selectedLocation);
  }, [selectedLocation]);

  function handleNavigate(view: AppView) {
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleAskSuggested(query: string) {
    setQueuedQuery(query);
    setActiveView('assistant');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const navItems: Array<{ id: AppView; label: string; shortLabel: string; icon: typeof Home }> = [
    { id: 'dashboard', label: t.navDashboard, shortLabel: 'Home', icon: Home },
    { id: 'assistant', label: t.navAssistant, shortLabel: 'Voice AI', icon: MessageSquare },
    { id: 'knowledge', label: t.navKnowledge, shortLabel: 'Docs', icon: BookOpen },
    { id: 'weather_mandi', label: t.navWeatherMandi, shortLabel: 'Market', icon: CloudSun },
    { id: 'admin', label: t.navAdmin, shortLabel: 'Admin', icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-[#F6F8F5] text-[#172119] pb-20 md:pb-10">
      {/* Three-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 border-b border-stone-200/90 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => handleNavigate('dashboard')}
            className="font-display text-lg font-bold tracking-tight text-emerald-950 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-emerald-700"
          >
            KrishiMitra AI
          </button>

          {/* Zone 2: 5 concise single-line nav links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-stone-600">
            {navItems.map((item) => {
              const active = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavigate(item.id)}
                  className={`whitespace-nowrap shrink-0 border-b-2 py-1 transition-colors ${
                    active
                      ? 'border-emerald-800 font-semibold text-emerald-950'
                      : 'border-transparent hover:text-stone-950'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary CTA */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => handleNavigate('assistant')}
              className="inline-flex min-h-[40px] items-center gap-2 whitespace-nowrap shrink-0 rounded-xl bg-emerald-800 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-900"
            >
              <Mic className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t.startVoiceBtn}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {activeView === 'dashboard' && (
          <DashboardView
            language={language}
            onLanguageChange={setLanguage}
            onNavigate={(view) => handleNavigate(view)}
            onAskSuggested={handleAskSuggested}
            weather={weather}
            weatherLoading={weatherLoading}
            mandi={mandi}
            mandiLoading={mandiLoading}
            approvedDocsCount={approvedDocsCount}
          />
        )}

        {activeView === 'assistant' && (
          <AssistantView
            language={language}
            onLanguageChange={setLanguage}
            initialQuery={queuedQuery}
            onConsumeInitialQuery={() => setQueuedQuery(null)}
            selectedLocation={selectedLocation}
          />
        )}

        {activeView === 'knowledge' && (
          <KnowledgeBaseView
            language={language}
            onDocumentsChanged={() => void refreshSummaryData(selectedLocation)}
          />
        )}

        {activeView === 'weather_mandi' && (
          <WeatherMandiView
            language={language}
            selectedLocation={selectedLocation}
            onLocationChange={setSelectedLocation}
          />
        )}

        {activeView === 'admin' && <AdminEvalView />}
      </main>

      {/* Quiet Informational Footer */}
      <footer className="mx-auto mt-10 max-w-7xl border-t border-stone-200 px-4 py-5 text-xs text-stone-500 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            KrishiMitra AI · Informational guidance only; verify critical chemical dosages with your local KVK or Kisan Call Centre (1800-180-1551).
          </span>
          <span>Marathi · Hindi · English</span>
        </div>
      </footer>

      {/* Mobile Bottom Tab Bar (< 768px, compact height within 15% sticky budget) */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 border-t border-stone-200 bg-white/95 backdrop-blur-md md:hidden"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavigate(item.id)}
              className={`flex min-h-[54px] flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium transition-colors ${
                active ? 'text-emerald-900 font-semibold' : 'text-stone-500'
              }`}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="truncate max-w-full">{item.shortLabel}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

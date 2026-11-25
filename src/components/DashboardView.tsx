import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CloudRain,
  Droplets,
  IndianRupee,
  Mic,
  ShieldCheck,
  Sprout,
  Thermometer,
  Wind,
} from 'lucide-react';
import { UI_STRINGS } from '../i18n.ts';
import type { Language, MandiResponse, WeatherResponse } from '../types.ts';
import { LanguageSelector } from './LanguageSelector.tsx';

export type AppView = 'dashboard' | 'assistant' | 'knowledge' | 'weather_mandi' | 'admin';

interface DashboardViewProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  onNavigate: (view: AppView, focusSection?: 'weather' | 'mandi') => void;
  onAskSuggested: (query: string) => void;
  weather: WeatherResponse | null;
  weatherLoading: boolean;
  mandi: MandiResponse | null;
  mandiLoading: boolean;
  approvedDocsCount: number;
}

export function DashboardView({
  language,
  onLanguageChange,
  onNavigate,
  onAskSuggested,
  weather,
  weatherLoading,
  mandi,
  mandiLoading,
  approvedDocsCount,
}: DashboardViewProps) {
  const t = UI_STRINGS[language];

  return (
    <div className="space-y-8">
      {/* Hero Split Section */}
      <section className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
        <div className="flex flex-col justify-between rounded-2xl border border-stone-200/90 bg-white p-6 sm:p-8 lg:col-span-7">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs font-medium text-emerald-900">
                <Sprout className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                <span>ICAR & KVK Verified RAG</span>
                <span aria-hidden="true">·</span>
                <span>{approvedDocsCount} Approved Sources</span>
              </div>
              <LanguageSelector language={language} onChange={onLanguageChange} />
            </div>

            <h1 className="font-display text-2xl font-bold leading-tight tracking-tight text-stone-950 text-balance sm:text-4xl">
              {t.welcomeTitle}
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-stone-600 sm:text-base">
              {t.welcomeSubtitle}
            </p>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-3 pt-4 border-t border-stone-100">
            <button
              type="button"
              onClick={() => onNavigate('assistant')}
              className="inline-flex min-h-[44px] items-center gap-2.5 whitespace-nowrap shrink-0 rounded-xl bg-emerald-800 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            >
              <Mic className="h-4 w-4" aria-hidden="true" />
              <span>{t.startVoiceBtn}</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('knowledge')}
              className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap shrink-0 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 transition-colors hover:bg-stone-50"
            >
              <BookOpen className="h-4 w-4 text-emerald-800" aria-hidden="true" />
              <span>{t.navKnowledge}</span>
            </button>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-stone-200/90 bg-emerald-950 lg:col-span-5 min-h-[260px]">
          <img
            src="/src/assets/images/hero_indian_farmer_1795615373913.jpg"
            alt="Indian smallholder farmer using KrishiMitra AI in green cotton and soybean field"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover lg:h-full"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-stone-950/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
            <p className="text-xs font-medium text-emerald-200">
              Voice-First · Marathi · Hindi · English
            </p>
            <p className="mt-1 text-sm font-semibold leading-snug">
              Grounded answers with document citations & safe refusal when uncertain.
            </p>
          </div>
        </div>
      </section>

      {/* Live Weather & Today's Mandi Summary Row */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Weather Summary */}
        <div className="flex flex-col justify-between rounded-2xl border border-stone-200/90 bg-white p-6">
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-stone-500">
                  Open-Meteo Live Forecast · {weather?.state || 'Maharashtra'}
                </p>
                <h2 className="mt-1 font-display text-lg font-semibold text-stone-950">
                  {t.weatherSummaryTitle} — {weather?.location || 'Pune'}
                </h2>
              </div>
              <CloudRain className="h-5 w-5 text-emerald-800 shrink-0" aria-hidden="true" />
            </div>

            {weatherLoading ? (
              <div className="mt-5 h-24 animate-pulse rounded-xl bg-stone-100" />
            ) : weather ? (
              <div className="mt-5 space-y-4">
                <div className="grid grid-cols-3 gap-3 border-y border-stone-100 py-4">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs text-stone-500">
                      <Thermometer className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Temp</span>
                    </div>
                    <p className="mt-1 font-mono text-2xl font-semibold text-stone-950 tabular-nums">
                      {weather.temperatureC.toFixed(1)}°C
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 text-xs text-stone-500">
                      <Droplets className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Humidity</span>
                    </div>
                    <p className="mt-1 font-mono text-2xl font-semibold text-stone-950 tabular-nums">
                      {weather.humidityPercent}%
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 text-xs text-stone-500">
                      <Wind className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Wind</span>
                    </div>
                    <p className="mt-1 font-mono text-2xl font-semibold text-stone-950 tabular-nums">
                      {weather.windSpeedKmh.toFixed(0)} <span className="text-xs font-normal">km/h</span>
                    </p>
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-stone-700">
                  {weather.advisory[language]}
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-stone-500">Weather data unavailable right now.</p>
            )}
          </div>

          <div className="mt-5 flex items-center justify-between gap-4 border-t border-stone-100 pt-4">
            <span className="text-xs text-stone-500 tabular-nums">
              {t.lastUpdated}: {weather ? new Date(weather.lastUpdated).toLocaleTimeString() : '—'}
            </span>
            <button
              type="button"
              onClick={() => onNavigate('weather_mandi', 'weather')}
              className="inline-flex min-h-[40px] items-center gap-1.5 whitespace-nowrap shrink-0 text-sm font-semibold text-emerald-800 hover:text-emerald-950"
            >
              <span>{t.viewAllWeather}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Mandi Summary */}
        <div className="flex flex-col justify-between rounded-2xl border border-stone-200/90 bg-white p-6">
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-amber-800">
                  {mandi?.dataLabel || 'DEMONSTRATION DATA'} · ₹/Quintal
                </p>
                <h2 className="mt-1 font-display text-lg font-semibold text-stone-950">
                  {t.mandiSummaryTitle}
                </h2>
              </div>
              <IndianRupee className="h-5 w-5 text-emerald-800 shrink-0" aria-hidden="true" />
            </div>

            {mandiLoading ? (
              <div className="mt-5 h-24 animate-pulse rounded-xl bg-stone-100" />
            ) : mandi && mandi.records.length > 0 ? (
              <div className="mt-4 divide-y divide-stone-100 border-y border-stone-100">
                {mandi.records.slice(0, 4).map((rec, idx) => (
                  <div
                    key={`${rec.commodity}-${rec.market}-${idx}`}
                    className="flex items-center justify-between gap-4 py-2.5 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-stone-900 truncate">{rec.commodity}</p>
                      <p className="text-xs text-stone-500 truncate">
                        {rec.market} · {rec.priceDate}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono font-semibold text-emerald-900 tabular-nums">
                        ₹{rec.modalPrice.toLocaleString('en-IN')}
                      </p>
                      <p className="font-mono text-xs text-stone-500 tabular-nums">
                        ₹{rec.minPrice}–{rec.maxPrice}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-stone-500">No mandi records available.</p>
            )}
          </div>

          <div className="mt-5 flex items-center justify-between gap-4 pt-2">
            <span className="text-xs text-stone-500">
              {mandi?.isLive ? 'Live Agmarknet feed' : 'Reference demonstration dataset'}
            </span>
            <button
              type="button"
              onClick={() => onNavigate('weather_mandi', 'mandi')}
              className="inline-flex min-h-[40px] items-center gap-1.5 whitespace-nowrap shrink-0 text-sm font-semibold text-emerald-800 hover:text-emerald-950"
            >
              <span>{t.viewAllMandi}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>

      {/* Quick Agricultural Question Suggestions */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-stone-950">
            {t.quickQuestionsTitle}
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('assistant')}
            className="text-sm font-semibold text-emerald-800 hover:text-emerald-950 whitespace-nowrap shrink-0"
          >
            {t.openAssistantBtn}
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {t.suggestedQuestions.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onAskSuggested(item.query)}
              className="group flex flex-col justify-between rounded-xl border border-stone-200 bg-white p-5 text-left transition-colors hover:border-emerald-700 hover:bg-emerald-50/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            >
              <div>
                <p className="text-xs font-medium text-emerald-800">{item.tag}</p>
                <p className="mt-2 text-sm font-semibold leading-snug text-stone-950">
                  {item.query}
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs font-medium text-stone-500 group-hover:text-emerald-800">
                <span>{item.label}</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Module Navigation Strip with Domain Imagery */}
      <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <button
          type="button"
          onClick={() => onNavigate('knowledge')}
          className="group overflow-hidden rounded-2xl border border-stone-200 bg-white text-left transition-colors hover:border-emerald-700"
        >
          <div className="aspect-[4/3] w-full overflow-hidden bg-emerald-900">
            <img
              src="/src/assets/images/crop_advisory_field_1795615375245.jpg"
              alt="Healthy wheat and soybean crops in Indian field"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          </div>
          <div className="p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-stone-950">
                {t.navKnowledge}
              </h3>
              <BookOpen className="h-4 w-4 text-emerald-800" aria-hidden="true" />
            </div>
            <p className="mt-1.5 text-sm text-stone-600">
              Upload ICAR / KVK PDFs, inspect extracted chunks, and control document approval.
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('weather_mandi', 'mandi')}
          className="group overflow-hidden rounded-2xl border border-stone-200 bg-white text-left transition-colors hover:border-emerald-700"
        >
          <div className="aspect-[4/3] w-full overflow-hidden bg-amber-900">
            <img
              src="/src/assets/images/mandi_market_produce_1795615375327.jpg"
              alt="Agricultural mandi yard with grain sacks and cotton"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          </div>
          <div className="p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-stone-950">
                {t.navWeatherMandi}
              </h3>
              <IndianRupee className="h-4 w-4 text-emerald-800" aria-hidden="true" />
            </div>
            <p className="mt-1.5 text-sm text-stone-600">
              Filter commodity prices by state & APMC market and check 5-day spray advisories.
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('admin')}
          className="group flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-6 text-left transition-colors hover:border-emerald-700"
        >
          <div className="space-y-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
              <BarChart3 className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-display text-base font-semibold text-stone-950">
                {t.navAdmin}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-stone-600">
                Measure real retrieval recall, safe refusal accuracy on unsafe pesticide prompts,
                latency, and review farmer feedback.
              </p>
            </div>
          </div>
          <div className="mt-6 flex items-center gap-2 border-t border-stone-100 pt-4 text-xs font-semibold text-emerald-800">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            <span>Run Live Evaluation Suite</span>
            <ArrowRight className="h-3.5 w-3.5 ml-auto" aria-hidden="true" />
          </div>
        </button>
      </section>
    </div>
  );
}

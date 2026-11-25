import {
  AlertCircle,
  CloudRain,
  Droplets,
  IndianRupee,
  MapPin,
  RefreshCw,
  Thermometer,
  Wind,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Language, MandiResponse, WeatherResponse } from '../types.ts';

interface WeatherMandiViewProps {
  language: Language;
  selectedLocation: string;
  onLocationChange: (loc: string) => void;
  initialFocus?: 'weather' | 'mandi';
}

const LOCATIONS = [
  'Pune',
  'Nashik',
  'Nagpur',
  'Akola',
  'Kolhapur',
  'Indore',
  'Ludhiana',
  'Karnal',
  'Jaipur',
  'Guntur',
];

export function WeatherMandiView({
  language,
  selectedLocation,
  onLocationChange,
}: WeatherMandiViewProps) {
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  const [mandi, setMandi] = useState<MandiResponse | null>(null);
  const [mandiLoading, setMandiLoading] = useState(true);
  const [commodityFilter, setCommodityFilter] = useState('All');
  const [stateFilter, setStateFilter] = useState('All');
  const [districtFilter, setDistrictFilter] = useState('All');
  const [marketFilter, setMarketFilter] = useState('All');

  async function fetchWeather(loc: string) {
    setWeatherLoading(true);
    setWeatherError(null);
    try {
      const resp = await fetch(`/api/weather?location=${encodeURIComponent(loc)}`);
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Weather lookup failed');
      setWeather(data);
    } catch (err) {
      setWeatherError(err instanceof Error ? err.message : 'Unable to load weather');
    } finally {
      setWeatherLoading(false);
    }
  }

  async function fetchMandi() {
    setMandiLoading(true);
    try {
      const params = new URLSearchParams();
      if (commodityFilter !== 'All') params.set('commodity', commodityFilter);
      if (stateFilter !== 'All') params.set('state', stateFilter);
      if (districtFilter !== 'All') params.set('district', districtFilter);
      if (marketFilter !== 'All') params.set('market', marketFilter);

      const resp = await fetch(`/api/mandi/prices?${params.toString()}`);
      const data = await resp.json();
      setMandi(data);
    } finally {
      setMandiLoading(false);
    }
  }

  useEffect(() => {
    void fetchWeather(selectedLocation);
  }, [selectedLocation]);

  useEffect(() => {
    void fetchMandi();
  }, [commodityFilter, stateFilter, districtFilter, marketFilter]);

  return (
    <div className="space-y-8">
      {/* Weather & Agromet Advisory Module */}
      <section className="rounded-2xl border border-stone-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-100 pb-4">
          <div>
            <p className="text-xs font-medium text-emerald-800">
              {weather?.source || 'Open-Meteo Live Weather API'}
            </p>
            <h1 className="mt-0.5 font-display text-2xl font-bold text-stone-950">
              Agromet Weather & Spray Advisory
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-stone-700">
              <MapPin className="h-4 w-4 text-emerald-800" aria-hidden="true" />
              <select
                value={selectedLocation}
                onChange={(e) => onLocationChange(e.target.value)}
                className="min-h-[40px] rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-sm font-medium text-stone-950 focus:border-emerald-700 focus:outline-none"
              >
                {LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => void fetchWeather(selectedLocation)}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {weatherError && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            {weatherError}
          </div>
        )}

        {weatherLoading ? (
          <div className="mt-5 h-40 animate-pulse rounded-xl bg-stone-100" />
        ) : weather ? (
          <div className="mt-6 space-y-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-4">
                <div className="flex items-center gap-1.5 text-xs text-stone-500">
                  <Thermometer className="h-3.5 w-3.5 text-emerald-800" aria-hidden="true" />
                  <span>Temperature</span>
                </div>
                <p className="mt-1.5 font-mono text-2xl font-bold text-stone-950 tabular-nums">
                  {weather.temperatureC.toFixed(1)}°C
                </p>
                <p className="mt-0.5 text-xs text-stone-600">{weather.condition}</p>
              </div>

              <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-4">
                <div className="flex items-center gap-1.5 text-xs text-stone-500">
                  <Droplets className="h-3.5 w-3.5 text-emerald-800" aria-hidden="true" />
                  <span>Humidity</span>
                </div>
                <p className="mt-1.5 font-mono text-2xl font-bold text-stone-950 tabular-nums">
                  {weather.humidityPercent}%
                </p>
                <p className="mt-0.5 text-xs text-stone-600">Relative humidity</p>
              </div>

              <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-4">
                <div className="flex items-center gap-1.5 text-xs text-stone-500">
                  <Wind className="h-3.5 w-3.5 text-emerald-800" aria-hidden="true" />
                  <span>Wind Speed</span>
                </div>
                <p className="mt-1.5 font-mono text-2xl font-bold text-stone-950 tabular-nums">
                  {weather.windSpeedKmh.toFixed(1)} km/h
                </p>
                <p className="mt-0.5 text-xs text-stone-600">
                  {weather.windSpeedKmh >= 15 ? 'Avoid spraying' : 'Calm for spraying'}
                </p>
              </div>

              <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-4">
                <div className="flex items-center gap-1.5 text-xs text-stone-500">
                  <CloudRain className="h-3.5 w-3.5 text-emerald-800" aria-hidden="true" />
                  <span>Rain Now</span>
                </div>
                <p className="mt-1.5 font-mono text-2xl font-bold text-stone-950 tabular-nums">
                  {weather.precipitationMm.toFixed(1)} mm
                </p>
                <p className="mt-0.5 text-xs text-stone-600">
                  {weather.location}, {weather.state}
                </p>
              </div>
            </div>

            {/* Agricultural Advisory */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
              <p className="text-xs font-semibold text-emerald-900">Agricultural Weather Advisory</p>
              <p className="mt-1 text-sm leading-relaxed text-stone-900">
                {weather.advisory[language]}
              </p>
            </div>

            {/* 5-Day Forecast */}
            <div>
              <div className="mb-3 flex items-center justify-between text-xs text-stone-500">
                <span className="font-semibold text-stone-800">5-Day Outlook</span>
                <span className="tabular-nums">
                  Last updated: {new Date(weather.lastUpdated).toLocaleString()}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {weather.forecast.map((day) => (
                  <div
                    key={day.date}
                    className="rounded-xl border border-stone-200 bg-white p-3.5 text-xs"
                  >
                    <p className="font-mono font-semibold text-stone-900 tabular-nums">{day.date}</p>
                    <p className="mt-1 text-stone-600">{day.condition}</p>
                    <p className="mt-2 font-mono font-semibold text-stone-950 tabular-nums">
                      {day.tempMin.toFixed(0)}° – {day.tempMax.toFixed(0)}°C
                    </p>
                    <p className="mt-0.5 font-mono text-emerald-800 tabular-nums">
                      Rain prob: {day.rainProb}%
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {/* Mandi Price Module */}
      <section className="rounded-2xl border border-stone-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-100 pb-4">
          <div>
            <p className="text-xs font-semibold text-amber-800">
              {mandi?.dataLabel || 'DEMONSTRATION DATA'}
            </p>
            <h2 className="mt-0.5 font-display text-2xl font-bold text-stone-950">
              Mandi Market Prices (APMC)
            </h2>
          </div>
          <div className="flex items-center gap-2 text-xs text-stone-500 tabular-nums">
            <IndianRupee className="h-4 w-4 text-emerald-800" aria-hidden="true" />
            <span>
              Last updated: {mandi ? new Date(mandi.lastUpdated).toLocaleString() : '—'}
            </span>
          </div>
        </div>

        {/* Explicit Transparency Banner */}
        {mandi && (
          <div
            className={`mt-4 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-xs font-medium ${
              mandi.isLive
                ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                : 'border-amber-300 bg-amber-50 text-amber-950'
            }`}
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{mandi.notice}</span>
          </div>
        )}

        {/* Filter Controls */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700">Commodity</label>
            <select
              value={commodityFilter}
              onChange={(e) => setCommodityFilter(e.target.value)}
              className="mt-1 min-h-[40px] w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-sm text-stone-950"
            >
              <option value="All">All Commodities</option>
              {mandi?.availableFilters.commodities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-700">State</label>
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="mt-1 min-h-[40px] w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-sm text-stone-950"
            >
              <option value="All">All States</option>
              {mandi?.availableFilters.states.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-700">District</label>
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="mt-1 min-h-[40px] w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-sm text-stone-950"
            >
              <option value="All">All Districts</option>
              {mandi?.availableFilters.districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-700">Market</label>
            <select
              value={marketFilter}
              onChange={(e) => setMarketFilter(e.target.value)}
              className="mt-1 min-h-[40px] w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-sm text-stone-950"
            >
              <option value="All">All Markets</option>
              {mandi?.availableFilters.markets.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Mandi Table */}
        <div className="mt-5 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-y border-stone-200 bg-stone-50/70 text-xs font-semibold text-stone-600">
                <th className="py-3 px-3">Commodity</th>
                <th className="py-3 px-3">Market / District / State</th>
                <th className="py-3 px-3 text-right">Min (₹/Qtl)</th>
                <th className="py-3 px-3 text-right">Max (₹/Qtl)</th>
                <th className="py-3 px-3 text-right">Modal (₹/Qtl)</th>
                <th className="py-3 px-3 text-right">Price Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {mandiLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-stone-500">
                    Loading mandi records...
                  </td>
                </tr>
              ) : !mandi || mandi.records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-stone-500">
                    No mandi records match your selected filters. Try resetting filters to All.
                  </td>
                </tr>
              ) : (
                mandi.records.map((rec, idx) => (
                  <tr key={`${rec.market}-${rec.commodity}-${idx}`} className="hover:bg-stone-50/70">
                    <td className="py-3 px-3 font-semibold text-stone-950">{rec.commodity}</td>
                    <td className="py-3 px-3 text-xs text-stone-700">
                      <span className="font-medium text-stone-900">{rec.market}</span> · {rec.district},{' '}
                      {rec.state}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-stone-700 tabular-nums">
                      ₹{rec.minPrice.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-stone-700 tabular-nums">
                      ₹{rec.maxPrice.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-emerald-900 tabular-nums">
                      ₹{rec.modalPrice.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-xs text-stone-500 tabular-nums">
                      {rec.priceDate}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

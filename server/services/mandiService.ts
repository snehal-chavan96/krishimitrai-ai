import type { MandiRecord, MandiResponse } from '../../src/types.ts';

/**
 * Curated demonstration Mandi dataset.
 * Explicitly labeled DEMONSTRATION DATA with zero external API keys required.
 */
const DEMONSTRATION_MANDI_RECORDS: MandiRecord[] = [
  { commodity: 'Cotton', state: 'Maharashtra', district: 'Akola', market: 'Akola APMC', minPrice: 6850, maxPrice: 7420, modalPrice: 7180, unit: '₹/Quintal', priceDate: '2026-11-24' },
  { commodity: 'Cotton', state: 'Maharashtra', district: 'Nagpur', market: 'Nagpur (Cotton)', minPrice: 6900, maxPrice: 7510, modalPrice: 7250, unit: '₹/Quintal', priceDate: '2026-11-24' },
  { commodity: 'Cotton', state: 'Maharashtra', district: 'Jalgaon', market: 'Jalgaon APMC', minPrice: 6780, maxPrice: 7350, modalPrice: 7100, unit: '₹/Quintal', priceDate: '2026-11-24' },
  { commodity: 'Soybean', state: 'Maharashtra', district: 'Latur', market: 'Latur APMC', minPrice: 4320, maxPrice: 4780, modalPrice: 4590, unit: '₹/Quintal', priceDate: '2026-11-24' },
  { commodity: 'Soybean', state: 'Maharashtra', district: 'Akola', market: 'Akola APMC', minPrice: 4280, maxPrice: 4690, modalPrice: 4520, unit: '₹/Quintal', priceDate: '2026-11-24' },
  { commodity: 'Soybean', state: 'Madhya Pradesh', district: 'Indore', market: 'Indore Krishi Upaj Mandi', minPrice: 4350, maxPrice: 4810, modalPrice: 4610, unit: '₹/Quintal', priceDate: '2026-11-24' },
  { commodity: 'Wheat', state: 'Maharashtra', district: 'Pune', market: 'Pune (Gultekdi)', minPrice: 2680, maxPrice: 3150, modalPrice: 2890, unit: '₹/Quintal', priceDate: '2026-11-24' },
  { commodity: 'Wheat', state: 'Punjab', district: 'Ludhiana', market: 'Ludhiana Grain Market', minPrice: 2425, maxPrice: 2640, modalPrice: 2530, unit: '₹/Quintal', priceDate: '2026-11-24' },
  { commodity: 'Wheat', state: 'Madhya Pradesh', district: 'Indore', market: 'Indore Krishi Upaj Mandi', minPrice: 2520, maxPrice: 2940, modalPrice: 2710, unit: '₹/Quintal', priceDate: '2026-11-24' },
  { commodity: 'Onion', state: 'Maharashtra', district: 'Nashik', market: 'Lasalgaon APMC', minPrice: 1650, maxPrice: 2890, modalPrice: 2340, unit: '₹/Quintal', priceDate: '2026-11-24' },
  { commodity: 'Onion', state: 'Maharashtra', district: 'Pune', market: 'Pune (Gultekdi)', minPrice: 1580, maxPrice: 2720, modalPrice: 2210, unit: '₹/Quintal', priceDate: '2026-11-24' },
  { commodity: 'Tur (Arhar)', state: 'Maharashtra', district: 'Latur', market: 'Latur APMC', minPrice: 8900, maxPrice: 9850, modalPrice: 9420, unit: '₹/Quintal', priceDate: '2026-11-24' },
  { commodity: 'Gram', state: 'Maharashtra', district: 'Akola', market: 'Akola APMC', minPrice: 5850, maxPrice: 6420, modalPrice: 6150, unit: '₹/Quintal', priceDate: '2026-11-24' },
];

export async function getMandiPrices(filters: {
  commodity?: string;
  state?: string;
  district?: string;
  market?: string;
}): Promise<MandiResponse> {
  let filtered = [...DEMONSTRATION_MANDI_RECORDS];

  if (filters.commodity && filters.commodity !== 'All') {
    const c = filters.commodity.toLowerCase();
    filtered = filtered.filter((r) => r.commodity.toLowerCase().includes(c));
  }
  if (filters.state && filters.state !== 'All') {
    const s = filters.state.toLowerCase();
    filtered = filtered.filter((r) => r.state.toLowerCase() === s);
  }
  if (filters.district && filters.district !== 'All') {
    const d = filters.district.toLowerCase();
    filtered = filtered.filter((r) => r.district.toLowerCase() === d);
  }
  if (filters.market && filters.market !== 'All') {
    const m = filters.market.toLowerCase();
    filtered = filtered.filter((r) => r.market.toLowerCase() === m);
  }

  return {
    records: filtered,
    isLive: false,
    dataLabel: 'DEMONSTRATION DATA',
    notice:
      'DEMONSTRATION DATA: Offline reference market dataset for academic prototype demonstration. Verify actual daily APMC auction rates locally before selling.',
    lastUpdated: new Date().toISOString(),
    availableFilters: buildFilterOptions(DEMONSTRATION_MANDI_RECORDS),
  };
}

function buildFilterOptions(records: MandiRecord[]) {
  return {
    commodities: Array.from(new Set(records.map((r) => r.commodity))).sort(),
    states: Array.from(new Set(records.map((r) => r.state))).sort(),
    districts: Array.from(new Set(records.map((r) => r.district))).sort(),
    markets: Array.from(new Set(records.map((r) => r.market))).sort(),
  };
}

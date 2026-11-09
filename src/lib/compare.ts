// "Compare areas over time" (John, November 9th 2026; design/previews/compare/, option A, round 2): up to four council areas,
// counties, regions or countries (or Great Britain) on one chart of average prices, from Refueller's own record
// (data/averages.json). Unleaded, diesel or both; with both, two areas at a time, and the chart can show how much each price has moved
// since the start of the period, as diesel sits far above unleaded on one price scale. Pure functions, shared by the build and the page.
import { keyName, levelKeys, type Averages, type Locality } from './levels.ts';

/** One area's record: [unleaded, diesel] at each collection, in step with the group's times; null where fewer than five stations
 *  sold the fuel. */
export type Series = [number | null, number | null][];
/** A group's file: the collection times (oldest first) and the record of every area in the group. */
export type SeriesGroup = { times: string[]; areas: Record<string, Series> };

/** "South East England" -> "south-east-england", for a file name. */
export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// The records are grouped so that choosing an area tells the website no more than its region (England) or country, as the postcode
// area files do: council areas and counties go with their region or country; regions, countries and Great Britain together.
export function groupOf(key: string, locals: Locality[]): string {
  const kind = key === 'GB' ? 'GB' : key[0];
  const name = key.slice(2);
  const l = kind === 'C' ? locals.find((x) => x[0] === name) : kind === 'K' ? locals.find((x) => x[1] === name) : undefined;
  return l ? slug(l[2] ?? l[3]) : 'national';
}

/** Every group's file, from every collection (scripts/lib/pageData.ts). Areas with no figure at all are left out. */
export function seriesGroups(collections: [string, Averages][], locals: Locality[]): Map<string, SeriesGroup> {
  const keys = new Set<string>();
  for (const [, a] of collections) for (const k of Object.keys(a)) keys.add(k);
  const times = collections.map(([t]) => t);
  const out = new Map<string, SeriesGroup>();
  for (const k of [...keys].sort()) {
    const rows: Series = collections.map(([, a]) => [a[k]?.[0] ?? null, a[k]?.[1] ?? null]);
    if (!rows.some(([u, d]) => u !== null || d !== null)) continue;
    const g = groupOf(k, locals);
    if (!out.has(g)) out.set(g, { times, areas: {} });
    out.get(g)!.areas[k] = rows;
  }
  return out;
}

// ----- What's being compared -----

export type FuelChoice = 'e10' | 'diesel' | 'both';
export type View = 'change' | 'price';
export const MAX_AREAS = 4;
/** Colour slots for the areas other than Great Britain, in the order they're added; Great Britain is always grey. */
export type Slot = 0 | 1 | 2 | 3;

export type Kind = 'C' | 'K' | 'R' | 'N' | 'GB';
export const kindOf = (key: string): Kind => (key === 'GB' ? 'GB' : (key[0] as Kind));
export const KIND_WORD: Record<Kind, string> = { C: 'council area', K: 'county', R: 'region', N: 'country', GB: 'country' };
export const areaName = keyName;

/** Where a visitor comes from: their council area, county, region and Great Britain (or, with no county or region, the country). */
export function defaultKeys(local: Locality | null, has: (key: string) => boolean): string[] {
  if (!local) return ['GB'];
  const [c, k, r, n] = levelKeys(local).reduce<(string | undefined)[]>(
    (acc, key) => {
      acc['CKRN'.indexOf(key[0])] = key;
      return acc;
    },
    [undefined, undefined, undefined, undefined],
  );
  const picked = k || r ? [c, k, r] : [c, n];
  // A level with the same name as the one before it is shown once (Rutland; Greater London the county and the region).
  const out: string[] = [];
  for (const key of picked) if (key && has(key) && !out.some((o) => keyName(o) === keyName(key))) out.push(key);
  return [...out.slice(0, MAX_AREAS - 1), 'GB'];
}

/** The two areas shown with both fuels: the first and Great Britain if it's chosen, otherwise the first two (John, November 9th);
 *  a pair the visitor picked is kept while both are still chosen. */
export function shownPair(keys: string[], pair: string[] | null): string[] {
  if (pair && pair.length === 2 && pair.every((k) => keys.includes(k)) && pair[0] !== pair[1]) return pair;
  if (keys.length <= 2) return keys;
  const first = keys.find((k) => k !== 'GB')!;
  return keys.includes('GB') ? [first, 'GB'] : keys.slice(0, 2);
}
/** Tapping a faded area shows it in place of the other area, keeping Great Britain if it's shown. */
export function swapIn(pair: string[], key: string): string[] {
  const keep = pair.includes('GB') ? 'GB' : pair[0];
  return [key, keep];
}

/** How many areas are chosen: the cheapest of the eight doesn't count towards the four. */
export const areaCount = (keys: string[]) => keys.filter((k) => k !== CHEAPEST).length;
/** The first free colour slot. */
export function freeSlot(slots: Record<string, Slot>, keys: string[]): Slot {
  const used = new Set(keys.filter((k) => k !== 'GB' && k !== CHEAPEST).map((k) => slots[k]));
  return ([0, 1, 2, 3] as Slot[]).find((s) => !used.has(s)) ?? 0;
}
/** Slots for keys that have none (the default choice, or an old saved one), without changing those that have. */
export function withSlots(keys: string[], slots: Record<string, Slot>): Record<string, Slot> {
  const out: Record<string, Slot> = {};
  for (const k of keys) if (k !== 'GB' && k !== CHEAPEST && slots[k] !== undefined) out[k] = slots[k];
  for (const k of keys) if (k !== 'GB' && k !== CHEAPEST && out[k] === undefined) out[k] = freeSlot(out, keys);
  return out;
}

// ----- Periods -----

const DAY = 86_400_000;
// "Only once that whole period is recorded" (John, November 9th): 1 month always; the others once the record covers them.
export const PERIODS = [
  { id: '1m', label: '1 month', days: 30 },
  { id: '3m', label: '3 months', days: 91 },
  { id: '6m', label: '6 months', days: 182 },
  { id: '1y', label: '1 year', days: 365 },
] as const;
export type PeriodId = (typeof PERIODS)[number]['id'];
export function periodsAvailable(firstMs: number, lastMs: number) {
  return PERIODS.filter((p, i) => i === 0 || lastMs - firstMs >= p.days * DAY);
}

// ----- The lines -----

export type Point = { t: number; p: number };
export type Line = { key: string; fuel: 0 | 1; pts: Point[] };

/** One fuel of an area's record within the period (ending at the latest collection), as points. */
export function pointsFor(times: string[], series: Series, fuel: 0 | 1, days: number, lastMs: number): Point[] {
  const from = lastMs - days * DAY;
  return series.flatMap((v, i) => {
    const ms = Date.parse(times[i]);
    const p = v[fuel];
    return ms >= from && ms <= lastMs && p !== null ? [{ t: ms, p }] : [];
  });
}
/** Each price's move since the line's first point in the period. */
export const asChange = (pts: Point[]): Point[] => (pts.length ? pts.map((x) => ({ t: x.t, p: Math.round((x.p - pts[0].p) * 100) / 100 })) : []);

/** "down 3.9p", "up 0.2p", "no change", from the first and last points. */
export function changeWords(pts: Point[]): string {
  if (pts.length < 2) return 'no change';
  const d = Math.round((pts[pts.length - 1].p - pts[0].p) * 10) / 10;
  if (d === 0) return 'no change';
  return `${d < 0 ? 'down' : 'up'} ${Math.abs(d).toFixed(1)}p`;
}
/** "−3.9p", "+0.2p", "0.0p", for the change chart's labels. */
export function signedPence(p: number): string {
  const r = Math.round(p * 10) / 10;
  if (r === 0) return '0.0p';
  return `${r < 0 ? '−' : '+'}${Math.abs(r).toFixed(1)}p`;
}

/** The chart's scale: whole pence at least 0.6p beyond the lines, and the gap between gridlines. */
export function scaleFor(values: number[]): { lo: number; hi: number; step: number } {
  if (!values.length) return { lo: 0, hi: 1, step: 1 };
  const lo = Math.floor(Math.min(...values) - 0.6);
  const hi = Math.ceil(Math.max(...values) + 0.6);
  const span = hi - lo;
  return { lo, hi, step: span > 24 ? 10 : span > 12 ? 5 : span > 6 ? 2 : 1 };
}

// ----- Finding an area by typing -----

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
/** Areas whose name starts with what's typed, then those with a later word starting with it; Great Britain as "Great Britain" or "GB". */
export function matchAreas(keys: string[], typed: string, limit = 5): string[] {
  const q = norm(typed);
  if (q.length < 2) return [];
  const scored = keys.flatMap((k) => {
    const n = norm(areaName(k));
    const score = n === q ? 0 : n.startsWith(q) ? 1 : ` ${n}`.includes(` ${q}`) ? 2 : k === 'GB' && 'gb uk britain'.split(' ').some((w) => w.startsWith(q)) ? 1 : -1;
    return score < 0 ? [] : [{ k, score }];
  });
  const order: Kind[] = ['GB', 'N', 'R', 'K', 'C'];
  return scored
    .sort((a, b) => a.score - b.score || order.indexOf(kindOf(a.k)) - order.indexOf(kindOf(b.k)) || areaName(a.k).localeCompare(areaName(b.k), 'en-GB'))
    .slice(0, limit)
    .map((x) => x.k);
}

// ----- Remembered on this device (John, November 9th: "ideally") -----

export const SAVED = 'refueller.compare';
/** `from`: the page (its address after "#") the choice was made from. A choice made from another place keeps only how the chart is
 *  shown (fuel, change or prices, period); its areas start afresh from the new place (John, November 9th 2026). */
export type Saved = { keys: string[]; slots: Record<string, Slot>; fuel: FuelChoice; view: View; period: PeriodId; pair: string[] | null; from?: string | null };
export function readSaved(raw: string | null, has: (key: string) => boolean): Saved | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Partial<Saved>;
    const all = (Array.isArray(s.keys) ? s.keys : []).filter((k): k is string => typeof k === 'string' && has(k));
    // Up to four areas, and the cheapest of the eight as a fifth (John, November 9th 2026).
    const keys = [...all.filter((k) => k !== CHEAPEST).slice(0, MAX_AREAS), ...all.filter((k) => k === CHEAPEST).slice(0, 1)];
    if (!keys.length) return null;
    return {
      keys,
      slots: withSlots(keys, (s.slots && typeof s.slots === 'object' ? s.slots : {}) as Record<string, Slot>),
      fuel: s.fuel === 'diesel' || s.fuel === 'both' ? s.fuel : 'e10',
      view: s.view === 'price' ? 'price' : 'change',
      period: PERIODS.some((p) => p.id === s.period) ? (s.period as PeriodId) : '1m',
      pair: Array.isArray(s.pair) ? s.pair.filter((k): k is string => typeof k === 'string') : null,
      from: typeof s.from === 'string' ? s.from : null,
    };
  } catch {
    return null;
  }
}

// ----- The cheapest of the eight (John, November 9th 2026: option A, added only when chosen) -----

/** The key the cheapest of the eight stations goes by among the areas. */
export const CHEAPEST = 'S';
/** Kept for the tab by the results page: the station marked cheapest for each fuel (not a members-only Costco), with its prices. */
export const CHEAPEST_KEPT = 'refueller.cheapest';
export type Step = { t: number; p: number };
export type CheapStation = { name: string; steps: Step[] };
export type CheapestKept = { from: string; near: string; e10: CheapStation | null; diesel: CheapStation | null };
export function readCheapest(raw: string | null, from: string | null): CheapestKept | null {
  if (!raw || !from) return null;
  try {
    const c = JSON.parse(raw) as CheapestKept;
    return c && c.from === from && typeof c.near === 'string' ? c : null;
  } catch {
    return null;
  }
}
/** A station's price at each collection in the period, from the moment its price is known. */
export function stepPoints(times: string[], steps: Step[], days: number, lastMs: number): Point[] {
  const from = lastMs - days * DAY;
  return times.flatMap((iso) => {
    const t = Date.parse(iso);
    if (t < from || t > lastMs) return [];
    let p: number | null = null;
    for (const s of steps) if (s.t <= t) p = s.p;
    return p === null ? [] : [{ t, p }];
  });
}

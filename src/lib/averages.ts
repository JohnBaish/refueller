// "Average prices" (John, 1 November 2026): the average unleaded and diesel price at each of our collections, across Great Britain,
// in the postcode area of the place searched, and at the eight stations shown, over the last 30 days as the record builds up.
// The average is the mean (John chose it: prices cluster on ".9" endings, so the middle price moves in whole-penny jumps and hides
// small changes). Prices marked unusual aren't included, as everywhere else (an island's higher price isn't unusual: see
// higherPricesUsual). Pure functions, shared by the build and the page.
import { higherPricesUsual, type Price } from './search.ts';

export const AVERAGE_DAYS = 30;
const DAY = 86_400_000;

type Fuel = 'e10' | 'diesel';
export const FUELS: Fuel[] = ['e10', 'diesel'];

// A price counts in an average unless it's unusual; as on the page, a higher price in the Highlands and Islands or on Scilly isn't.
export const counts = (p: Price | undefined, postcode: string, middle: number | undefined): p is Price =>
  !!p && (!p.x || (higherPricesUsual(postcode) && middle !== undefined && p.p > middle));

// "RG4 7HN" -> "RG": the postcode area.
export const areaOf = (postcode: string) => /^[A-Z]{1,2}/.exec(postcode.trim().toUpperCase())?.[0] ?? '';

const mean = (v: number[]) => (v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 100) / 100 : null);

// One collection's averages: Great Britain ("GB") and each postcode area, [unleaded, diesel] (null where none sells it).
export type Averages = Record<string, [number | null, number | null]>;
export function averagesFor(
  prices: Record<string, { e10?: Price; diesel?: Price }>,
  postcodes: Record<string, string>,
  middle: { e10?: number; diesel?: number } | undefined,
): Averages {
  const groups: Record<string, [number[], number[]]> = { GB: [[], []] };
  for (const [id, p] of Object.entries(prices)) {
    const pc = postcodes[id];
    if (!pc) continue;
    const area = areaOf(pc);
    const g = (groups[area] ??= [[], []]);
    FUELS.forEach((f, i) => {
      if (!counts(p[f], pc, middle?.[f])) return;
      groups.GB[i].push(p[f]!.p);
      g[i].push(p[f]!.p);
    });
  }
  return Object.fromEntries(Object.entries(groups).map(([k, [a, b]]) => [k, [mean(a), mean(b)]]));
}

// The file the page reads: each collection's time and averages, oldest first, only the last 30 days.
export type AveragesFile = { collections: [string, Averages][] };
export function keepRecent(rows: [string, Averages][]): [string, Averages][] {
  const sorted = [...rows].sort((a, b) => Date.parse(a[0]) - Date.parse(b[0]));
  if (!sorted.length) return [];
  const from = Date.parse(sorted[sorted.length - 1][0]) - AVERAGE_DAYS * DAY;
  return sorted.filter(([t]) => Date.parse(t) >= from);
}

export type Point = { t: number; p: number };
// One series for the chart, from the file: an area's (or Great Britain's) average for one fuel at each collection.
export const seriesOf = (file: AveragesFile, key: string, fuel: Fuel): Point[] =>
  file.collections.flatMap(([t, a]) => {
    const v = a[key]?.[FUELS.indexOf(fuel)];
    return v === null || v === undefined ? [] : [{ t: Date.parse(t), p: v }];
  });

// The eight stations' average at each collection time: each station's price in force then (its known prices with the time each was
// set), only once every one that sells the fuel has a known price, as in the price history.
export type Known = { t: number; p: number }[];
export function eightSeries(stations: Known[], times: number[]): Point[] {
  const usable = stations.filter((s) => s.length > 0);
  if (!usable.length) return [];
  const at = (s: Known, t: number) => {
    let p: number | null = null;
    for (const k of s) if (k.t <= t) p = k.p;
    return p;
  };
  return times.flatMap((t) => {
    const ps = usable.map((s) => at(s, t));
    if (ps.some((p) => p === null)) return [];
    return [{ t, p: Math.round(((ps as number[]).reduce((a, b) => a + b, 0) / ps.length) * 100) / 100 }];
  });
}

// "172.5p", from a mean with two decimals.
export const pence1 = (p: number) => `${(Math.round(p * 10) / 10).toFixed(1)}p`;

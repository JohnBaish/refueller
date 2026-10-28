// The collector's rules (PLAN Stage 2), as plain functions with no network, so the checks can run them on made-up
// records shaped like the real ones (design/probe-result-aws-2026-10-27.md). They turn the API's raw stations and prices
// into the two trimmed files the page needs. Nothing here alters a price or a timestamp (the Fair Use policy, SPEC §2a):
// prices are kept or left out by stated rules, and kept ones go through unchanged.
import { DAYS, fuelCode, isObj, toMinutes, type Obj } from './probe.ts';

// Prices outside this range are taken as errors and left out (SPEC Q7; disclosed in "About these figures").
export const MIN_PENCE = 100;
export const MAX_PENCE = 300;
// A price more than this far from the middle price in Great Britain is marked "unusual" (John, 28 October: shown, with a
// note and the Report a Discrepancy link, and never marked cheapest). Provisional: to be set after a few weeks of prices.
export const UNUSUAL_PENCE = 30;
// The two fuels shown (SPEC Q6), and their short names in the files.
export const FUELS = { E10: 'e10', B7_STANDARD: 'diesel' } as const;
type FuelKey = (typeof FUELS)[keyof typeof FUELS];

// Great Britain only (SPEC Q12): Northern Ireland (BT) is left out, and so are the Isle of Man and the Channel Islands
// (IM, GY, JE), which aren't in Great Britain either. Decided by postcode, because the API's `country` field is unreliable.
const NOT_GB = /^(BT|IM|GY|JE)\d/;
export function inGreatBritain(postcode: unknown): boolean {
  if (typeof postcode !== 'string') return false;
  const pc = postcode.replace(/\s+/g, '').toUpperCase();
  return /^[A-Z]{1,2}\d/.test(pc) && !NOT_GB.test(pc);
}

// --- Opening hours -----------------------------------------------------------------------------------------------------

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

// One day as "06:00-22:00", "24h" or "closed"; null when it can't be read. Seconds are dropped (the data has times such
// as 23:00:01). A close time earlier than the open time runs past midnight and is kept as given ("22:00-02:00").
// 00:00 to 00:00 without the 24-hour flag reads as "closed" (SPEC Q14, John, 28 October).
export function dayEntry(day: unknown): string | null {
  if (!isObj(day)) return null;
  if (day.is_24_hours === true) return '24h';
  const o = toMinutes(day.open ?? day.open_time);
  const c = toMinutes(day.close ?? day.close_time);
  if (o === null || c === null) return null;
  if (o === 0 && c === 0) return 'closed';
  if (o === c) return null;
  return `${hhmm(o % 1440)}-${hhmm(c % 1440)}`;
}

// The seven usual days, Monday first, or null for "opening hours not given": every day 00:00 to 00:00 (SPEC Q14), or any
// day missing or unreadable.
export function weekHours(station: Obj): string[] | null {
  const ot = station.opening_times;
  const ud = isObj(ot) && isObj(ot.usual_days) ? ot.usual_days : null;
  if (!ud) return null;
  const days = DAYS.map((d) => dayEntry(ud[d]));
  if (days.some((d) => d === null)) return null;
  if (days.every((d) => d === 'closed')) return null;
  return days as string[];
}

// The bank-holiday entry, kept with its `type` as given ("bank holiday" or "standard"; the API doesn't explain the
// difference, so the page decides how to use it).
export function bankHoliday(station: Obj): { type: string; hours: string | null } | null {
  const ot = station.opening_times;
  const bh = isObj(ot) && isObj(ot.bank_holiday) ? ot.bank_holiday : null;
  if (!bh) return null;
  return { type: typeof bh.type === 'string' ? bh.type : '', hours: dayEntry(bh) };
}

// --- Closures ---------------------------------------------------------------------------------------------------------

// Permanently closed now: the flag is true and the date (if any) has passed. A future date means still open until then.
export function permanentlyClosed(station: Obj, now: number): boolean {
  const date = station.permanent_closure_date;
  if (typeof date === 'string' && date !== '') {
    const t = Date.parse(date);
    if (Number.isFinite(t)) return t <= now;
  }
  return station.permanent_closure === true;
}

// --- The two files ---------------------------------------------------------------------------------------------------

export type Price = { p: number; u: string; x?: 1 };
export type StationOut = {
  id: string;
  name: string;
  brand: string;
  address: string[];
  postcode: string;
  lat: number;
  lon: number;
  hours: string[] | null;
  bankHoliday: { type: string; hours: string | null } | null;
  temporarilyClosed?: true;
  motorway?: true;
  supermarket?: true;
};

export type Counts = {
  stationsFetched: number;
  priceRecordsFetched: number;
  outsideGreatBritain: number;
  permanentlyClosed: number;
  noUsablePosition: number;
  noPriceForEitherFuel: number;
  pricesOutsideRange: number;
  stationsKept: number;
  e10Prices: number;
  dieselPrices: number;
  unusualPrices: number;
  hoursNotGiven: number;
  temporarilyClosed: number;
};

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

// The middle value of a list (the average of the two middle ones when the count is even).
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : Math.round(((s[mid - 1] + s[mid]) / 2) * 100) / 100;
}

// A short key for each station, so the prices file doesn't repeat 64-character codes: the first 12 characters of
// `node_id`, or the whole code for any that would clash.
export function shortIds(ids: string[]): Map<string, string> {
  const seen = new Map<string, number>();
  for (const id of ids) seen.set(id.slice(0, 12), (seen.get(id.slice(0, 12)) ?? 0) + 1);
  return new Map(ids.map((id) => [id, seen.get(id.slice(0, 12)) === 1 ? id.slice(0, 12) : id]));
}

export function clean(stations: Obj[], priceRecords: Obj[], now: number) {
  const counts: Counts = {
    stationsFetched: stations.length,
    priceRecordsFetched: priceRecords.length,
    outsideGreatBritain: 0,
    permanentlyClosed: 0,
    noUsablePosition: 0,
    noPriceForEitherFuel: 0,
    pricesOutsideRange: 0,
    stationsKept: 0,
    e10Prices: 0,
    dieselPrices: 0,
    unusualPrices: 0,
    hoursNotGiven: 0,
    temporarilyClosed: 0,
  };

  // Each station's E10 and standard diesel prices, as given (fuel codes matched without regard to case).
  const pricesById = new Map<string, Partial<Record<FuelKey, Price>>>();
  for (const r of priceRecords) {
    const id = str(r.node_id);
    if (id === '' || !Array.isArray(r.fuel_prices)) continue;
    const mine: Partial<Record<FuelKey, Price>> = {};
    for (const fp of r.fuel_prices) {
      if (!isObj(fp)) continue;
      const key = FUELS[fuelCode(fp.fuel_type) as keyof typeof FUELS];
      if (!key) continue;
      const p = fp.price;
      if (typeof p !== 'number' || !Number.isFinite(p) || p < MIN_PENCE || p > MAX_PENCE) {
        counts.pricesOutsideRange++;
        continue;
      }
      mine[key] = { p, u: str(fp.price_last_updated) };
    }
    pricesById.set(id, mine);
  }

  const kept: { out: StationOut; prices: Partial<Record<FuelKey, Price>> }[] = [];
  const seen = new Set<string>();
  for (const s of stations) {
    const id = str(s.node_id);
    if (id === '' || seen.has(id)) continue;
    seen.add(id);
    const loc = isObj(s.location) ? s.location : {};
    if (!inGreatBritain(loc.postcode)) {
      counts.outsideGreatBritain++;
      continue;
    }
    if (permanentlyClosed(s, now)) {
      counts.permanentlyClosed++;
      continue;
    }
    const lat = loc.latitude;
    const lon = loc.longitude;
    // A rough box round Great Britain; the closer check against the postcode comes with the postcode data (Stage 3).
    if (typeof lat !== 'number' || typeof lon !== 'number' || lat < 49.8 || lat > 61 || lon < -8.7 || lon > 2) {
      counts.noUsablePosition++;
      continue;
    }
    const prices = pricesById.get(id) ?? {};
    if (!prices.e10 && !prices.diesel) {
      counts.noPriceForEitherFuel++;
      continue;
    }
    const hours = weekHours(s);
    if (hours === null) counts.hoursNotGiven++;
    const out: StationOut = {
      id,
      name: str(s.trading_name),
      brand: str(s.brand_name),
      address: [str(loc.address_line_1), str(loc.address_line_2), str(loc.city)].filter((x) => x !== ''),
      postcode: str(loc.postcode).toUpperCase(),
      lat: round5(lat),
      lon: round5(lon),
      hours,
      bankHoliday: bankHoliday(s),
    };
    if (s.temporary_closure === true) {
      out.temporarilyClosed = true;
      counts.temporarilyClosed++;
    }
    if (s.is_motorway_service_station === true) out.motorway = true;
    if (s.is_supermarket_service_station === true) out.supermarket = true;
    kept.push({ out, prices });
  }

  // The middle price of each fuel across the kept stations, and the "unusual" marks.
  const middle = {
    e10: median(kept.flatMap((k) => (k.prices.e10 ? [k.prices.e10.p] : []))),
    diesel: median(kept.flatMap((k) => (k.prices.diesel ? [k.prices.diesel.p] : []))),
  };
  const keys = shortIds(kept.map((k) => k.out.id));
  const priceMap: Record<string, Partial<Record<FuelKey, Price>>> = {};
  for (const k of kept) {
    const entry: Partial<Record<FuelKey, Price>> = {};
    for (const fuel of ['e10', 'diesel'] as const) {
      const pr = k.prices[fuel];
      if (!pr) continue;
      const m = middle[fuel];
      const price: Price = { p: pr.p, u: pr.u };
      if (m !== null && Math.abs(pr.p - m) > UNUSUAL_PENCE) {
        price.x = 1;
        counts.unusualPrices++;
      }
      entry[fuel] = price;
      if (fuel === 'e10') counts.e10Prices++;
      else counts.dieselPrices++;
    }
    priceMap[keys.get(k.out.id)!] = entry;
  }
  counts.stationsKept = kept.length;

  const stationsOut = kept.map((k) => ({ ...k.out, id: keys.get(k.out.id)! })).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { stations: stationsOut, prices: priceMap, middle, counts };
}

// The newest "last updated" time among the kept prices, as given.
export function newestPrice(prices: Record<string, Partial<Record<FuelKey, Price>>>): string | null {
  let best: string | null = null;
  let bestT = -Infinity;
  for (const entry of Object.values(prices)) {
    for (const pr of Object.values(entry)) {
      const t = Date.parse(pr.u);
      if (Number.isFinite(t) && t > bestT) {
        bestT = t;
        best = pr.u;
      }
    }
  }
  return best;
}

// GOV.UK's bank-holidays feed, cut down to the dates from this year on for England and Wales, and for Scotland.
export function bankHolidayDates(feed: unknown, now: number): Record<string, string[]> | null {
  if (!isObj(feed)) return null;
  const from = `${new Date(now).getUTCFullYear()}-01-01`;
  const out: Record<string, string[]> = {};
  for (const division of ['england-and-wales', 'scotland']) {
    const d = feed[division];
    if (!isObj(d) || !Array.isArray(d.events)) return null;
    out[division] = d.events
      .map((e) => (isObj(e) && typeof e.date === 'string' ? e.date : ''))
      .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= from)
      .sort();
  }
  return out;
}

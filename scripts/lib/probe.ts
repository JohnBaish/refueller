// Pure helpers for the Fuel Finder probe (PLAN Stage 1): no network, no secrets.
// They turn raw API records into counts and shapes only, because the repo is public
// and so are its Actions logs (SPEC §2a: no raw API data is ever published).
import { gzipSync } from 'node:zlib';

export type Obj = Record<string, unknown>;

export const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
export const typeOf = (v: unknown): string => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);

// --- Where a secret may be sent --------------------------------------------------

// Government hosts only. The real host is not yet known: the handover says the first, the
// portal's generic example the second (SPEC §2a). A secret is never sent anywhere else.
export const CANDIDATE_HOSTS = [
  'https://www.fuel-finder.service.gov.uk',
  'https://api.fuelfinder.service.gov.uk',
  'https://api.fuel-finder.service.gov.uk',
];

// `allowLocal` is for the checks only: it lets a test server on this machine stand in.
export function hostAllowed(url: string, allowLocal = false): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.username !== '' || u.password !== '') return false;
  if (allowLocal && u.protocol === 'http:' && (u.hostname === '127.0.0.1' || u.hostname === 'localhost')) return true;
  if (u.protocol !== 'https:' || u.port !== '') return false;
  return CANDIDATE_HOSTS.some((h) => new URL(h).hostname === u.hostname);
}

// Last line of defence for anything about to be printed.
export function redact(text: string, secrets: string[]): string {
  let out = text;
  for (const s of secrets) {
    if (s.length >= 6) out = out.split(s).join('***');
  }
  return out;
}

// --- Small statistics --------------------------------------------------------------

export function bump(map: Record<string, number>, key: string, by = 1): void {
  map[key] = (map[key] ?? 0) + by;
}

export function top(map: Record<string, number>, n: number): Record<string, number> {
  return Object.fromEntries(Object.entries(map).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n));
}

// Nearest-rank percentile of an already sorted list.
export function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[rank - 1];
}

// --- Opening hours ---------------------------------------------------------------------

export const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

// "06:00", "06:00:01" and "6:00" all read as minutes after midnight; seconds are ignored
// (the sample data has times a second out, such as 23:00:01).
export function toMinutes(v: unknown): number | null {
  if (typeof v !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(v.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 24 || mi > 59) return null;
  return h * 60 + mi;
}

export function timeFormat(v: unknown): string {
  if (typeof v !== 'string') return 'missing';
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(v)) return 'HH:MM:SS';
  if (/^\d{1,2}:\d{2}$/.test(v)) return 'HH:MM';
  return 'other';
}

export type DayClass = 'missing' | '24h' | 'zero-zero' | 'same-time' | 'past-midnight' | 'normal' | 'unparseable';

// "zero-zero" is 00:00 to 00:00 without the 24-hour flag, which probably means closed that
// day (or no hours entered): SPEC Q14.
export function classifyDay(day: unknown): DayClass {
  if (!isObj(day)) return 'missing';
  if (day.is_24_hours === true) return '24h';
  const o = toMinutes(day.open ?? day.open_time);
  const c = toMinutes(day.close ?? day.close_time);
  if (o === null || c === null) return 'unparseable';
  if (o === c) return o === 0 ? 'zero-zero' : 'same-time';
  return c < o ? 'past-midnight' : 'normal';
}

export type HoursClass = 'no-hours' | 'incomplete' | 'all-24h' | 'all-zero-zero' | 'some-zero-zero' | 'ordinary';

export function classifyHours(station: Obj): HoursClass {
  const ot = station.opening_times;
  const ud = isObj(ot) && isObj(ot.usual_days) ? ot.usual_days : null;
  if (!ud) return 'no-hours';
  const classes = DAYS.map((d) => classifyDay(ud[d]));
  if (classes.some((c) => c === 'missing' || c === 'unparseable')) return 'incomplete';
  if (classes.every((c) => c === '24h')) return 'all-24h';
  const zeros = classes.filter((c) => c === 'zero-zero').length;
  if (zeros === 7) return 'all-zero-zero';
  if (zeros > 0) return 'some-zero-zero';
  return 'ordinary';
}

// --- Stations ------------------------------------------------------------------------------

const TEST_NAME = /\b(test|dummy|sample|csvprice|forecourt \d+)\b/i;
const GB_COUNTRIES = new Set(['ENGLAND', 'SCOTLAND', 'WALES']);

export const fuelCode = (v: unknown): string => String(v ?? '').trim().toUpperCase();

function keyShapes(records: Obj[], limit = 60): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const r of records) {
    for (const [k, v] of Object.entries(r)) {
      if (!(k in out) && Object.keys(out).length >= limit) continue;
      out[k] ??= {};
      bump(out[k], typeOf(v));
    }
  }
  return out;
}

export function summariseStations(stations: Obj[]) {
  const ids: Record<string, number> = {};
  const countries: Record<string, number> = {};
  const permanent: Record<string, number> = {};
  const hours: Record<string, number> = {};
  const dayClasses: Record<string, number> = {};
  const timeFormats: Record<string, number> = {};
  const bankType: Record<string, number> = {};
  const bankKeys: Record<string, number> = {};
  const fuelTypesShape: Record<string, number> = {};
  const fuelCodes: Record<string, number> = {};
  const amenities: Record<string, number> = {};
  const locationKeys: Record<string, Record<string, number>> = {};
  const testNames: string[] = [];
  let duplicates = 0;
  let testLike = 0;
  let temporaryClosed = 0;
  let permanentTrue = 0;
  let permanentFutureDate = 0;
  let motorway = 0;
  let supermarket = 0;
  let noPostcode = 0;
  let noPosition = 0;
  let outsideUk = 0;
  let nullCounty = 0;
  let emptyAmenities = 0;
  let wholeAddressInLine1 = 0;
  let noBankHoliday = 0;

  for (const s of stations) {
    const id = String(s.node_id ?? '');
    if (id in ids) duplicates++;
    bump(ids, id);

    const name = String(s.trading_name ?? '');
    if (TEST_NAME.test(name) || TEST_NAME.test(String(s.brand_name ?? ''))) {
      testLike++;
      if (testNames.length < 5) testNames.push(name.slice(0, 40));
    }

    const loc = isObj(s.location) ? s.location : {};
    for (const [k, v] of Object.entries(loc)) {
      locationKeys[k] ??= {};
      bump(locationKeys[k], typeOf(v));
    }
    bump(countries, String(loc.country ?? 'MISSING').trim().toUpperCase());
    if (loc.county === null || loc.county === undefined || loc.county === '') nullCounty++;
    if (typeof loc.postcode !== 'string' || loc.postcode.trim() === '') noPostcode++;
    const lat = loc.latitude;
    const lon = loc.longitude;
    if (typeof lat !== 'number' || typeof lon !== 'number' || (lat === 0 && lon === 0)) noPosition++;
    else if (lat < 49 || lat > 61 || lon < -11 || lon > 2.5) outsideUk++;
    const line1 = String(loc.address_line_1 ?? '');
    if (typeof loc.postcode === 'string' && loc.postcode !== '' && line1.toUpperCase().includes(loc.postcode.toUpperCase())) {
      wholeAddressInLine1++;
    }

    if (s.temporary_closure === true) temporaryClosed++;
    bump(permanent, String(s.permanent_closure));
    if (s.permanent_closure === true) {
      permanentTrue++;
      if (typeof s.permanent_closure_date === 'string' && Date.parse(s.permanent_closure_date) > Date.now()) permanentFutureDate++;
    }
    if (s.is_motorway_service_station === true) motorway++;
    if (s.is_supermarket_service_station === true) supermarket++;

    const am = s.amenities;
    if (Array.isArray(am)) {
      if (am.length === 0) emptyAmenities++;
      for (const a of am) bump(amenities, String(a));
    }

    const ft = s.fuel_types;
    bump(fuelTypesShape, typeOf(ft));
    if (Array.isArray(ft)) for (const c of ft) bump(fuelCodes, String(c));
    else if (isObj(ft)) for (const [c, v] of Object.entries(ft)) if (v === true) bump(fuelCodes, `${c} (flag)`);

    bump(hours, classifyHours(s));
    const ot = isObj(s.opening_times) ? s.opening_times : {};
    const ud = isObj(ot.usual_days) ? ot.usual_days : {};
    for (const d of DAYS) {
      const day = ud[d];
      bump(dayClasses, classifyDay(day));
      if (isObj(day)) {
        bump(timeFormats, timeFormat(day.open));
        bump(timeFormats, timeFormat(day.close));
      }
    }
    const bh = ot.bank_holiday ?? ot.bank_holidays;
    if (bh === undefined || bh === null) noBankHoliday++;
    else {
      bump(bankKeys, 'bank_holiday' in ot ? 'bank_holiday' : 'bank_holidays');
      const first = Array.isArray(bh) ? bh[0] : bh;
      if (isObj(first)) bump(bankType, String(first.type ?? 'MISSING'));
    }
  }

  return {
    total: stations.length,
    uniqueIds: Object.keys(ids).length,
    duplicateIds: duplicates,
    topLevelKeyTypes: keyShapes(stations),
    locationKeyTypes: locationKeys,
    countries: top(countries, 12),
    gbStations: Object.entries(countries).filter(([c]) => GB_COUNTRIES.has(c)).reduce((n, [, v]) => n + v, 0),
    permanentClosure: permanent,
    permanentClosureTrue: permanentTrue,
    permanentClosureWithFutureDate: permanentFutureDate,
    temporaryClosureTrue: temporaryClosed,
    motorwayTrue: motorway,
    supermarketTrue: supermarket,
    noPostcode,
    noPosition,
    positionOutsideUk: outsideUk,
    nullOrEmptyCounty: nullCounty,
    postcodeInsideAddressLine1: wholeAddressInLine1,
    testLikeNames: testLike,
    testLikeExamples: testNames,
    fuelTypesShape,
    fuelCodeCounts: top(fuelCodes, 20),
    amenityCounts: top(amenities, 20),
    emptyAmenityLists: emptyAmenities,
    hoursClasses: hours,
    dayClasses,
    timeFormats,
    bankHolidayKey: bankKeys,
    bankHolidayType: bankType,
    noBankHolidayEntry: noBankHoliday,
  };
}

// --- Prices ---------------------------------------------------------------------------------

const ISO_Z = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const REPORTED = ['E10', 'E5', 'B7_STANDARD', 'B7_PREMIUM', 'B10', 'HVO'];

function stats(values: number[]) {
  const v = [...values].sort((a, b) => a - b);
  return {
    count: v.length,
    min: v[0] ?? null,
    p1: percentile(v, 1),
    p50: percentile(v, 50),
    p99: percentile(v, 99),
    max: v[v.length - 1] ?? null,
    outside100to300: v.filter((x) => x < 100 || x > 300).length,
    nonPositive: v.filter((x) => x <= 0).length,
  };
}

export function summarisePrices(prices: Obj[], stations: Obj[], nowMs: number) {
  const stationIds = new Set(stations.map((s) => String(s.node_id ?? '')));
  const priceIds: Record<string, number> = {};
  const rawFuelSpellings: Record<string, number> = {};
  const priceTypes: Record<string, number> = {};
  const entryKeys: Record<string, number> = {};
  const byCode: Record<string, number[]> = {};
  const ageHours: Record<string, number[]> = {};
  const withPrice: Record<string, Set<string>> = {};
  let duplicates = 0;
  let badTimestamps = 0;
  let futureTimestamps = 0;
  let effectiveAfterUpdated = 0;
  let stationsWithNoPriceList = 0;
  let olderThan7Days = 0;
  let pricedEntries = 0;

  for (const p of prices) {
    const id = String(p.node_id ?? '');
    if (id in priceIds) duplicates++;
    bump(priceIds, id);
    const list = Array.isArray(p.fuel_prices) ? p.fuel_prices : null;
    if (!list || list.length === 0) stationsWithNoPriceList++;
    for (const e of list ?? []) {
      if (!isObj(e)) continue;
      pricedEntries++;
      for (const k of Object.keys(e)) bump(entryKeys, k);
      bump(rawFuelSpellings, String(e.fuel_type));
      bump(priceTypes, typeOf(e.price));
      const code = fuelCode(e.fuel_type);
      (withPrice[code] ??= new Set()).add(id);
      if (typeof e.price === 'number') (byCode[code] ??= []).push(e.price);
      const upd = typeof e.price_last_updated === 'string' ? e.price_last_updated : '';
      const eff = typeof e.price_change_effective_timestamp === 'string' ? e.price_change_effective_timestamp : '';
      if (!ISO_Z.test(upd) || !ISO_Z.test(eff)) badTimestamps++;
      const t = Date.parse(upd);
      if (Number.isFinite(t)) {
        if (t > nowMs + 5 * 60_000) futureTimestamps++;
        else {
          const h = (nowMs - t) / 3_600_000;
          (ageHours[code] ??= []).push(h);
          if (h > 24 * 7) olderThan7Days++;
        }
        const te = Date.parse(eff);
        if (Number.isFinite(te) && te > t) effectiveAfterUpdated++;
      }
    }
  }

  const priceStats: Record<string, ReturnType<typeof stats>> = {};
  for (const c of REPORTED) if (byCode[c]) priceStats[c] = stats(byCode[c]);
  const otherCodes = Object.keys(byCode).filter((c) => !REPORTED.includes(c));
  const ages: Record<string, { count: number; p50: number | null; p90: number | null; p99: number | null; max: number | null }> = {};
  for (const c of ['E10', 'B7_STANDARD']) {
    const a = [...(ageHours[c] ?? [])].sort((x, y) => x - y);
    ages[c] = { count: a.length, p50: percentile(a, 50), p90: percentile(a, 90), p99: percentile(a, 99), max: a[a.length - 1] ?? null };
  }

  const priceIdSet = new Set(Object.keys(priceIds));
  let stationsWithoutPrices = 0;
  for (const id of stationIds) if (!priceIdSet.has(id)) stationsWithoutPrices++;
  let pricesWithoutStation = 0;
  for (const id of priceIdSet) if (!stationIds.has(id)) pricesWithoutStation++;
  const known = (code: string) => [...(withPrice[code] ?? [])].filter((id) => stationIds.has(id));
  const both = known('E10').filter((id) => withPrice.B7_STANDARD?.has(id)).length;

  // Does a station's fuel_types list agree with the prices it has?
  const listed = (s: Obj, code: string) => Array.isArray(s.fuel_types) && s.fuel_types.some((c) => fuelCode(c) === code);
  const agree: Record<string, { listedWithoutPrice: number; priceNotListed: number }> = {};
  for (const code of ['E10', 'B7_STANDARD']) {
    let listedWithoutPrice = 0;
    let priceNotListed = 0;
    for (const s of stations) {
      const id = String(s.node_id ?? '');
      const has = withPrice[code]?.has(id) ?? false;
      const l = listed(s, code);
      if (l && !has) listedWithoutPrice++;
      if (has && !l) priceNotListed++;
    }
    agree[code] = { listedWithoutPrice, priceNotListed };
  }

  return {
    records: prices.length,
    uniqueIds: priceIdSet.size,
    duplicateIds: duplicates,
    recordsWithNoPriceList: stationsWithNoPriceList,
    priceEntries: pricedEntries,
    entryKeys,
    fuelTypeSpellings: top(rawFuelSpellings, 20),
    priceTypes,
    otherFuelCodes: otherCodes,
    priceStats,
    badOrUnexpectedTimestampFormat: badTimestamps,
    timestampsInFuture: futureTimestamps,
    effectiveAfterLastUpdated: effectiveAfterUpdated,
    entriesOlderThan7Days: olderThan7Days,
    ageHours: ages,
    join: {
      stationsWithoutAnyPriceRecord: stationsWithoutPrices,
      priceRecordsWithoutStation: pricesWithoutStation,
      stationsWithE10Price: known('E10').length,
      stationsWithDieselPrice: known('B7_STANDARD').length,
      stationsWithBoth: both,
      fuelTypesListVersusPrices: agree,
    },
  };
}

// --- How big would the page's data file be? ----------------------------------------------

function compactHours(s: Obj): string {
  const ot = isObj(s.opening_times) ? s.opening_times : {};
  const ud = isObj(ot.usual_days) ? ot.usual_days : {};
  const one = (d: unknown): string => {
    if (!isObj(d)) return '-';
    if (d.is_24_hours === true) return '24';
    const o = toMinutes(d.open);
    const c = toMinutes(d.close);
    return o === null || c === null ? '-' : `${o}-${c}`;
  };
  const bh = ot.bank_holiday ?? ot.bank_holidays;
  return [...DAYS.map((d) => one(ud[d])), one(Array.isArray(bh) ? bh[0] : bh)].join(',');
}

// A rough size for the one trimmed file the page would load: stations that have an unleaded or
// diesel price, with only the fields the page shows. An estimate to size things, not the format.
export function trimmedSizeEstimate(stations: Obj[], prices: Obj[]) {
  const byId = new Map<string, Obj>();
  for (const p of prices) byId.set(String(p.node_id ?? ''), p);
  const rows: unknown[] = [];
  for (const s of stations) {
    const loc = isObj(s.location) ? s.location : {};
    if (typeof loc.latitude !== 'number' || typeof loc.longitude !== 'number') continue;
    if (!GB_COUNTRIES.has(String(loc.country ?? '').trim().toUpperCase())) continue;
    const list = byId.get(String(s.node_id ?? ''))?.fuel_prices;
    if (!Array.isArray(list)) continue;
    const find = (code: string) => list.find((e) => isObj(e) && fuelCode(e.fuel_type) === code);
    const e10 = find('E10');
    const b7 = find('B7_STANDARD');
    if (!e10 && !b7) continue;
    const pr = (e: unknown) => (isObj(e) ? [e.price, Math.round(Date.parse(String(e.price_last_updated)) / 60_000)] : null);
    rows.push([
      String(s.trading_name ?? '').slice(0, 40),
      String(s.brand_name ?? '').slice(0, 24),
      String(loc.postcode ?? ''),
      Math.round(loc.latitude * 1e5) / 1e5,
      Math.round(loc.longitude * 1e5) / 1e5,
      compactHours(s),
      pr(e10),
      pr(b7),
    ]);
  }
  const json = JSON.stringify(rows);
  return { stationsInFile: rows.length, jsonBytes: Buffer.byteLength(json), gzipBytes: gzipSync(json).length };
}

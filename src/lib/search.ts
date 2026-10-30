// The page's search rules (PLAN Stage 3), as plain functions with no network and no page code, so the checks can run them.
// Everything here runs in the visitor's browser: the postcode never leaves the page.
//
// Agreed with John: the eight nearest stations from the middle of the postcode district (SPEC Q4 A), whether open or not
// (30 October: a closed one says "Closed until 7am tomorrow"); temporarily closed stations left out; straight-line miles,
// one decimal place for less than five miles (Q5); the cheapest unleaded and diesel marked, never an unusual price; a price
// more than 30 days old shown in a stronger colour; times as "9.30am".

export type Station = {
  id: string;
  name: string;
  brand: string;
  address: string[];
  postcode: string;
  lat: number;
  lon: number;
  hours: string[] | null; // Monday first: "06:00-22:00", "24h" or "closed"; null = not given
  bankHoliday: { type: string; hours: string | null } | null;
  temporarilyClosed?: true;
  motorway?: true;
  supermarket?: true;
};
export type Price = { p: number; u: string; x?: 1 };
export type Prices = Record<string, { e10?: Price; diesel?: Price }>;
export type BankHolidays = Record<string, string[]>; // "england-and-wales", "scotland": "YYYY-MM-DD"
export type Outcodes = Record<string, [number, number, string]>; // latitude, longitude, main place

// --- Postcodes ---------------------------------------------------------------------------------------------------------

export type PostcodeResult = { ok: true; outcode: string } | { ok: false; problem: 'empty' | 'not-a-postcode' | 'northern-ireland' | 'not-found' };

// The first half of a typed postcode: "rg4 7hn", "RG47HN" and "RG4" all give "RG4". Only the first half is ever used.
export function readPostcode(typed: string, outcodes: Outcodes): PostcodeResult {
  const s = typed.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (s === '') return { ok: false, problem: 'empty' };
  let outcode: string;
  if (/^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(s)) outcode = s.slice(0, -3);
  else if (/^[A-Z]{1,2}\d[A-Z\d]?$/.test(s)) outcode = s;
  else return { ok: false, problem: 'not-a-postcode' };
  if (/^BT\d/.test(outcode)) return { ok: false, problem: 'northern-ireland' };
  return outcode in outcodes ? { ok: true, outcode } : { ok: false, problem: 'not-found' };
}

// --- Distances ---------------------------------------------------------------------------------------------------------

export function milesBetween(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * 3958.8 * Math.asin(Math.sqrt(a));
}

// "0.4 miles", "1 mile" is never needed below 5 (one decimal: "1.0 miles"), "12 miles"; "less than 0.1 miles" for very close.
export function milesText(m: number): string {
  if (m < 0.05) return 'less than 0.1 miles';
  if (m < 5) return `${(Math.round(m * 10) / 10).toFixed(1)} miles`;
  const whole = Math.round(m);
  return `${whole} mile${whole === 1 ? '' : 's'}`;
}

// The first half of a station's postcode, whether Fuel Finder gives it with a space ("CW1 3HD") or without ("CW13HD").
export function outcodeOf(postcode: string): string {
  const s = postcode.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return s.length > 4 ? s.slice(0, -3) : s;
}

// A station whose position is far from its own postcode district is left out (SPEC §2a item 4: disclosed on the page).
// The Highlands and Islands have districts tens of miles across (Shetland's ZE2 spans several islands), so they get more room.
// On 30 October this left out 5 of 7,535 stations, each placed 30 to 97 miles from its postcode district.
export const POSITION_CHECK_MILES = 25;
export const POSITION_CHECK_MILES_REMOTE = 60;
const REMOTE = /^(ZE|HS|KW|IV|PA|PH)\d/;
export function positionAgrees(s: Station, outcodes: Outcodes): boolean {
  const o = outcodeOf(s.postcode);
  const c = outcodes[o];
  if (!c) return true; // a district we don't know (a mistyped postcode, say): nothing to compare with
  return milesBetween(s.lat, s.lon, c[0], c[1]) <= (REMOTE.test(o) ? POSITION_CHECK_MILES_REMOTE : POSITION_CHECK_MILES);
}

// --- UK clock time -----------------------------------------------------------------------------------------------------

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// The UK date, weekday (0 = Monday) and minutes after midnight at a moment.
export function ukNow(ms: number): { date: string; day: number; mins: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(ms))
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(parts.weekday),
    mins: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

// The calendar date `n` days after a "YYYY-MM-DD" date.
function addDays(date: string, n: number): string {
  const t = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) + n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

// Scotland's bank holidays differ from England and Wales's. Decided by the station's postcode area (TD15, Berwick, is English).
const SCOTTISH = /^(AB|DD|DG|EH|FK|G|HS|IV|KA|KW|KY|ML|PA|PH|ZE)\d|^TD(?!15$)\d/;
export const division = (postcode: string) => (SCOTTISH.test(outcodeOf(postcode)) ? 'scotland' : 'england-and-wales');

const toMins = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

// The station's hours on a given date: its bank-holiday entry on a bank holiday (when it has one), otherwise the usual
// day's. "06:00-22:00", "24h", "closed", or null when not given.
export function hoursOn(s: Station, date: string, day: number, bank: BankHolidays): string | null {
  if (!s.hours) return null;
  if (s.bankHoliday?.hours && (bank[division(s.postcode)] ?? []).includes(date)) return s.bankHoliday.hours;
  return s.hours[day];
}

export type OpenState =
  | { open: true; until: 'always' | string } // "22:30"; "always" when open all day and the next day too
  | { open: false; next: { days: number; time: string; weekday: string } | null }
  | { open: null }; // hours not given

// Open now, and until when; or closed, and when it next opens (looking up to a week ahead). Hours that run past midnight
// ("22:00-02:00") count on the next morning too.
export function openState(s: Station, ms: number, bank: BankHolidays): OpenState {
  if (!s.hours) return { open: null };
  const { date, day, mins } = ukNow(ms);
  const yesterday = hoursOn(s, addDays(date, -1), (day + 6) % 7, bank);
  if (yesterday && yesterday.includes('-')) {
    const [o, c] = yesterday.split('-').map(toMins);
    if (c < o && mins < c) return { open: true, until: yesterday.split('-')[1] };
  }
  const today = hoursOn(s, date, day, bank);
  if (today === '24h') {
    const tomorrow = hoursOn(s, addDays(date, 1), (day + 1) % 7, bank);
    return { open: true, until: tomorrow === '24h' || tomorrow?.startsWith('00:00-') ? 'always' : '24:00' };
  }
  if (today && today.includes('-')) {
    const [o, c] = today.split('-').map(toMins);
    if (c > o ? mins >= o && mins < c : mins >= o) return { open: true, until: today.split('-')[1] };
  }
  for (let d = 0; d <= 7; d++) {
    const h = hoursOn(s, addDays(date, d), (day + d) % 7, bank);
    if (!h || h === 'closed') continue;
    const o = h === '24h' ? 0 : toMins(h);
    if (d === 0 && o <= mins) continue;
    return { open: false, next: { days: d, time: h === '24h' ? '00:00' : h.slice(0, 5), weekday: DAY_NAMES[(day + d) % 7] } };
  }
  return { open: false, next: null };
}

// --- Words ------------------------------------------------------------------------------------------------------------

// "9.30am", "3pm", "midday", "midnight" (HOUSE-STYLE §15).
export function clockText(hhmm: string): string {
  let h = Number(hhmm.slice(0, 2));
  const m = Number(hhmm.slice(3, 5));
  if ((h === 0 || h === 24) && m === 0) return 'midnight';
  if (h === 23 && m === 59) return 'midnight';
  if (h === 12 && m === 0) return 'midday';
  const ap = h < 12 ? 'am' : 'pm';
  h = h % 12 || 12;
  return m ? `${h}.${String(m).padStart(2, '0')}${ap}` : `${h}${ap}`;
}

export function openText(state: OpenState): string {
  if (state.open === null) return 'Opening hours not given';
  if (state.open) return state.until === 'always' ? 'Open 24 hours' : `Open until ${clockText(state.until)}`;
  if (!state.next) return 'Closed';
  const t = clockText(state.next.time);
  if (state.next.days === 0) return `Closed until ${t}`;
  if (state.next.days === 1) return `Closed until ${t} tomorrow`;
  return `Closed until ${state.next.weekday} ${t}`;
}

// "Updated less than an hour ago", "Updated 3 hours ago", "Updated 1 day ago", "Updated 34 days ago".
export function updatedText(iso: string, ms: number): string {
  const ago = ms - Date.parse(iso);
  if (!Number.isFinite(ago)) return '';
  const days = Math.floor(ago / 86_400_000);
  if (days >= 1) return `Updated ${days} day${days === 1 ? '' : 's'} ago`;
  const hours = Math.floor(ago / 3_600_000);
  if (hours < 1) return 'Updated less than an hour ago';
  return `Updated ${hours} hour${hours === 1 ? '' : 's'} ago`;
}

// More than 30 days old (John, 28 October: marked, never hidden).
export const isOld = (iso: string, ms: number) => Math.floor((ms - Date.parse(iso)) / 86_400_000) > 30;

// Fuel Finder gives names in capitals. Shown in ordinary capitalisation, keeping a few that are initials (John, 30 October).
const KEEP = new Set(['BP', 'MFG', 'SF', 'UK', 'EG', 'HGV', 'JET']);
const word = (w: string) => (KEEP.has(w.toUpperCase()) ? w.toUpperCase() : /\d/.test(w) || w !== w.toUpperCase() ? w : w.charAt(0) + w.slice(1).toLowerCase());
export function tidyName(s: string): string {
  return s.split(/\s+/).filter(Boolean).map((w) => w.split('-').map(word).join('-')).join(' ').replace(/ - /g, ' – ');
}
// A postcode shown with its space, whichever way Fuel Finder gave it ("CW13HD" shows as "CW1 3HD").
export function postcodeText(postcode: string): string {
  const s = postcode.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return s.length > 4 ? `${s.slice(0, -3)} ${s.slice(-3)}` : s;
}
export const tidyAddress = (s: Station) => `${[...new Set(s.address.map(tidyName))].join(', ')}, ${postcodeText(s.postcode)}`;

// --- The eight -----------------------------------------------------------------------------------------------------------

export type Row = { station: Station; miles: number; prices: { e10?: Price; diesel?: Price }; open: OpenState; cheapest: { e10: boolean; diesel: boolean } };

export function nearestEight(outcode: string, stations: Station[], prices: Prices, outcodes: Outcodes, bank: BankHolidays, ms: number) {
  const [lat, lon, place] = outcodes[outcode];
  const rows: Row[] = stations
    .filter((s) => !s.temporarilyClosed && positionAgrees(s, outcodes))
    .map((s) => ({ station: s, miles: milesBetween(lat, lon, s.lat, s.lon), prices: prices[s.id] ?? {}, open: { open: null } as OpenState, cheapest: { e10: false, diesel: false } }))
    .sort((a, b) => a.miles - b.miles || (a.station.id < b.station.id ? -1 : 1))
    .slice(0, 8);
  for (const r of rows) r.open = openState(r.station, ms, bank);
  for (const fuel of ['e10', 'diesel'] as const) {
    const usable = rows.map((r) => r.prices[fuel]).filter((p): p is Price => !!p && !p.x).map((p) => p.p);
    if (usable.length === 0) continue;
    const low = Math.min(...usable);
    for (const r of rows) {
      const p = r.prices[fuel];
      if (p && !p.x && p.p === low) r.cheapest[fuel] = true;
    }
  }
  return { place, rows, closedNow: rows.filter((r) => r.open.open === false).length };
}

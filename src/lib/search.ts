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

export type PostcodeResult = { ok: true; outcode: string; inward?: string } | { ok: false; problem: 'empty' | 'not-a-postcode' | 'northern-ireland' | 'not-found' };

// A typed postcode: "rg4 7hn" and "RG47HN" give RG4 and 7HN; "RG4" gives just the district (John, 31 October: full postcodes).
// Only the district has to be known here; whether the full postcode exists is found from its area's file (src/lib/postcodes.ts).
export function readPostcode(typed: string, outcodes: Outcodes): PostcodeResult {
  const s = typed.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (s === '') return { ok: false, problem: 'empty' };
  let outcode: string;
  let inward: string | undefined;
  if (/^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(s)) [outcode, inward] = [s.slice(0, -3), s.slice(-3)];
  else if (/^[A-Z]{1,2}\d[A-Z\d]?$/.test(s)) outcode = s;
  else return { ok: false, problem: 'not-a-postcode' };
  if (/^BT\d/.test(outcode)) return { ok: false, problem: 'northern-ireland' };
  return outcode in outcodes ? { ok: true, outcode, ...(inward ? { inward } : {}) } : { ok: false, problem: 'not-found' };
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
// Where higher prices are usual, so a high price there isn't marked "unusual" (John, 30 October: "unless …", said in About):
// the Highlands and Islands of Scotland (ZE, HS, KW, IV, Argyll's PA20 and above, Highland's PH19 and above, Arran and
// Cumbrae's KA27-28) and the Isles of Scilly (TR21-25). A price far below the middle is still marked anywhere.
export function higherPricesUsual(postcode: string): boolean {
  const m = /^([A-Z]+)(\d+)/.exec(outcodeOf(postcode));
  if (!m) return false;
  const [a, n] = [m[1], Number(m[2])];
  return ['ZE', 'HS', 'KW', 'IV'].includes(a) || (a === 'PA' && n >= 20) || (a === 'PH' && n >= 19) || (a === 'KA' && (n === 27 || n === 28)) || (a === 'TR' && n >= 21 && n <= 25);
}

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
// A postcode's area, the letters at the start ("RG" for RG4 8RZ); the page's data files are split by it.
export const postcodeArea = (postcode: string) => /^[A-Z]+/.exec(outcodeOf(postcode))?.[0] || 'other';
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
  | { open: null; wrong?: true }; // hours not given, or (wrong) given but implausible

// Hours that can't be right, almost always a 12-hour slip (John, 30 October: "Opening hours look wrong", with a "More" button
// that explains which rule caught them; never corrected, as the Fair Use policy says alter nothing). Caught when any day, bank
// holidays included:
//   - opens exactly 12 hours later than another day that closes at the same time (6pm-10pm beside 6am-10pm);
//   - closes exactly 12 hours earlier than another day that opens at the same time (6am-10am beside 6am-10pm);
//   - opens at 6pm or later and closes the same evening (Asda Harwich 6.30pm-9.30pm on weekdays).
// Genuinely short hours, such as an island shop's 12-2pm, aren't caught. Returns the explanation shown under "More", or null.
const PLURAL = ['Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays', 'Sundays', 'bank holidays'];
function daysText(days: number[]): string {
  const week = days.filter((d) => d < 7);
  const names =
    week.length >= 3 && week[week.length - 1] - week[0] === week.length - 1 ? [`${PLURAL[week[0]]} to ${PLURAL[week[week.length - 1]]}`] : week.map((d) => PLURAL[d]);
  if (days.includes(7)) names.push(PLURAL[7]);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
}
export function hoursProblem(s: Station): string | null {
  const given = [...(s.hours ?? []), s.bankHoliday?.hours ?? ''];
  const spans = given.map((h) => (/^\d\d:\d\d-\d\d:\d\d$/.test(h) ? (h.split('-').map(toMins) as [number, number]) : null));
  const on = (h: string) => given.flatMap((g, i) => (g === h ? [i] : []));
  const range = (h: string) => h.split('-').map(clockText).join(' to ');
  const time = (m: number) => clockText(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  for (const [i, a] of spans.entries()) {
    if (!a) continue;
    for (const [j, b] of spans.entries()) {
      if (!b || i === j) continue;
      const late = a[0] === b[0] + 720 && a[1] === b[1];
      const early = a[0] === b[0] && a[1] === b[1] - 720;
      if (!late && !early) continue;
      const odd = late ? a[0] : a[1];
      const usual = late ? b[0] : b[1];
      return (
        `The station gives its hours on ${daysText(on(given[i]))} as ${range(given[i])}, but on ${daysText(on(given[j]))} as ${range(given[j])}. ` +
        `${time(odd)} is exactly 12 hours ${late ? 'after' : 'before'} ${time(usual)}, so ${time(odd)} may have been entered by mistake.`
      );
    }
  }
  for (const [i, a] of spans.entries()) {
    if (a && a[0] >= 18 * 60 && a[1] > a[0])
      return `The station gives its hours on ${daysText(on(given[i]))} as ${range(given[i])}. Very few petrol stations open only in the evening, so these hours may have been entered by mistake.`;
  }
  return null;
}
export const hoursLookWrong = (s: Station) => hoursProblem(s) !== null;

// Open now, and until when; or closed, and when it next opens (looking up to a week ahead). Hours that run past midnight
// ("22:00-02:00") count on the next morning too.
export function openState(s: Station, ms: number, bank: BankHolidays): OpenState {
  if (!s.hours) return { open: null };
  if (hoursLookWrong(s)) return { open: null, wrong: true };
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
  if (state.open === null) return state.wrong ? 'Opening hours look wrong' : 'Opening hours not given';
  if (state.open) return state.until === 'always' ? 'Open 24 hours' : `Open until ${clockText(state.until)}`;
  if (!state.next) return 'Closed';
  const t = clockText(state.next.time);
  if (state.next.days === 0) return `Closed until ${t}`;
  if (state.next.days === 1) return `Closed until ${t} tomorrow`;
  return `Closed until ${state.next.weekday} ${t}`;
}

// "Same price for less than an hour", "Same price for 3 hours", "Same price for 1 day", "Same price for 34 days" (John, 31
// October; was "Price set … ago"). The time is when the station last reported the price; in the data a new time nearly always
// comes with a new price (1,371 of 1,373 on 30 October), so this is how long the price has stayed the same.
export function updatedText(iso: string, ms: number): string {
  const ago = ms - Date.parse(iso);
  if (!Number.isFinite(ago)) return '';
  const days = Math.floor(ago / 86_400_000);
  if (days >= 1) return `Same price for ${days} day${days === 1 ? '' : 's'}`;
  const hours = Math.floor(ago / 3_600_000);
  if (hours < 1) return 'Same price for less than an hour';
  return `Same price for ${hours} hour${hours === 1 ? '' : 's'}`;
}

// Where a price sits among the stations shown (John, 31 October, option A of the mock-ups): every usual price for that fuel,
// lowest first (an unusual price is left out, as it is never marked cheapest). No chart with fewer than two.
export function rankPrices(rows: Row[], fuel: 'e10' | 'diesel'): number[] {
  return rows
    .map((r) => r.prices[fuel])
    .filter((p): p is Price => !!p && !p.x)
    .map((p) => p.p)
    .sort((a, b) => a - b);
}

const RANK_WORDS = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];

// "Lowest of eight" (ties too), "2.0p above the lowest". Worked in tenths of a penny, so 0.1p differences aren't lost to rounding.
export function rankText(me: number, all: number[]): string {
  const tenths = Math.round(me * 10) - Math.round(all[0] * 10);
  if (tenths <= 0) return `Lowest of ${RANK_WORDS[all.length] ?? all.length}`;
  return `${(tenths / 10).toFixed(1)}p above the lowest`;
}

// More than 45 days old (John, 28 October: marked, never hidden; 30 October: 45 days, not 30, as a price that hasn't changed may
// still be right).
export const isOld = (iso: string, ms: number) => Math.floor((ms - Date.parse(iso)) / 86_400_000) > 45;

// Fuel Finder gives most names in capitals. Shown in ordinary capitalisation (John, 30 October), except: a name or address line
// typed in a mix of capitals and small letters is left exactly as the station typed it ("PC&AT Hudson"), and one typed all in
// small letters is treated like one in capitals ("trewellard garage" shows as "Trewellard Garage"); words with no vowel are taken as
// initials and kept in capitals ("TGC", "PGG"), apart from the usual short forms ("Ltd", "Rd", "St"); and short pieces joined
// by "&" stay in capitals ("J&J").
const KEEP = new Set(['BP', 'MFG', 'SF', 'UK', 'EG', 'HGV', 'JET']);
const SHORT: Record<string, string> = { LTD: 'Ltd', RD: 'Rd', ST: 'St', LN: 'Ln', DR: 'Dr', NR: 'Nr', JCT: 'Jct', MR: 'Mr', MRS: 'Mrs', NTH: 'Nth', NRTH: 'Nrth', MKT: 'Mkt', STN: 'Stn', SQ: 'Sq', CRT: 'Crt', PL: 'Pl', CRNR: 'Crnr', SVCS: 'Svcs', CWM: 'Cwm', CWT: 'Cwt', PWL: 'Pwl' };
function word(w: string): string {
  const u = w.toUpperCase();
  if (KEEP.has(u)) return u;
  if (SHORT[u]) return SHORT[u];
  if (/\d/.test(w)) return w;
  const letters = u.replace(/[^A-Z]/g, '');
  if (letters && !/[AEIOUY]/.test(letters)) return u;
  return w.toLowerCase().replace(/[a-z]/, (c) => c.toUpperCase());
}
export function tidyName(s: string): string {
  const spaced = s.split(/\s+/).filter(Boolean);
  if (/[a-z]/.test(s) && /[A-Z]/.test(s)) return spaced.join(' ').replace(/ - /g, ' – ');
  return spaced
    .map((w) => w.toUpperCase())
    .map((w) => {
      const amp = w.includes('&');
      return w.split(/([-.&,])/).map((piece, i) => (i % 2 || (amp && piece.length <= 2) ? piece : word(piece))).join('');
    })
    .join(' ')
    .replace(/ - /g, ' – ');
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
  const rows = nearestFrom(lat, lon, stations, prices, outcodes, bank, ms);
  return { place, rows, closedNow: rows.filter((r) => r.open.open === false).length };
}

// The eight nearest to any point: the middle of a postcode district, or a station's own position ("Find stations near this one",
// John, 30 October), with their opening states and the cheapest of each fuel marked.
export function nearestFrom(lat: number, lon: number, stations: Station[], prices: Prices, outcodes: Outcodes, bank: BankHolidays, ms: number): Row[] {
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
  return rows;
}

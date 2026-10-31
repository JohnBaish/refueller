// The 14-day price graph (PLAN idea 1; John, 31 October: build it now and let it fill in). Fuel Finder keeps no earlier prices
// (design/probe-result-history-2026-10-31.md), so the history is our own: every collection's prices, with the time each station set
// them (data/history.json, scripts/build-history.ts). Each price is drawn from its own "set" time, never moved; before the first
// price we know of, the graph says "Not recorded". Pure functions, shared by the build and the page.
import { clockText, ukNow, type Price } from './search.ts';

export const HISTORY_DAYS = 14;
const DAY = 86_400_000;

// One station's known prices for one fuel, oldest first: [pence, set time as given].
export type Hist = [number, string][];

// Adds a price to a history if its set time is new, keeping it sorted; the current price always counts.
export function withPrice(hist: Hist, p: Price | undefined): Hist {
  if (!p || hist.some(([, u]) => u === p.u)) return hist;
  return [...hist, [p.p, p.u] as [number, string]].sort((a, b) => Date.parse(a[1]) - Date.parse(b[1]));
}

// Only what the window needs: every price set inside it, and the last one set before it (which tells the price at its start).
export function trim(hist: Hist, windowStart: number): Hist {
  const before = hist.filter(([, u]) => Date.parse(u) < windowStart);
  return [...before.slice(-1), ...hist.filter(([, u]) => Date.parse(u) >= windowStart)];
}

export type Step = { t: number; p: number };
export const steps = (hist: Hist): Step[] => hist.map(([p, u]) => ({ t: Date.parse(u), p }));

const priceAt = (st: Step[], t: number) => {
  let p: number | null = null;
  for (const s of st) if (s.t <= t) p = s.p;
  return p;
};

// The average of the stations given, only from the moment every one of them has a known price (John, 31 October: show it).
export function average(all: Step[][], start: number, end: number): { from: number; steps: Step[] } | null {
  const usable = all.filter((s) => s.length > 0);
  if (usable.length === 0) return null;
  const from = Math.max(start, ...usable.map((s) => s[0].t));
  if (from >= end) return null;
  const times = [...new Set([from, ...usable.flat().map((s) => s.t).filter((t) => t > from && t <= end)])].sort((a, b) => a - b);
  return { from, steps: times.map((t) => ({ t, p: Math.round((usable.reduce((a, s) => a + priceAt(s, t)!, 0) / usable.length) * 10) / 10 })) };
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ordinal = (d: number) => `${d}${d % 10 === 1 && d !== 11 ? 'st' : d % 10 === 2 && d !== 12 ? 'nd' : d % 10 === 3 && d !== 13 ? 'rd' : 'th'}`;

// "October 30th", or "3.07pm on October 30th" with the time.
export function dateWords(ms: number, withTime: boolean): string {
  const u = ukNow(ms);
  const [, m, d] = u.date.split('-').map(Number);
  const day = `${MONTHS[m - 1]} ${ordinal(d)}`;
  if (!withTime) return day;
  return `${clockText(`${String(Math.floor(u.mins / 60)).padStart(2, '0')}:${String(u.mins % 60).padStart(2, '0')}`)} on ${day}`;
}

// "Oct 17": short dates for the graph's axis.
export const axisDate = (ms: number) => {
  const u = ukNow(ms);
  return `${MONTHS[Number(u.date.slice(5, 7)) - 1].slice(0, 3)} ${Number(u.date.slice(8, 10))}`;
};

const pence = (p: number) => `${p.toFixed(1)}p`;
// One to nine in words in running text (HOUSE-STYLE §13).
const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

// The graph in words, for everyone (and anyone who can't see the graph). Times are given for prices set inside the window.
export function historySentence(fuelWord: string, st: Step[], windowStart: number): string {
  if (st.length === 0) return '';
  const Fuel = fuelWord[0].toUpperCase() + fuelWord.slice(1);
  const when = (t: number) => dateWords(t, t >= windowStart);
  const last = st[st.length - 1];
  let s = `${Fuel} here has been ${pence(last.p)} since ${when(last.t)}.`;
  if (st.length >= 2) {
    const prev = st[st.length - 2];
    s += ` Before that it was ${pence(prev.p)}, from ${when(prev.t)}.`;
  }
  const inWindow = st.filter((x) => x.t >= windowStart).length;
  if (inWindow >= 3) {
    const shown = st.filter((x, i) => x.t >= windowStart || st[i + 1]?.t > windowStart || i === st.length - 1);
    const ps = shown.map((x) => x.p);
    s += ` It changed ${inWindow < 10 ? NUMBER_WORDS[inWindow] : inWindow} times in the last ${HISTORY_DAYS} days, between ${pence(Math.min(...ps))} and ${pence(Math.max(...ps))}.`;
  }
  if (st[0].t > windowStart) s += ' Earlier prices weren’t recorded.';
  return s;
}

export const windowFor = (collectedMs: number) => ({ start: collectedMs - HISTORY_DAYS * DAY, end: collectedMs });

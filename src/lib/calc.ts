// "Worth driving here?" (PLAN Stage 7, decided by John on 30 October 2026): is a cheaper station worth the extra miles,
// compared with the nearest open station selling the same fuel? Plain arithmetic, no network: everything here runs in the
// visitor's browser.
//
//   litres     = £ spent ÷ the nearest station's price
//   saving     = litres × the difference in price per litre
//   fuel used  = extra miles ÷ mpg × 4.54609 litres a gallon × the nearest station's price
//   better off = saving − fuel used;  worth the trip if this station is at least (fuel used ÷ litres) pence a litre cheaper
//
// Checked against the handover's worked example (design/handover-2026-10-22.md: 38p better off, break-even about 2p).

import type { Row } from './search.ts';

export type Fuel = 'e10' | 'diesel';

export const LITRES_PER_GALLON = 4.54609;
// Typical miles per gallon to start with, which the visitor types over (John, C4 option a; NimbleFins, from a search
// summary only).
export const TYPICAL_MPG: Record<Fuel, number> = { e10: 36, diesel: 43 };
export const START_SPEND = 50;

export type Sums = { litres: number; saving: number; fuelCost: number; net: number; breakEven: number };

// All in pence (prices in pence a litre, spend in pounds).
export function sums(spendPounds: number, mpg: number, extraMiles: number, nearestPence: number, herePence: number): Sums {
  const litres = (spendPounds * 100) / nearestPence;
  const saving = litres * (nearestPence - herePence);
  const fuelCost = (extraMiles / mpg) * LITRES_PER_GALLON * nearestPence;
  return { litres, saving, fuelCost, net: saving - fuelCost, breakEven: fuelCost / litres };
}

// "57p", "£1.03", "£12.40".
export function money(pence: number): string {
  const p = Math.round(pence);
  return p < 100 ? `${p}p` : `£${(p / 100).toFixed(2)}`;
}

// The spend as typed back: "£50", "£42.50".
export const pounds = (n: number) => (Number.isInteger(n) ? `£${n}` : `£${n.toFixed(2)}`);

// Extra miles as shown in the box: one decimal under 5, whole miles from 5 (as the distance column).
export function milesBox(m: number): string {
  if (m < 5) return (Math.round(m * 10) / 10).toFixed(1).replace(/\.0$/, '');
  return String(Math.round(m));
}

// "the extra 3.8 miles", "the extra mile".
const extraText = (m: number) => (milesBox(m) === '1' ? 'the extra mile' : `the extra ${milesBox(m)} miles`);

// A number the visitor typed ("50", "£50", "42.50", " 36 "); null if it isn't a usable one.
export function readNumber(typed: string, allowZero = false): number | null {
  const t = typed.trim().replace(/^£/, '').replace(/,/g, '');
  if (!/^\d+(\.\d+)?$|^\.\d+$/.test(t)) return null;
  const n = Number(t);
  return n > 0 || (allowZero && n === 0) ? n : null;
}

// The verdict and the break-even line (C6 wording, agreed; adapted to £ spent rather than litres).
export function verdict(spendPounds: number, mpg: number, extraMiles: number, nearestPence: number, herePence: number) {
  const s = sums(spendPounds, mpg, extraMiles, nearestPence, herePence);
  // Worked from the rounded figures shown, so "£1.03 … 60p … 43p better off" adds up as the visitor reads it.
  const net = Math.round(s.saving) - Math.round(s.fuelCost);
  let kind: 'worth' | 'not' | 'even';
  let text: string;
  if (extraMiles === 0) {
    kind = 'worth';
    text = `you’d save about ${money(s.saving)} on ${pounds(spendPounds)} of fuel, with no extra miles.`;
  } else if (net > 0) {
    kind = 'worth';
    text = `you’d save about ${money(s.saving)} on ${pounds(spendPounds)} of fuel. ${cap(extraText(extraMiles))} would use about ${money(s.fuelCost)} of fuel, so you’d be about ${money(net)} better off.`;
  } else if (net < 0) {
    kind = 'not';
    text = `${extraText(extraMiles)} would use about ${money(s.fuelCost)} of fuel, more than the ${money(s.saving)} you’d save.`;
  } else {
    kind = 'even';
    text = `${extraText(extraMiles)} would use about ${money(s.fuelCost)} of fuel, about the same as you’d save.`;
  }
  // "At least", so rounded up to the next tenth of a penny (2.05 becomes 2.1).
  const breakEven = Math.ceil(Math.round(s.breakEven * 1000) / 100) / 10;
  return { kind, text, breakEven: extraMiles === 0 ? null : breakEven, sums: s };
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export const fuelWord = (f: Fuel) => (f === 'e10' ? 'unleaded' : 'diesel');

// Remembered on this device only (the footer says so): the fuel, the £ amount and each fuel's mpg.
export type CalcChoices = { fuel: Fuel; spend: string; mpg: Partial<Record<Fuel, string>> };
const KEY = 'refueller.calc';

export function loadChoices(): CalcChoices {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (c && (c.fuel === 'e10' || c.fuel === 'diesel'))
      return { fuel: c.fuel, spend: typeof c.spend === 'string' ? c.spend : String(START_SPEND), mpg: typeof c.mpg === 'object' && c.mpg ? c.mpg : {} };
  } catch {
    // storage blocked or unreadable: start afresh
  }
  return { fuel: 'e10', spend: String(START_SPEND), mpg: {} };
}

export function saveChoices(c: CalcChoices) {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    // a private window may refuse; the calculator still works for the visit
  }
}

// The OS credit for the road distances, word for word from the Open Roads licence file (data/road-miles.json "credit";
// scripts/check-search.ts checks they agree).
export const ROAD_CREDIT = 'Contains Ordnance Survey data © Crown copyright and database right 2026';

// The nearest station that is open (or whose hours aren't known) and sells the fuel at a usual price, in the list's order
// (nearest first, as the crow flies).
export function nearestSelling(rows: Row[], fuel: Fuel): Row | undefined {
  return rows.find((r) => r.open.open !== false && r.prices[fuel] && !r.prices[fuel]!.x);
}

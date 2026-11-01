// Sorting the list (John, November 1st 2026): by distance (the default), or by unleaded or diesel price, lowest first. Display only:
// the calculator and "Cheapest" still work from the nearest-first list.
import type { Row } from './search.ts';

export type SortBy = 'distance' | 'e10' | 'diesel';
export const SORTS: SortBy[] = ['distance', 'e10', 'diesel'];

// Usual prices lowest first; then unusual prices (never marked cheapest, so not put among them), lowest first; then stations that
// don't sell the fuel. Ties go to the nearer station (John's answers 2 to 4).
export function sortRows(rows: Row[], by: SortBy): Row[] {
  if (by === 'distance') return rows;
  const rank = (r: Row): [number, number] => {
    const p = r.prices[by];
    return !p ? [2, 0] : p.x ? [1, p.p] : [0, p.p];
  };
  return rows
    .map((r, i) => ({ r, i, k: rank(r) }))
    .sort((a, b) => a.k[0] - b.k[0] || a.k[1] - b.k[1] || a.r.miles - b.r.miles || a.i - b.i)
    .map((x) => x.r);
}

export const sortNote = (by: SortBy) => (by === 'distance' ? '' : `Sorted by ${by === 'e10' ? 'unleaded' : 'diesel'} price, lowest first.`);

// Remembered on this device only (John, answer 5); the footer says so.
const KEY = 'refueller.sort';
export function loadSort(): SortBy {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'e10' || v === 'diesel') return v;
  } catch {
    // storage blocked: distance
  }
  return 'distance';
}
export function saveSort(by: SortBy) {
  try {
    if (by === 'distance') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, by);
  } catch {
    // a private window may refuse; sorting still works for the visit
  }
}

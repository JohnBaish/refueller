// "Find cheaper fuel near the route" (John, 31 October 2026): the eight cheapest stations that add no more than three miles to a
// journey, listed in the order you'd reach them (option b of the mock-ups). Worked out entirely on the visitor's device, from the
// main roads (data/route-roads.json, scripts/build-route-roads.ts), so nothing they type leaves it.
//
// The route between two places is the quickest by rough road speeds (so the M4 rather than the shorter A4), and its length in miles
// is what's shown. For each station: extra miles = start to station + station to end, less the direct route (each by the same
// rule), with the station joined to the nearest main-road point in a straight line, there and back. With a "via", each leg is
// worked out on its own and a station counts against the leg it suits best.
import { toBritishGrid } from '../../scripts/lib/grid.ts';
import { clockText, hoursLookWrong, hoursOn, membersOnly, ukNow, type BankHolidays, type Price, type Station } from './search.ts';

export const ROUTE_EXTRA_MILES = 3;
export const ROUTE_SHOWN = 8;
const METRES_PER_MILE = 1609.344;
const SNAP_LIMIT = 30_000; // a place further than 30 km from any main road can't be routed

export type RouteFile = { n: number[]; e: number[]; credit: string; made: string };
export type Place = { easting: number; northing: number };

const CELL = 5000;
export type Network = { east: Int32Array; north: Int32Array; head: Int32Array; next: Int32Array; to: Int32Array; metres: Float64Array; seconds: Float64Array; cells: Map<number, number[]> };

export function makeNetwork(f: RouteFile): Network {
  const points = f.n.length / 2;
  const east = new Int32Array(points);
  const north = new Int32Array(points);
  const cells = new Map<number, number[]>();
  for (let i = 0; i < points; i++) {
    east[i] = f.n[2 * i] * 10;
    north[i] = f.n[2 * i + 1] * 10;
    const k = cellKey(Math.floor(east[i] / CELL), Math.floor(north[i] / CELL));
    (cells.get(k) ?? cells.set(k, []).get(k)!).push(i);
  }
  const links = f.e.length / 4;
  const head = new Int32Array(points).fill(-1);
  const next = new Int32Array(links * 2);
  const to = new Int32Array(links * 2);
  const metres = new Float64Array(links * 2);
  const seconds = new Float64Array(links * 2);
  for (let i = 0; i < links; i++) {
    const [a, b, m, s] = [f.e[4 * i], f.e[4 * i + 1], f.e[4 * i + 2] * 10, f.e[4 * i + 3]];
    for (const [x, y, k] of [
      [a, b, 2 * i],
      [b, a, 2 * i + 1],
    ]) {
      to[k] = y;
      metres[k] = m;
      seconds[k] = s;
      next[k] = head[x];
      head[x] = k;
    }
  }
  return { east, north, head, next, to, metres, seconds, cells };
}

const cellKey = (cx: number, cy: number) => cx * 100_000 + cy;

// The nearest main-road point, and how far away it is in a straight line (metres); null when more than 30 km.
export function snap(net: Network, p: Place): { node: number; metres: number } | null {
  const cx = Math.floor(p.easting / CELL);
  const cy = Math.floor(p.northing / CELL);
  let best = -1;
  let bestD = Infinity;
  for (let r = 0; r * CELL <= SNAP_LIMIT + CELL; r++) {
    for (let dx = -r; dx <= r; dx++)
      for (let dy = -r; dy <= r; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        for (const i of net.cells.get(cellKey(cx + dx, cy + dy)) ?? []) {
          const d = Math.hypot(net.east[i] - p.easting, net.north[i] - p.northing);
          if (d < bestD) [best, bestD] = [i, d];
        }
      }
    // Anything in a further ring is at least r × CELL away.
    if (best >= 0 && bestD <= r * CELL) break;
  }
  return best >= 0 && bestD <= SNAP_LIMIT ? { node: best, metres: bestD } : null;
}

// From one point to every other: the quickest route by the rough speeds, giving the metres along it (Infinity where none).
export function tree(net: Network, start: number): Float64Array {
  const n = net.head.length;
  const time = new Float64Array(n).fill(Infinity);
  const dist = new Float64Array(n).fill(Infinity);
  time[start] = 0;
  dist[start] = 0;
  const heapT: number[] = [0];
  const heapV: number[] = [start];
  const swap = (i: number, j: number) => {
    [heapT[i], heapT[j]] = [heapT[j], heapT[i]];
    [heapV[i], heapV[j]] = [heapV[j], heapV[i]];
  };
  while (heapT.length) {
    const t = heapT[0];
    const u = heapV[0];
    const lastT = heapT.pop()!;
    const lastV = heapV.pop()!;
    if (heapT.length) {
      heapT[0] = lastT;
      heapV[0] = lastV;
      for (let i = 0; ; ) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < heapT.length && heapT[l] < heapT[m]) m = l;
        if (r < heapT.length && heapT[r] < heapT[m]) m = r;
        if (m === i) break;
        swap(i, m);
        i = m;
      }
    }
    if (t > time[u]) continue;
    for (let k = net.head[u]; k >= 0; k = net.next[k]) {
      const v = net.to[k];
      const nt = t + net.seconds[k];
      if (nt < time[v]) {
        time[v] = nt;
        dist[v] = dist[u] + net.metres[k];
        heapT.push(nt);
        heapV.push(v);
        for (let i = heapT.length - 1; i > 0; ) {
          const p = (i - 1) >> 1;
          if (heapT[p] <= heapT[i]) break;
          swap(i, p);
          i = p;
        }
      }
    }
  }
  return dist;
}

export type Journey = { ok: true; miles: number; along: Float64Array; extra: Float64Array } | { ok: false; problem: 'far-from-road' | 'no-road' };

// The journey through `places` (start, optional via, end), and for every station point its miles along the journey and its extra
// miles (NaN where it can't be reached by road).
export function journey(net: Network, places: Place[], stations: Place[]): Journey {
  const ends = places.map((p) => snap(net, p));
  if (ends.some((e) => !e)) return { ok: false, problem: 'far-from-road' };
  const e = ends as { node: number; metres: number }[];
  const trees = e.map((x) => tree(net, x.node));
  const legs: { direct: number; offset: number }[] = [];
  let offset = 0;
  for (let i = 0; i + 1 < e.length; i++) {
    const direct = trees[i][e[i + 1].node] + e[i].metres + e[i + 1].metres;
    if (!Number.isFinite(direct)) return { ok: false, problem: 'no-road' };
    legs.push({ direct, offset });
    offset += direct;
  }
  const along = new Float64Array(stations.length).fill(NaN);
  const extra = new Float64Array(stations.length).fill(NaN);
  stations.forEach((p, s) => {
    const at = snap(net, p);
    if (!at) return;
    legs.forEach((leg, i) => {
      const to = trees[i][at.node] + e[i].metres + at.metres;
      const from = trees[i + 1][at.node] + e[i + 1].metres + at.metres;
      const x = Math.max(0, to + from - leg.direct);
      if (Number.isFinite(x) && !(x >= extra[s] * METRES_PER_MILE)) {
        extra[s] = x / METRES_PER_MILE;
        along[s] = (leg.offset + to) / METRES_PER_MILE;
      }
    });
  });
  return { ok: true, miles: offset / METRES_PER_MILE, along, extra };
}

export const toPlace = (lat: number, lon: number): Place => toBritishGrid(lat, lon);

export type RouteRow = { station: Station; prices: { e10?: Price; diesel?: Price }; along: number; extra: number };

// The eight cheapest within three extra miles at a usual price, then in the order you'd reach them; and how many were within the
// three miles. Ties in price go to the smaller detour.
export function routeEight(candidates: RouteRow[], fuel: 'e10' | 'diesel') {
  const within = candidates.filter((c) => c.extra <= ROUTE_EXTRA_MILES && c.prices[fuel] && !c.prices[fuel]!.x);
  const eight = within
    .slice()
    .sort((a, b) => a.prices[fuel]!.p - b.prices[fuel]!.p || a.extra - b.extra)
    .slice(0, ROUTE_SHOWN)
    .sort((a, b) => a.along - b.along);
  return { rows: eight, within: within.length };
}

// As on the main list: the lowest price is marked; when that is at Costco (members only), the lowest anyone can buy is marked too.
export function routeCheapest(rows: RouteRow[], fuel: 'e10' | 'diesel'): boolean[] {
  const ps = rows.map((r) => r.prices[fuel]!.p);
  if (!ps.length) return [];
  const low = Math.min(...ps);
  const open = rows.filter((r) => !membersOnly(r.station)).map((r) => r.prices[fuel]!.p);
  const lowOpen = open.length ? Math.min(...open) : null;
  return rows.map((r) => (membersOnly(r.station) ? r.prices[fuel]!.p === low : r.prices[fuel]!.p === lowOpen));
}

// Today's opening hours in words: "Today 6am to 11pm", "Open 24 hours today", "Closed today", or the main list's notes.
export function todayText(s: Station, ms: number, bank: BankHolidays): string {
  if (hoursLookWrong(s)) return 'Opening hours look wrong';
  const u = ukNow(ms);
  const h = hoursOn(s, u.date, u.day, bank);
  if (h === null) return 'Opening hours not given';
  if (h === 'closed') return 'Closed today';
  if (h === '24h' || h === '00:00-23:59' || h === '00:00-24:00') return 'Open 24 hours today';
  return `Today ${clockText(h.slice(0, 5))} to ${clockText(h.slice(6, 11))}`;
}

// "0.3 miles", "2.9 miles", "less than 0.1 miles"; "39 miles" from 5 miles up (as the main list).
export function routeMiles(m: number): string {
  if (m < 0.05) return 'less than 0.1 miles';
  if (m < 5) return `${(Math.round(m * 10) / 10).toFixed(1)} miles`;
  const r = Math.round(m);
  return `${r} mile${r === 1 ? '' : 's'}`;
}

// The address after "#": route/<from>/<to> or route/<from>/<to>/<via>, each "RG1" or "RG1-8FR".
export type Pc = { outcode: string; inward?: string };
export type RouteTarget = { kind: 'route'; from?: Pc; to?: Pc; via?: Pc };
const PC = /^([A-Z]{1,2}\d[A-Z\d]?)(?:-(\d[A-Z]{2}))?$/;
const readPc = (s: string | undefined): Pc | undefined => {
  const m = s ? PC.exec(s.toUpperCase()) : null;
  return m ? { outcode: m[1], ...(m[2] ? { inward: m[2] } : {}) } : undefined;
};
export function readRouteHash(h: string): RouteTarget | null {
  if (h !== 'route' && !h.startsWith('route/')) return null;
  const [, from, to, via] = h.split('/');
  const t: RouteTarget = { kind: 'route', from: readPc(from), to: readPc(to), via: readPc(via) };
  return t.from && t.to ? t : { kind: 'route' };
}
export const pcHash = (p: Pc) => (p.inward ? `${p.outcode}-${p.inward}` : p.outcode);
export const pcText = (p: Pc) => (p.inward ? `${p.outcode} ${p.inward}` : p.outcode);
export function routeHash(t: RouteTarget): string {
  if (!t.from || !t.to) return 'route';
  return `route/${pcHash(t.from)}/${pcHash(t.to)}${t.via ? `/${pcHash(t.via)}` : ''}`;
}

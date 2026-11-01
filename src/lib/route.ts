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
// And no more than this many extra minutes, by the rough speeds: a detour through a town can add few miles but much time (Reading to
// Downham Market counted Southall and Queensbury, 2.5 miles but about 10 minutes off the M25).
export const ROUTE_EXTRA_MINUTES = 6;
export const ROUTE_SHOWN = 8;
const METRES_PER_MILE = 1609.344;
const SNAP_LIMIT = 30_000;
// A delay for every junction passed (seconds), so a route through a town's many junctions costs what it should: without it, Reading to
// Manchester went through the middle of Birmingham rather than round it on the M42.
export const JUNCTION_SECONDS = 15; // a place further than 30 km from any main road can't be routed

export type RouteFile = { n: number[]; e: number[]; credit: string; made: string; r?: string[]; k?: number[] };
export type Place = { easting: number; northing: number };

const CELL = 5000;
export type Network = { east: Int32Array; north: Int32Array; head: Int32Array; next: Int32Array; to: Int32Array; metres: Float64Array; seconds: Float64Array; cells: Map<number, number[]>; road: Int32Array; roads: string[] };

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
  const road = new Int32Array(links * 2).fill(-1);
  for (let i = 0; i < links; i++) {
    const [a, b, m, s] = [f.e[4 * i], f.e[4 * i + 1], f.e[4 * i + 2] * 10, f.e[4 * i + 3]];
    for (const [x, y, k] of [
      [a, b, 2 * i],
      [b, a, 2 * i + 1],
    ]) {
      to[k] = y;
      metres[k] = m;
      seconds[k] = s;
      road[k] = f.k?.[i] ?? -1;
      next[k] = head[x];
      head[x] = k;
    }
  }
  return { east, north, head, next, to, metres, seconds, cells, road, roads: f.r ?? [] };
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
export function tree(net: Network, start: number): { dist: Float64Array; time: Float64Array; prev: Int32Array; via: Int32Array } {
  const n = net.head.length;
  const prev = new Int32Array(n).fill(-1);
  const via = new Int32Array(n).fill(-1); // the link it was reached by
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
      const nt = t + net.seconds[k] + JUNCTION_SECONDS;
      if (nt < time[v]) {
        time[v] = nt;
        dist[v] = dist[u] + net.metres[k];
        prev[v] = u;
        via[v] = k;
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
  return { dist, time, prev, via };
}

export type Journey = { ok: true; miles: number; along: Float64Array; extra: Float64Array; minutes: Float64Array; offRoute: Float64Array; roads: RoadRun[]; path: number[]; links: number[]; start: number; end: number } | { ok: false; problem: 'far-from-road' | 'no-road' | 'via-far' };

// A "via" place is a place the route passes near, not a stop (John, 1 November): the quickest route that passes a main-road point within
// about 3 miles of it, so Reading to Exeter via Andover keeps to the A303 rather than going into the town and out again.
export const VIA_NEAR_METRES = 5000;

// A station must also be close to the route Refueller draws (John, 1 November): within about 2 miles of it in a straight line. Without
// this, a station on a near-equal other route counts too (Caversham to Downham Market via Hatfield listed High Wycombe, on the M40,
// as well as Slough, on the M4, though only one of them can be on the way).
export const ROUTE_CORRIDOR_METRES = 3200;

// The shortest straight-line distance (metres) from a point to a line of road points.
function distanceToPath(net: Network, path: number[], x: number, y: number): number {
  let best = Infinity;
  for (let k = 0; k + 1 < path.length; k++) {
    const ax = net.east[path[k]], ay = net.north[path[k]];
    const dx = net.east[path[k + 1]] - ax, dy = net.north[path[k + 1]] - ay;
    const len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len)) : 0;
    const d = Math.hypot(x - ax - t * dx, y - ay - t * dy);
    if (d < best) best = d;
  }
  if (path.length === 1) best = Math.hypot(x - net.east[path[0]], y - net.north[path[0]]);
  return best;
}

// The journey from the first place to the last (through a "via" in between, if given), and for every station point its miles along the
// journey and its extra miles and minutes (NaN where it can't be reached by road).
export function journey(net: Network, places: Place[], stations: Place[]): Journey {
  const start = snap(net, places[0]);
  const end = snap(net, places[places.length - 1]);
  if (!start || !end) return { ok: false, problem: 'far-from-road' };
  const fromStart = tree(net, start.node);
  const fromEnd = tree(net, end.node);
  if (!Number.isFinite(fromStart.dist[end.node])) return { ok: false, problem: 'no-road' };
  let e: { node: number; metres: number }[] = [start, end];
  let trees = [fromStart, fromEnd];
  if (places.length === 3) {
    const v = places[1];
    let best = -1;
    let bestTime = Infinity;
    let near = 0;
    const cx = Math.floor(v.easting / CELL);
    const cy = Math.floor(v.northing / CELL);
    const reach = Math.ceil(VIA_NEAR_METRES / CELL);
    for (let dx = -reach; dx <= reach; dx++)
      for (let dy = -reach; dy <= reach; dy++)
        for (const i of net.cells.get(cellKey(cx + dx, cy + dy)) ?? []) {
          if (Math.hypot(net.east[i] - v.easting, net.north[i] - v.northing) > VIA_NEAR_METRES) continue;
          near++;
          const t = fromStart.time[i] + fromEnd.time[i];
          if (t < bestTime) [best, bestTime] = [i, t];
        }
    if (best < 0) return { ok: false, problem: near ? 'no-road' : 'via-far' };
    e = [start, { node: best, metres: 0 }, end];
    trees = [fromStart, tree(net, best), fromEnd];
  }
  // The straight-line joins to and from the main roads are taken at 20 mph (town streets), for the times only.
  const joinSeconds = (m: number) => m / (20 * 0.44704);
  const legs: { direct: number; directTime: number; offset: number }[] = [];
  let offset = 0;
  for (let i = 0; i + 1 < e.length; i++) {
    const direct = trees[i].dist[e[i + 1].node] + e[i].metres + e[i + 1].metres;
    if (!Number.isFinite(direct)) return { ok: false, problem: 'no-road' };
    legs.push({ direct, directTime: trees[i].time[e[i + 1].node], offset });
    offset += direct;
  }
  const along = new Float64Array(stations.length).fill(NaN);
  const extra = new Float64Array(stations.length).fill(NaN);
  const minutes = new Float64Array(stations.length).fill(NaN);
  const offRoute = new Float64Array(stations.length).fill(NaN);
  // The route itself, leg by leg, as road points (walked back from each leg's end).
  const path: number[] = [];
  const pathLinks: number[] = [];
  const runs: RoadRun[] = [];
  for (let i = 0; i + 1 < e.length; i++) {
    const leg: number[] = [];
    const legLinks: number[] = [];
    for (let v = e[i + 1].node; v >= 0; v = v === e[i].node ? -1 : trees[i].prev[v]) {
      leg.push(v);
      if (v !== e[i].node) legLinks.push(trees[i].via[v]);
    }
    path.push(...leg.reverse());
    for (const k of legLinks.reverse()) {
      runs.push({ road: net.roads[net.road[k]] ?? '', metres: net.metres[k] });
      pathLinks.push(k);
    }
  }
  stations.forEach((p, s) => {
    const at = snap(net, p);
    if (!at) return;
    legs.forEach((leg, i) => {
      // The station counts against the leg where it adds least time.
      const t = trees[i].time[at.node] + trees[i + 1].time[at.node] + 2 * joinSeconds(at.metres) - leg.directTime;
      if (!Number.isFinite(t) || t / 60 >= minutes[s]) return;
      const to = trees[i].dist[at.node] + e[i].metres + at.metres;
      const from = trees[i + 1].dist[at.node] + e[i + 1].metres + at.metres;
      minutes[s] = Math.max(0, t) / 60;
      extra[s] = Math.max(0, to + from - leg.direct) / METRES_PER_MILE;
      along[s] = (leg.offset + to) / METRES_PER_MILE;
    });
    if (minutes[s] <= ROUTE_EXTRA_MINUTES) offRoute[s] = distanceToPath(net, path, p.easting, p.northing);
  });
  // A via point appears twice in the path (end of one leg, start of the next); harmless for distances.
  return { ok: true, miles: offset / METRES_PER_MILE, along, extra, minutes, offRoute, roads: runs, path, links: pathLinks, start: start.node, end: end.node };
}

export const toPlace = (lat: number, lon: number): Place => toBritishGrid(lat, lon);

// The roads the route follows, in order, for describing it (John, 1 November): each link's road number and length.
export type RoadRun = { road: string; metres: number };

// The main roads in order, joined where the same road carries on, leaving out short stretches (less than a mile) on other roads or
// none (roundabouts, short links), and any road used for less than ROUTE_ROAD_MILES in all, so only the roads that make the journey
// are named.
export const ROUTE_ROAD_MILES = 2;
export function mainRoads(runs: RoadRun[]): string[] {
  const join = (rs: RoadRun[]) =>
    rs.reduce<RoadRun[]>((out, r) => {
      const last = out[out.length - 1];
      if (last && last.road === r.road) last.metres += r.metres;
      else out.push({ ...r });
      return out;
    }, []);
  let rs = join(runs.filter((r) => r.road));
  rs = join(rs.filter((r) => r.metres >= METRES_PER_MILE));
  const total = new Map<string, number>();
  for (const r of rs) total.set(r.road, (total.get(r.road) ?? 0) + r.metres);
  return join(rs.filter((r) => total.get(r.road)! >= ROUTE_ROAD_MILES * METRES_PER_MILE)).map((r) => r.road);
}

// "the M4", "the A329(M) and M4", "the A322, M3, M25 and A24"; a road that comes back later is named again.
export function roadList(roads: string[]): string {
  if (roads.length === 0) return '';
  if (roads.length === 1) return `the ${roads[0]}`;
  return `the ${roads.slice(0, -1).join(', ')} and ${roads[roads.length - 1]}`;
}

export type RouteRow = { station: Station; prices: { e10?: Price; diesel?: Price }; along: number; extra: number; minutes: number; offRoute: number; fromEnd?: number };

// For comparison (John, 31 October): the cheapest of the eight stations nearest each end, as the main list would show them, at a usual
// price, that anyone can buy; and, in fairness to Costco (John, 1 November), a members-only Costco too when it is cheaper still, shown
// after it. Empty when none of the eight sells the fuel.
export function endChoices(eight: RouteRow[], fuel: 'e10' | 'diesel'): RouteRow[] {
  const usual = eight.filter((r) => r.prices[fuel] && !r.prices[fuel]!.x);
  const lowest = (rs: RouteRow[]) =>
    rs.length ? rs.reduce((a, b) => (b.prices[fuel]!.p < a.prices[fuel]!.p || (b.prices[fuel]!.p === a.prices[fuel]!.p && b.fromEnd! < a.fromEnd!) ? b : a)) : null;
  const open = lowest(usual.filter((r) => !membersOnly(r.station)));
  const costco = lowest(usual.filter((r) => membersOnly(r.station)));
  const out = open ? [open] : [];
  if (costco && (!open || costco.prices[fuel]!.p < open.prices[fuel]!.p)) out.push(costco);
  return out;
}

// The eight cheapest within three extra miles at a usual price, then in the order you'd reach them; and how many were within the
// three miles. Ties in price go to the smaller detour.
export function routeEight(candidates: RouteRow[], fuel: 'e10' | 'diesel', leaveOut: Set<string> = new Set()) {
  const within = candidates.filter((c) => !leaveOut.has(c.station.id) && c.extra <= ROUTE_EXTRA_MILES && c.minutes <= ROUTE_EXTRA_MINUTES && c.offRoute <= ROUTE_CORRIDOR_METRES && c.prices[fuel] && !c.prices[fuel]!.x);
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

// Today's opening hours in words, under a "Today" heading (John, 1 November: no second "today"): "Open 6am to 11pm", "Open 24 hours",
// "Closed", or the main list's notes.
export function todayText(s: Station, ms: number, bank: BankHolidays): string {
  if (hoursLookWrong(s)) return 'Opening hours look wrong';
  const u = ukNow(ms);
  const h = hoursOn(s, u.date, u.day, bank);
  if (h === null) return 'Opening hours not given';
  if (h === 'closed') return 'Closed';
  if (h === '24h' || h === '00:00-23:59' || h === '00:00-24:00') return 'Open 24 hours';
  return `Open ${clockText(h.slice(0, 5))} to ${clockText(h.slice(6, 11))}`;
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
// A place typed by name (src/lib/places.ts), kept as its label, e.g. "Andover, Hampshire".
export type PlaceName = { place: string; at?: string };
export type End = Pc | PlaceName;
export type RouteTarget = { kind: 'route'; from?: End; to?: End; via?: PlaceName };
const PC = /^([A-Z]{1,2}\d[A-Z\d]?)(?:-(\d[A-Z]{2}))?$/;
const readEnd = (s: string | undefined): End | undefined => {
  if (s?.startsWith('@') && s.length > 1) {
    const [place, at] = s.slice(1).split('~');
    return { place, ...(at ? { at } : {}) };
  }
  const m = s ? PC.exec(s.toUpperCase()) : null;
  return m ? { outcode: m[1], ...(m[2] ? { inward: m[2] } : {}) } : undefined;
};
export const isPlace = (e: End): e is PlaceName => 'place' in e;
// The address after "#": route/<from>/<to>[/<via>], each end "RG1", "RG1-8FR" or "@Exeter, Devon", the via "@Andover, Hampshire".
export function readRouteHash(h: string): RouteTarget | null {
  if (h !== 'route' && !h.startsWith('route/')) return null;
  const [, from, to, via] = h.split('/');
  const v = readEnd(via);
  const t: RouteTarget = { kind: 'route', from: readEnd(from), to: readEnd(to), via: v && isPlace(v) ? v : undefined };
  return t.from && t.to ? t : { kind: 'route' };
}
export const pcHash = (p: Pc) => (p.inward ? `${p.outcode}-${p.inward}` : p.outcode);
export const pcText = (p: Pc) => (p.inward ? `${p.outcode}\u00a0${p.inward}` : p.outcode);
export const endHash = (e: End) => (isPlace(e) ? `@${e.place}${e.at ? `~${e.at}` : ''}` : pcHash(e));
// As typed in a box: "RG1 8FR" or "Exeter, Devon".
export const endTyped = (e: End) => (isPlace(e) ? e.place : pcText(e).replace('\u00a0', ' '));
export function routeHash(t: RouteTarget): string {
  if (!t.from || !t.to) return 'route';
  return `route/${endHash(t.from)}/${endHash(t.to)}${t.via ? `/${endHash(t.via)}` : ''}`;
}

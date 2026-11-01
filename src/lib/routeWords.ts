// Describing the route the journey planner has chosen in a few words (John, 1 November 2026): "via the M25 and Dorking", "mainly by
// the M4". The rule (design/mock/route-mix-experiment.ts, agreed with John):
//   1. The route is split into stretches. A motorway stretch is named by its number; any other road by the town or city it passes
//      through or close by (within about two miles), a city first, else by its number.
//   2. If the next-best route takes nearly as long (within 15% of the time), name up to two stretches that route doesn't use (at
//      least 5 miles, or a tenth of the journey), a city first, then the longest: they tell the two apart.
//   3. Otherwise name the single longest stretch ("mainly by the M4", "via Bodmin").
//   4. At most two names, in the order you'd reach them. Towns at either end (within about 5 miles) are never named.
// All worked out on the visitor's device, like the route itself.
import { JUNCTION_SECONDS, tree, type Network, type Place } from './route.ts';

const MILE = 1609.344;
export const RIVAL_SLOWER = 0.15; // "nearly as long": the next-best route within 15% of the time
const THROUGH_METRES = 3200; // a town within about two miles of a stretch counts as on it
const END_METRES = 8000; // towns within about five miles of either end aren't named
const APART_METRES = 6400; // a town more than about four miles from the next-best route isn't on it
const PENALTY = 1.6; // the next-best route: the chosen route's links made 60% slower

export type Town = { name: string; e: number; n: number; city: boolean };
export type Path = { nodes: number[]; links: number[] };

export const isMotorway = (road: string) => /^M\d/.test(road) || road.endsWith('(M)');

const secondsOf = (net: Network, links: number[]) => links.reduce((s, k) => s + net.seconds[k] + JUNCTION_SECONDS, 0);
const metresOf = (net: Network, links: number[]) => links.reduce((s, k) => s + net.metres[k], 0);

// The shortest straight-line distance from a point to a line of road points.
function distTo(net: Network, nodes: number[], x: number, y: number): number {
  let best = Infinity;
  for (let i = 0; i + 1 < nodes.length; i++) {
    const ax = net.east[nodes[i]], ay = net.north[nodes[i]];
    const dx = net.east[nodes[i + 1]] - ax, dy = net.north[nodes[i + 1]] - ay;
    const len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len)) : 0;
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  if (nodes.length === 1) best = Math.hypot(x - net.east[nodes[0]], y - net.north[nodes[0]]);
  return best;
}

// The next-best route between the same two points: the chosen route's links made slower, so the quickest way avoids them if it can.
export function rival(net: Network, start: number, end: number, chosen: number[]): Path & { seconds: number } {
  const seconds = Float64Array.from(net.seconds);
  for (const k of chosen) {
    seconds[k] *= PENALTY;
    seconds[k ^ 1] *= PENALTY;
  }
  const t = tree({ ...net, seconds }, start);
  const nodes: number[] = [];
  const links: number[] = [];
  for (let v = end; v !== start && v >= 0; v = t.prev[v]) {
    nodes.push(v);
    links.push(t.via[v]);
  }
  nodes.push(start);
  nodes.reverse();
  links.reverse();
  return { nodes, links, seconds: secondsOf(net, links) };
}

// The route's roads in order, each with where it starts and ends along the route; short pieces folded away (as mainRoads does).
type Stretch = { road: string; metres: number; from: number; to: number };
export function stretches(net: Network, p: Path): Stretch[] {
  const join = (rs: Stretch[]) =>
    rs.reduce<Stretch[]>((out, x) => {
      const last = out[out.length - 1];
      if (last && last.road === x.road) {
        last.metres += x.metres;
        last.to = x.to;
      } else out.push({ ...x });
      return out;
    }, []);
  let rs = join(p.links.map((k, i) => ({ road: net.roads[net.road[k]] ?? '', metres: net.metres[k], from: i, to: i + 1 }))).filter((x) => x.road);
  rs = join(rs.filter((x) => x.metres >= MILE));
  const total = new Map<string, number>();
  for (const x of rs) total.set(x.road, (total.get(x.road) ?? 0) + x.metres);
  return join(rs.filter((x) => total.get(x.road)! >= 2 * MILE));
}

type Item = { place: boolean; name: string; miles: number; distinct: boolean; at: number; city: boolean };

// The words after "from X to Y,": "via the M25 and Dorking", "mainly by the M4", or "" if there's nothing to name.
export function routeWords(net: Network, chosen: Path, rivalRoute: (Path & { seconds: number }) | null, towns: Town[], from: Place, to: Place): string {
  const total = metresOf(net, chosen.links) / MILE;
  const close = !!rivalRoute && (rivalRoute.seconds - secondsOf(net, chosen.links)) / secondsOf(net, chosen.links) <= RIVAL_SLOWER;
  const rivalRoads = new Set(rivalRoute ? stretches(net, rivalRoute).map((s) => s.road) : []);
  const nearEnd = (t: Town) => Math.min(Math.hypot(t.e - from.easting, t.n - from.northing), Math.hypot(t.e - to.easting, t.n - to.northing)) < END_METRES;
  const items: Item[] = [];
  for (const s of stretches(net, chosen)) {
    const seg = chosen.nodes.slice(s.from, s.to + 1);
    const miles = s.metres / MILE;
    if (!isMotorway(s.road)) {
      const mid = seg[Math.floor(seg.length / 2)];
      const fromMid = (t: Town) => Math.hypot(t.e - net.east[mid], t.n - net.north[mid]);
      const town = towns
        .filter((t) => !nearEnd(t) && distTo(net, seg, t.e, t.n) < THROUGH_METRES)
        .sort((a, b) => (a.city ? 0 : 1) - (b.city ? 0 : 1) || fromMid(a) - fromMid(b))[0];
      if (town) {
        const distinct = !!rivalRoute && distTo(net, rivalRoute.nodes, town.e, town.n) > APART_METRES;
        items.push({ place: true, name: town.name, miles, distinct, at: s.from, city: town.city });
        continue;
      }
    }
    items.push({ place: false, name: s.road, miles, distinct: !!rivalRoute && !rivalRoads.has(s.road), at: s.from, city: false });
  }
  // A place or road that carries on from one stretch to the next is one item.
  const merged = items.reduce<Item[]>((out, x) => {
    const last = out[out.length - 1];
    if (last && last.name === x.name) last.miles += x.miles;
    else out.push({ ...x });
    return out;
  }, []);
  if (!merged.length) return '';
  const rank = (a: Item, b: Item) => (a.city ? 0 : 1) - (b.city ? 0 : 1) || b.miles - a.miles;
  const telling = merged.filter((x) => x.distinct && x.miles >= Math.max(5, total / 10));
  const useRival = close && telling.length > 0;
  const pick = (useRival ? [...telling].sort(rank).slice(0, 2) : [...merged].sort(rank).slice(0, 1)).sort((a, b) => a.at - b.at);
  // "the M25 and Dorking"; "the M1 and M6" (one "the" for two roads together); "Salisbury".
  const words = pick.map((x, i) => (x.place ? x.name : i > 0 && !pick[i - 1].place ? x.name : `the ${x.name}`));
  const list = words.length === 1 ? words[0] : `${words[0]} and ${words[1]}`;
  return !useRival && !pick[0].place ? `mainly by ${list}` : `via ${list}`;
}

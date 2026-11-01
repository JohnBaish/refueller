// Experiment (1 November 2026, notes only): a rule mixing places and road numbers in the route sentence (see CLAUDE.md log).
import { readFileSync } from 'node:fs';
import { makeNetwork, snap, tree, toPlace, type Network } from '/home/user/refueller/src/lib/route.ts';
const net = makeNetwork(JSON.parse(readFileSync('/home/user/refueller/data/route-roads.json', 'utf8')));
const places = JSON.parse(readFileSync('/home/user/refueller/data/places.json', 'utf8')).places as any[];
const towns = places.filter((p) => p[5] === 'c' || p[5] === 't').map((p) => ({ name: p[0], kind: p[5], g: toPlace(p[3], p[4]) }));
const find = (s: string) => { const [n, a] = s.split('|'); const p = places.find((x) => x[0] === n && (!a || x[2] === a)); return toPlace(p[3], p[4]); };
const MILE = 1609.344;
const isMotorway = (r: string) => /^M\d/.test(r) || r.endsWith('(M)');
function route(n: Network, from: any, to: any) {
  const a = snap(n, from)!, b = snap(n, to)!;
  const t = tree(n, a.node);
  const nodes: number[] = [], links: number[] = [];
  for (let v = b.node; v !== a.node; v = t.prev[v]) { nodes.push(v); links.push(t.via[v]); }
  nodes.push(a.node);
  return { nodes: nodes.reverse(), links: links.reverse() };
}
const time = (links: number[]) => links.reduce((s, k) => s + net.seconds[k] + 15, 0);
const lenM = (links: number[]) => links.reduce((s, k) => s + net.metres[k], 0);
function distTo(nodes: number[], x: number, y: number) {
  let best = Infinity;
  for (let i = 0; i + 1 < nodes.length; i++) {
    const ax = net.east[nodes[i]], ay = net.north[nodes[i]], dx = net.east[nodes[i + 1]] - ax, dy = net.north[nodes[i + 1]] - ay;
    const L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L)) : 0;
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return best;
}
// Runs: the route's roads in order with their node ranges; short pieces folded into neighbours (as mainRoads does).
type Run = { road: string; metres: number; from: number; to: number };
function runsOf(r: { nodes: number[]; links: number[] }): Run[] {
  const join = (rs: Run[]) => rs.reduce<Run[]>((o, x) => { const l = o[o.length - 1]; if (l && l.road === x.road) { l.metres += x.metres; l.to = x.to; } else o.push({ ...x }); return o; }, []);
  let rs = join(r.links.map((k, i) => ({ road: net.roads[net.road[k]] ?? '', metres: net.metres[k], from: i, to: i + 1 })));
  rs = rs.filter((x) => x.road);
  rs = join(rs.filter((x) => x.metres >= MILE));
  const total = new Map<string, number>(); for (const x of rs) total.set(x.road, (total.get(x.road) ?? 0) + x.metres);
  return join(rs.filter((x) => total.get(x.road)! >= 2 * MILE));
}
type Item = { kind: 'road' | 'place'; name: string; miles: number; distinct: boolean; at: number; city?: boolean };
function describe(fromName: string, toName: string, from: any, to: any) {
  const best = route(net, from, to);
  const pen = { ...net, seconds: Float64Array.from(net.seconds) };
  for (const k of best.links) { pen.seconds[k] *= 1.6; pen.seconds[k ^ 1] *= 1.6; }
  const alt = route(pen, from, to);
  const slower = (time(alt.links) - time(best.links)) / time(best.links);
  const altRoads = new Set(runsOf(alt).map((r) => r.road));
  const nearEnd = (g: any) => Math.min(Math.hypot(g.easting - from.easting, g.northing - from.northing), Math.hypot(g.easting - to.easting, g.northing - to.northing)) < 8000;
  const items: Item[] = [];
  for (const r of runsOf(best)) {
    const seg = best.nodes.slice(r.from, r.to + 1);
    const miles = r.metres / MILE;
    if (isMotorway(r.road)) { items.push({ kind: 'road', name: r.road, miles, distinct: !altRoads.has(r.road), at: r.from }); continue; }
    // Another road: the place it goes through (within about half a mile), a city before a town, else the road's number.
    const mid = seg[Math.floor(seg.length / 2)];
    const through = towns.filter((w) => !nearEnd(w.g) && distTo(seg, w.g.easting, w.g.northing) < 3200)
      .sort((a, b) => (a.kind === 'c' ? 0 : 1) - (b.kind === 'c' ? 0 : 1) || Math.hypot(a.g.easting - net.east[mid], a.g.northing - net.north[mid]) - Math.hypot(b.g.easting - net.east[mid], b.g.northing - net.north[mid]));
    const w = through[0];
    if (w) items.push({ kind: 'place', name: w.name, city: w.kind === 'c', miles, distinct: distTo(alt.nodes, w.g.easting, w.g.northing) > 6400, at: r.from });
    else items.push({ kind: 'road', name: r.road, miles, distinct: !altRoads.has(r.road), at: r.from });
  }
  const merged = items.filter((x, i) => i === 0 || x.name !== items[i - 1].name);
  // What to say: when another route is close (within 15%), only what this route has and that one hasn't, up to two, the longest;
  // otherwise just the longest stretch.
  let pick: Item[];
  const total = lenM(best.links) / MILE;
  const big = (x: Item) => x.miles >= Math.max(5, total / 10);
  const distinct = merged.filter((x) => x.distinct && big(x));
  const rank = (a: Item, b: Item) => (a.city ? 0 : 1) - (b.city ? 0 : 1) || b.miles - a.miles; // a city first, then the longest
  if (slower <= 0.15 && distinct.length) pick = [...distinct].sort(rank).slice(0, 2);
  else pick = [...merged].sort(rank).slice(0, 1);
  pick.sort((a, b) => a.at - b.at);
  // "the M25 and Dorking", "the M1 and M6" (one "the" for two roads together), "Wilton".
  const words = pick.map((x, i) => (x.kind === 'road' ? (i > 0 && pick[i - 1].kind === 'road' ? x.name : `the ${x.name}`) : x.name));
  const list = words.length === 1 ? words[0] : `${words[0]} and ${words[1]}`;
  const fallback = !(slower <= 0.15 && distinct.length);
  const lead = fallback && pick[0].kind === 'road' ? `mainly by ${list}` : `via ${list}`;
  return { s: `Refueller has planned a route of about ${Math.round(lenM(best.links) / MILE)} miles from ${fromName} to ${toName}, ${lead}.`, slower, all: merged.map((x) => `${x.name}${x.distinct ? '*' : ''} ${x.miles.toFixed(0)}`).join(', ') };
}
for (const [f, t] of [['Wokingham', 'Horsham|West Sussex'], ['Reading', 'Bristol'], ['Reading', 'Exeter'], ['Reading', 'Downham Market'], ['Oxford|Oxfordshire', 'Brighton'], ['Bath', 'Southampton'], ['Leeds|Leeds', 'Manchester'], ['Cambridge|Cambridgeshire', 'Oxford|Oxfordshire'], ['Guildford|Surrey', 'Brighton'], ['Reading', 'Southampton'], ['London|Greater London', 'Birmingham'], ['Cardiff', 'Bristol'], ['Norwich', 'Ipswich'], ['York', 'Scarborough|North Yorkshire'], ['Exeter', 'Penzance'], ['Carlisle', 'Newcastle upon Tyne'], ['Swindon|Swindon', 'Gloucester'], ['Bath', 'Salisbury|Wiltshire'], ['Reading', 'Oxford|Oxfordshire'], ['Worcester', 'Hereford']]) {
  const n = (s: string) => s.split('|')[0];
  const d = describe(n(f), n(t), find(f), find(t));
  console.log(`${d.s}\n   [next best ${(d.slower * 100).toFixed(0)}% slower; stretches: ${d.all}]`);
}

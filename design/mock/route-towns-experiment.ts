// Experiment (1 November 2026, notes only): the next-best route for each journey (the chosen route's links made 60% slower), and
// towns within about 1.5 miles of the chosen route but more than 4 miles from the other, to name in the route sentence.
import { readFileSync } from 'node:fs';
import { makeNetwork, snap, tree, mainRoads, roadList, toPlace, type Network, type RoadRun } from '/home/user/refueller/src/lib/route.ts';
const file = JSON.parse(readFileSync('/home/user/refueller/data/route-roads.json', 'utf8'));
const net = makeNetwork(file);
const places = JSON.parse(readFileSync('/home/user/refueller/data/places.json', 'utf8')).places as any[];
const towns = places.filter((p) => p[5] === 'c' || p[5] === 't').map((p) => ({ name: p[0], kind: p[5], g: toPlace(p[3], p[4]) }));
const find = (s: string) => { const [n, a] = s.split('|'); const p = places.find((x) => x[0] === n && (!a || x[2] === a)); return toPlace(p[3], p[4]); };
const MILE = 1609.344;
function route(n: Network, from: any, to: any) {
  const a = snap(n, from)!, b = snap(n, to)!;
  const t = tree(n, a.node);
  const nodes: number[] = [], links: number[] = [];
  for (let v = b.node; v !== a.node; v = t.prev[v]) { nodes.push(v); links.push(t.via[v]); }
  nodes.push(a.node);
  return { nodes: nodes.reverse(), links: links.reverse() };
}
const realTime = (links: number[]) => links.reduce((s, k) => s + net.seconds[k] + 15, 0);
const miles = (links: number[]) => links.reduce((s, k) => s + net.metres[k], 0) / MILE;
const segDist = (nodes: number[], x: number, y: number) => {
  let best = Infinity;
  for (let i = 0; i + 1 < nodes.length; i++) {
    const ax = net.east[nodes[i]], ay = net.north[nodes[i]], dx = net.east[nodes[i + 1]] - ax, dy = net.north[nodes[i + 1]] - ay;
    const L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L)) : 0;
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return best;
};
function along(nodes: number[], x: number, y: number) { // fraction along the route of nearest node
  let bi = 0, bd = Infinity; nodes.forEach((v, i) => { const d = Math.hypot(net.east[v] - x, net.north[v] - y); if (d < bd) [bi, bd] = [i, d]; }); return bi / (nodes.length - 1);
}
for (const [f, t] of [['Wokingham', 'Horsham|West Sussex'], ['Reading', 'Bristol'], ['Reading', 'Exeter'], ['Reading', 'Downham Market'], ['Oxford|Oxfordshire', 'Brighton'], ['Bath', 'Southampton'], ['Leeds|Leeds', 'Manchester'], ['Cambridge|Cambridgeshire', 'Oxford|Oxfordshire'], ['Guildford|Surrey', 'Brighton'], ['Reading', 'Southampton'], ['London|Greater London', 'Birmingham']]) {
  const from = find(f), to = find(t);
  const best = route(net, from, to);
  // A second route: the same network with the chosen route's links made 60% slower.
  const pen = { ...net, seconds: Float64Array.from(net.seconds) };
  for (const k of best.links) { pen.seconds[k] *= 1.6; pen.seconds[k ^ 1] *= 1.6; }
  const alt = route(pen, from, to);
  const tb = realTime(best.links) / 60, ta = realTime(alt.links) / 60;
  const runs = (ls: number[]): RoadRun[] => ls.map((k) => ({ road: net.roads[net.road[k]] ?? '', metres: net.metres[k] }));
  // Towns within about a mile of the chosen route, more than 4 miles from the other, not near either end.
  const cands = towns.map((w) => ({ w, d: segDist(best.nodes, w.g.easting, w.g.northing), da: segDist(alt.nodes, w.g.easting, w.g.northing), f: along(best.nodes, w.g.easting, w.g.northing),
    de: Math.min(Math.hypot(w.g.easting - from.easting, w.g.northing - from.northing), Math.hypot(w.g.easting - to.easting, w.g.northing - to.northing)) }))
    .filter((c) => c.d < 2500 && c.da > 6400 && c.de > 8000);
  cands.sort((a, b) => (a.w.kind === 'c' ? 0 : 1) - (b.w.kind === 'c' ? 0 : 1) || Math.abs(a.f - 0.5) - Math.abs(b.f - 0.5));
  const name = (s: string) => s.split('|')[0];
  console.log(`\n${name(f)} to ${name(t)}: chosen ${miles(best.links).toFixed(0)} mi, ${tb.toFixed(0)} min, ${roadList(mainRoads(runs(best.links)))}`);
  console.log(`   next best ${miles(alt.links).toFixed(0)} mi, ${ta.toFixed(0)} min (+${(((ta - tb) / tb) * 100).toFixed(0)}%), ${roadList(mainRoads(runs(alt.links)))}`);
  // Up to two towns: the one furthest from the other route, then the next furthest well apart from it along the way; in route order.
  const byDa = [...cands].sort((a, b) => b.da - a.da);
  const two = byDa.length ? [byDa[0], ...byDa.slice(1).filter((c) => Math.abs(c.f - byDa[0].f) > 0.15).slice(0, 1)].sort((a, b) => a.f - b.f) : [];
  const via = two.map((c) => c.w.name).join(' and ');
  const close = (ta - tb) / tb <= 0.15;
  console.log(`   SENTENCE: Refueller has planned a route of about ${miles(best.links).toFixed(0)} miles from ${name(f)} to ${name(t)}${via ? ` via ${via}` : ''}, by ${roadList(mainRoads(runs(best.links)))}.${close ? '' : '   [next best is more than 15% slower]'}`);
  console.log(`   towns only on the chosen route: ${cands.slice(0, 8).map((c) => `${c.w.name} (${c.f.toFixed(2)}, ${(c.da/1609).toFixed(0)} mi off)`).join(', ') || 'none'}`);
}

// Mock-up only: real journeys on the motorway + A + B road network (OS Open Roads), with today's real prices.
// For each station: extra miles = road(start→station) + road(station→end) − road(start→end), the station joined to the
// nearest road point in a straight line (counted there and back). Candidates: at most 3 extra miles, usual price.
import { readFileSync, writeFileSync } from 'node:fs';
const R = '/home/user/refueller/';
const { toBritishGrid } = await import(R + 'scripts/lib/grid.ts');
const S = await import(R + 'src/lib/search.ts');
const G = JSON.parse(readFileSync('/tmp/claude-0/-home-user/d7a6fee5-4206-5672-972f-81c453fe6f20/scratchpad/journey/graph-mab-timed.json', 'utf8'));
const oc = JSON.parse(readFileSync(R + 'data/outcodes.json', 'utf8')).outcodes;
const st = JSON.parse(readFileSync(R + 'data/stations.json', 'utf8'));
const pr = JSON.parse(readFileSync(R + 'data/prices.json', 'utf8'));
const bank = JSON.parse(readFileSync(R + 'data/bank-holidays.json', 'utf8'));
const NOW = Date.parse(pr.collected);
const N = G.n.length;
const head = new Int32Array(N).fill(-1), nxt = new Int32Array(G.e.length * 2), to = new Int32Array(G.e.length * 2), w = new Float64Array(G.e.length * 2), len = new Float64Array(G.e.length * 2);
G.e.forEach(([a, b, l, t]: number[], i: number) => { for (const [x, y, k] of [[a, b, 2 * i], [b, a, 2 * i + 1]]) { to[k] = y; w[k] = t; len[k] = l * 10; nxt[k] = head[x]; head[x] = k; } });
// grid of nodes, 2 km cells
const cell = (e: number, n: number) => `${Math.floor(e / 2000)},${Math.floor(n / 2000)}`;
const grid = new Map<string, number[]>();
for (let i = 0; i < N; i++) { const k = cell(G.n[i][0] * 10, G.n[i][1] * 10); (grid.get(k) ?? grid.set(k, []).get(k)!).push(i); }
function snap(e: number, n: number): [number, number] {
  let best = -1, bd = Infinity;
  for (let r = 0; r < 30 && (best < 0 || r < 2); r++) {
    const cx = Math.floor(e / 2000), cy = Math.floor(n / 2000);
    for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      for (const i of grid.get(`${cx + dx},${cy + dy}`) ?? []) { const d = Math.hypot(G.n[i][0] * 10 - e, G.n[i][1] * 10 - n); if (d < bd) { bd = d; best = i; } }
    }
  }
  return [best, bd];
}
// Fastest route by the rough speeds (time), but the miles along it are what's reported.
function tree(a: number): Float64Array {
  const time = new Float64Array(N).fill(Infinity), dist = new Float64Array(N).fill(Infinity); time[a] = 0; dist[a] = 0; const h: [number, number][] = [[0, a]];
  const push = (x: [number, number]) => { h.push(x); let i = h.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (h[p][0] <= h[i][0]) break; [h[p], h[i]] = [h[i], h[p]]; i = p; } };
  const pop = () => { const t = h[0], l = h.pop()!; if (h.length) { h[0] = l; let i = 0; for (;;) { const a = 2 * i + 1, b = a + 1; let m = i; if (a < h.length && h[a][0] < h[m][0]) m = a; if (b < h.length && h[b][0] < h[m][0]) m = b; if (m === i) break; [h[m], h[i]] = [h[i], h[m]]; i = m; } } return t; };
  while (h.length) { const [d, u] = pop(); if (d > time[u]) continue; for (let k = head[u]; k >= 0; k = nxt[k]) { const v = to[k], nd = d + w[k]; if (nd < time[v]) { time[v] = nd; dist[v] = dist[u] + len[k]; push([nd, v]); } } }
  return dist;
}
const MI = 1609.344;
const stations = st.stations.filter((s: any) => !s.temporarilyClosed && S.positionAgrees(s, oc));
const snapped = stations.map((s: any) => { const g = toBritishGrid(s.lat, s.lon); return snap(g.easting, g.northing); });
const u = S.ukNow(NOW);
function hoursToday(s: any): string {
  const h = S.hoursOn(s, u.date, u.day, bank);
  if (S.hoursLookWrong(s)) return 'Opening hours look wrong';
  if (h === null) return 'Opening hours not given';
  if (h === '24h' || h === '00:00-23:59') return 'Open 24 hours today';
  if (h === 'closed') return 'Closed today';
  return `Today ${S.clockText(h.slice(0, 5))} to ${S.clockText(h.slice(6, 11))}`;
}
function journey(from: string, to_: string, fuel: 'e10' | 'diesel', cap = 3) {
  const A = toBritishGrid(oc[from][0], oc[from][1]), B = toBritishGrid(oc[to_][0], oc[to_][1]);
  const [sa, da] = snap(A.easting, A.northing), [sb, db] = snap(B.easting, B.northing);
  const dA = tree(sa), dB = tree(sb);
  const direct = dA[sb] + da + db;
  const cands = stations.map((s: any, i: number) => {
    const [n, d] = snapped[i];
    const p = pr.prices[s.id]?.[fuel];
    if (!p || p.x || !Number.isFinite(dA[n]) || !Number.isFinite(dB[n])) return null;
    const along = dA[n] + da + d, extra = along + dB[n] + db + d - direct;
    return { s, p, along: along / MI, extra: Math.max(0, extra) / MI };
  }).filter((c: any) => c && c.extra <= cap);
  cands.sort((a: any, b: any) => a.p.p - b.p.p || a.extra - b.extra);
  const eight = cands.slice(0, 8);
  const row = (c: any) => ({ brand: c.s.brand, name: S.tidyName(c.s.name), address: S.tidyAddress(c.s), price: c.p.p, upd: S.updatedText(c.p.u, NOW), old: S.isOld(c.p.u, NOW), along: c.along, extra: c.extra, hours: hoursToday(c.s), members: /costco/i.test(c.s.brand + ' ' + c.s.name) });
  const all = eight.map((c: any) => c.p.p).sort((a: number, b: number) => a - b);
  return {
    from, to: to_, fromPlace: oc[from][2], toPlace: oc[to_][2], fuel, cap,
    all8: cands.map(row),
    direct: direct / MI, straight: Math.hypot(A.easting - B.easting, A.northing - B.northing) / MI, within: cands.length,
    rows: eight.map((c: any) => ({
      brand: c.s.brand, name: S.tidyName(c.s.name), address: S.tidyAddress(c.s), price: c.p.p, upd: S.updatedText(c.p.u, NOW), old: S.isOld(c.p.u, NOW),
      cheapest: c.p.p === all[0], rank: S.rankText(c.p.p, all), all, along: c.along, extra: c.extra, hours: hoursToday(c.s), motorway: !!c.s.motorway,
    })),
  };
}
const out = [journey('RG1', 'BS1', 'e10'), journey('RG1', 'BS1', 'diesel'), journey('CF10', 'BS1', 'e10')];
for (const j of out) { console.log(j.from, j.to, j.fuel, 'direct', j.direct.toFixed(1), 'straight', j.straight.toFixed(1), 'within cap', j.within); for (const r of j.rows) console.log('  ', r.price, r.name, r.brand, r.along.toFixed(0), 'mi along,', r.extra.toFixed(1), 'extra |', r.hours, r.motorway ? 'MOTORWAY' : ''); }
console.log('collected', pr.collected, u);
writeFileSync('/home/user/refueller/design/mock/journeys-2026-10-31.json', JSON.stringify(out));

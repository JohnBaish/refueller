// Builds data/route-roads.json: the main roads of Great Britain (motorways, A roads and B roads from OS Open Roads), for
// "Find cheaper fuel near the route" (John, 31 October 2026). The page downloads it only when someone plans a journey, and works
// the route out on their own device, so nothing they type leaves it.
//
// Chains of links through points with only two roads are joined into one, keeping each one's length and a rough driving time.
// The times are only for choosing the route a driver would take (the M4 rather than the shorter A4 through Marlborough); they
// aren't shown. Speeds (mph): motorways 62, slip roads 35, roundabouts 15; A roads on the primary route network 55 dual and
// 45 single carriageway, other A roads 45 and 35; B roads 30. One-way streets and turns aren't known (Open Roads doesn't carry
// them), so routes can be a little short of a sat nav's.
//
// `npm run route-roads <Open Roads data folder>` (the same download as `npm run road-miles`); about a minute. Rebuild when OS
// updates Open Roads (twice a year).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { dbfFields, linkEnds } from './build-road-miles.ts';

const KEEP = new Set(['Motorway', 'A Road', 'B Road']);

export function speedMph(cls: string, formOfWay: string, primary: boolean): number {
  if (formOfWay === 'Roundabout') return 15;
  if (formOfWay === 'Slip Road') return 35;
  if (cls === 'Motorway') return 62;
  const dual = formOfWay.includes('Dual');
  if (cls === 'A Road') return primary ? (dual ? 55 : 45) : dual ? 45 : 35;
  return 30;
}

type Link = { a: string; b: string; metres: number; seconds: number; ea: [number, number]; eb: [number, number]; road?: string };

// Joins chains through points where exactly two links meet. Loops made only of such points are dropped (rare, and never part of a
// through route). Exported for the check.
export function joinChains(links: Link[]) {
  const at = new Map<string, number[]>();
  const pos = new Map<string, [number, number]>();
  links.forEach((l, i) => {
    for (const [n, p] of [
      [l.a, l.ea],
      [l.b, l.eb],
    ] as const) {
      (at.get(n) ?? at.set(n, []).get(n)!).push(i);
      pos.set(n, p);
    }
  });
  const ends = [...at.keys()].filter((n) => at.get(n)!.length !== 2).sort();
  const index = new Map(ends.map((n, k) => [n, k]));
  const seen = new Uint8Array(links.length);
  const edges: [number, number, number, number, string][] = [];
  for (const n of ends) {
    for (const first of at.get(n)!) {
      if (seen[first]) continue;
      let cur = n;
      let link = first;
      let metres = 0;
      let seconds = 0;
      let end: string;
      // The road number of a joined chain: the one with most length in it (a chain rarely changes number).
      const byRoad = new Map<string, number>();
      for (;;) {
        seen[link] = 1;
        const l = links[link];
        metres += l.metres;
        seconds += l.seconds;
        if (l.road) byRoad.set(l.road, (byRoad.get(l.road) ?? 0) + l.metres);
        end = l.a === cur ? l.b : l.a;
        if (index.has(end)) break;
        const other = at.get(end)!.find((j) => j !== link)!;
        if (seen[other]) break;
        cur = end;
        link = other;
      }
      const road = [...byRoad].sort((x, y) => y[1] - x[1])[0]?.[0] ?? '';
      if (index.has(end)) edges.push([index.get(n)!, index.get(end)!, metres, seconds, road]);
    }
  }
  return { points: ends.map((n) => pos.get(n)!), edges };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const folder = process.argv[2];
  if (!folder) throw new Error('Usage: npm run route-roads <Open Roads data folder>');
  const links: Link[] = [];
  for (const file of readdirSync(folder).filter((f) => f.endsWith('_RoadLink.dbf')).sort()) {
    const dbf = readFileSync(join(folder, file));
    const shp = readFileSync(join(folder, file.replace(/\.dbf$/, '.shp')));
    const { count, headerLength, recordLength, fields } = dbfFields(dbf);
    const get = (name: string, at: number) => {
      const f = fields.get(name)!;
      return dbf.toString('latin1', at + f.offset, at + f.offset + f.length).trim();
    };
    const ends = linkEnds(shp);
    for (let r = 0; r < count; r++) {
      const at = headerLength + r * recordLength;
      const e = ends.next().value;
      const cls = get('class', at);
      if (!e || !KEEP.has(cls)) continue;
      const metres = Number(get('length', at)) || Math.hypot(e[2] - e[0], e[3] - e[1]);
      const mph = speedMph(cls, get('formOfWay', at), get('primary', at) === 'true');
      links.push({ a: get('startNode', at), b: get('endNode', at), metres, seconds: metres / (mph * 0.44704), ea: [e[0], e[1]], eb: [e[2], e[3]], road: get('roadNumber', at) });
    }
    process.stdout.write(`${file} `);
  }
  const { points, edges } = joinChains(links);
  const licence = readFileSync(join(folder, '..', 'doc', 'licence.txt'), 'utf8');
  const credit = /Contains Ordnance Survey data[^\n]*/.exec(licence)?.[0].trim();
  if (!credit) throw new Error('No credit line in doc/licence.txt');
  const out = {
    note: 'Main roads of Great Britain for "Find cheaper fuel near the route" (scripts/build-route-roads.ts). n: points, easting and northing in tens of metres, in pairs; e: links, [point, point, length in tens of metres, rough driving time in seconds] in fours; r: road numbers; k: each link\'s road number, as its place in r (-1 for none).',
    credit,
    made: new Date().toISOString().slice(0, 10),
    n: points.flatMap(([e, n]) => [Math.round(e / 10), Math.round(n / 10)]),
    e: edges.flatMap(([a, b, m, s]) => [a, b, Math.max(1, Math.round(m / 10)), Math.max(1, Math.round(s))]),
    // Road numbers (M4, A329(M)), for describing the route (John, 1 November).
    r: [...new Set(edges.map((x) => x[4]).filter(Boolean))].sort(),
    k: [] as number[],
  };
  const roadIndex = new Map(out.r.map((x, i) => [x, i]));
  out.k = edges.map((x) => (x[4] ? roadIndex.get(x[4])! : -1));
  const root = new URL('..', import.meta.url).pathname;
  writeFileSync(join(root, 'data/route-roads.json'), JSON.stringify(out));
  console.log(`\n${links.length} links kept; ${points.length} points and ${edges.length} joined links written to data/route-roads.json`);
}

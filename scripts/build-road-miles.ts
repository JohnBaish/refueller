// Builds data/road-miles.json: road distances, in tenths of a mile, from the middle of every postcode district to its 12
// nearest stations, and from every station to its 12 nearest other stations. The "Worth driving here?" calculator uses them
// for the extra miles there and back (John, 30 October 2026; design/road-routing-feasibility-2026-10-30.md). Worked out once
// here, from every road in OS Open Roads, so visitors download a small table rather than a road map, and nothing they type
// leaves their device.
//
// Shortest routes over every road, ignoring one-way streets and turns (Open Roads doesn't carry them), so the figures are
// probably a little short of a sat nav's; each end joins the nearest road in a straight line. Stations listed after this was
// built have no figure: the calculator then asks the visitor for the miles. Rebuild when OS updates Open Roads, or when many
// stations have come and gone.
//
// `npm run road-miles <Open Roads data folder>` (the unzipped download's data/ folder, holding the *_RoadLink.dbf and .shp
// files; not kept in the repo; about 3 GB):
//   https://api.os.uk/downloads/v1/products/OpenRoads/downloads?area=GB&format=ESRI%C2%AE+Shapefile&redirect
// Needs a lot of memory: run with NODE_OPTIONS=--max-old-space-size=8192.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { toBritishGrid } from './lib/grid.ts';

export const NEIGHBOURS = 12; // more than the eight shown, as some are left out on the page (temporarily closed, far from their postcode)
const SNAP_METRES = 2000; // a point further than this from any road gets no figures
const METRES_PER_MILE = 1609.344;

type Point = { easting: number; northing: number };

// --- Reading OS Open Roads (the dBase table and the shapes beside it) ----------------------------------------------------

function dbfFields(buf: Buffer) {
  const headerLength = buf.readUInt16LE(8);
  const recordLength = buf.readUInt16LE(10);
  const fields = new Map<string, { offset: number; length: number }>();
  let offset = 1; // each record starts with a deleted flag
  for (let at = 32; buf[at] !== 0x0d; at += 32) {
    const name = buf.toString('latin1', at, at + 11).replace(/\0.*$/, '');
    const length = buf[at + 16];
    fields.set(name, { offset, length });
    offset += length;
  }
  return { count: buf.readUInt32LE(4), headerLength, recordLength, fields };
}

// The first and last point of each road link, in record order.
function* linkEnds(shp: Buffer): Generator<[number, number, number, number] | null> {
  for (let at = 100; at + 8 <= shp.length; ) {
    const length = shp.readInt32BE(at + 4) * 2;
    const body = at + 8;
    at = body + length;
    if (shp.readInt32LE(body) === 0) {
      yield null;
      continue;
    }
    const parts = shp.readInt32LE(body + 36);
    const points = shp.readInt32LE(body + 40);
    const first = body + 44 + 4 * parts;
    const last = first + 16 * (points - 1);
    yield [shp.readDoubleLE(first), shp.readDoubleLE(first + 8), shp.readDoubleLE(last), shp.readDoubleLE(last + 8)];
  }
}

export type Roads = { east: Float64Array; north: Float64Array; head: Int32Array; next: Int32Array; to: Int32Array; length: Float32Array };

export function readRoads(folder: string): Roads {
  const ids = new Map<string, number>();
  const east: number[] = [];
  const north: number[] = [];
  const from: number[] = [];
  const toList: number[] = [];
  const lengths: number[] = [];
  const node = (id: string, e: number, n: number) => {
    let k = ids.get(id);
    if (k === undefined) {
      k = east.length;
      ids.set(id, k);
      east.push(e);
      north.push(n);
    }
    return k;
  };
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
      if (!e) continue;
      const a = node(get('startNode', at), e[0], e[1]);
      const b = node(get('endNode', at), e[2], e[3]);
      from.push(a);
      toList.push(b);
      lengths.push(Number(get('length', at)) || Math.hypot(e[2] - e[0], e[3] - e[1]));
    }
    process.stdout.write(`${file} `);
  }
  // Both directions of every link, as linked lists by starting point.
  const nodes = east.length;
  const head = new Int32Array(nodes).fill(-1);
  const next = new Int32Array(from.length * 2);
  const to = new Int32Array(from.length * 2);
  const length = new Float32Array(from.length * 2);
  for (let i = 0; i < from.length; i++) {
    for (const [x, y, k] of [
      [from[i], toList[i], 2 * i],
      [toList[i], from[i], 2 * i + 1],
    ]) {
      to[k] = y;
      length[k] = lengths[i];
      next[k] = head[x];
      head[x] = k;
    }
  }
  console.log(`\n${nodes} junctions, ${from.length} road links`);
  return { east: Float64Array.from(east), north: Float64Array.from(north), head, next, to, length };
}

// --- Finding the nearest road, and the shortest routes -------------------------------------------------------------------

const CELL = 1000;
export function snapper(roads: Roads) {
  const cells = new Map<number, number[]>();
  const key = (cx: number, cy: number) => cx * 100000 + cy;
  for (let i = 0; i < roads.east.length; i++) {
    const k = key(Math.floor(roads.east[i] / CELL), Math.floor(roads.north[i] / CELL));
    let list = cells.get(k);
    if (!list) cells.set(k, (list = []));
    list.push(i);
  }
  return (p: Point): { node: number; metres: number } | null => {
    const cx = Math.floor(p.easting / CELL);
    const cy = Math.floor(p.northing / CELL);
    let best = -1;
    let bestD = Infinity;
    const reach = Math.ceil(SNAP_METRES / CELL);
    for (let dx = -reach; dx <= reach; dx++)
      for (let dy = -reach; dy <= reach; dy++)
        for (const i of cells.get(key(cx + dx, cy + dy)) ?? []) {
          const d = Math.hypot(roads.east[i] - p.easting, roads.north[i] - p.northing);
          if (d < bestD) [best, bestD] = [i, d];
        }
    return best >= 0 && bestD <= SNAP_METRES ? { node: best, metres: bestD } : null;
  };
}

// Shortest distances in metres from one junction to each target junction, giving up beyond `limit` metres.
export function routes(roads: Roads, start: number, targets: Set<number>, limit: number, dist: Float64Array, touched: number[]) {
  const found = new Map<number, number>();
  const heapD: number[] = [0];
  const heapN: number[] = [start];
  dist[start] = 0;
  touched.push(start);
  const swap = (i: number, j: number) => {
    [heapD[i], heapD[j]] = [heapD[j], heapD[i]];
    [heapN[i], heapN[j]] = [heapN[j], heapN[i]];
  };
  while (heapD.length && found.size < targets.size) {
    const d = heapD[0];
    const u = heapN[0];
    const lastD = heapD.pop()!;
    const lastN = heapN.pop()!;
    if (heapD.length) {
      heapD[0] = lastD;
      heapN[0] = lastN;
      for (let i = 0; ; ) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < heapD.length && heapD[l] < heapD[m]) m = l;
        if (r < heapD.length && heapD[r] < heapD[m]) m = r;
        if (m === i) break;
        swap(i, m);
        i = m;
      }
    }
    if (d > dist[u]) continue;
    if (d > limit) break;
    if (targets.has(u) && !found.has(u)) found.set(u, d);
    for (let k = roads.head[u]; k >= 0; k = roads.next[k]) {
      const v = roads.to[k];
      const nd = d + roads.length[k];
      if (nd < dist[v]) {
        if (dist[v] === Infinity) touched.push(v);
        dist[v] = nd;
        heapD.push(nd);
        heapN.push(v);
        for (let i = heapD.length - 1; i > 0; ) {
          const p = (i - 1) >> 1;
          if (heapD[p] <= heapD[i]) break;
          swap(i, p);
          i = p;
        }
      }
    }
  }
  return found;
}

// --- The table --------------------------------------------------------------------------------------------------------

type Place = { key: string; at: Point };

export function roadMiles(roads: Roads, origins: Place[], stations: Place[], skipSelf: boolean) {
  const snap = snapper(roads);
  const stationSnap = stations.map((s) => snap(s.at));
  const dist = new Float64Array(roads.east.length).fill(Infinity);
  const out: Record<string, Record<string, number>> = {};
  let missing = 0;
  origins.forEach((o, n) => {
    const near = stations
      .map((s, i) => ({ i, d: Math.hypot(s.at.easting - o.at.easting, s.at.northing - o.at.northing) }))
      .filter((x) => !(skipSelf && stations[x.i].key === o.key))
      .sort((a, b) => a.d - b.d)
      .slice(0, NEIGHBOURS);
    const from = snap(o.at);
    if (!from || near.length === 0) return;
    const targets = new Set(near.map((x) => stationSnap[x.i]?.node).filter((x): x is number => x !== undefined));
    const limit = near[near.length - 1].d * 3 + 5000; // well past any sensible road route to the furthest of them
    const touched: number[] = [];
    const found = routes(roads, from.node, targets, limit, dist, touched);
    for (const t of touched) dist[t] = Infinity;
    const row: Record<string, number> = {};
    for (const x of near) {
      const s = stationSnap[x.i];
      const metres = s ? found.get(s.node) : undefined;
      if (s && metres !== undefined) row[stations[x.i].key] = Math.round(((from.metres + metres + s.metres) / METRES_PER_MILE) * 10);
      else missing++;
    }
    out[o.key] = row;
    if (n % 1000 === 999) process.stdout.write(`${n + 1} `);
  });
  console.log(`\n${origins.length} places, ${missing} station distances not found (no road within reach)`);
  return out;
}

// --- Running it -------------------------------------------------------------------------------------------------------

if (import.meta.url === `file://${process.argv[1]}`) {
  const folder = process.argv[2];
  if (!folder) throw new Error('Usage: npm run road-miles <Open Roads data folder>');
  const root = new URL('..', import.meta.url).pathname;
  const outcodes: Record<string, [number, number, string]> = JSON.parse(readFileSync(join(root, 'data/outcodes.json'), 'utf8')).outcodes;
  const stationList: { id: string; lat: number; lon: number }[] = JSON.parse(readFileSync(join(root, 'data/stations.json'), 'utf8')).stations;
  const grid = (lat: number, lon: number) => toBritishGrid(lat, lon);
  const stations = stationList.map((s) => ({ key: s.id, at: grid(s.lat, s.lon) }));
  const districts = Object.entries(outcodes).map(([k, [lat, lon]]) => ({ key: k, at: grid(lat, lon) }));
  const roads = readRoads(folder);
  const t = Date.now();
  const fromDistricts = roadMiles(roads, districts, stations, false);
  const fromStations = roadMiles(roads, stations, stations, true);
  console.log(`routes worked out in ${Math.round((Date.now() - t) / 1000)} s`);
  const credit = readFileSync(join(folder, '..', 'doc', 'licence.txt'), 'utf8').match(/Contains Ordnance Survey data[^\n]*/)?.[0]?.trim();
  if (!credit) throw new Error('No credit line found in doc/licence.txt beside the data folder');
  const result = {
    note: 'Road distances in tenths of a mile, from each postcode district middle and each station to its 12 nearest stations (scripts/build-road-miles.ts), over every road in OS Open Roads.',
    credit,
    built: new Date().toISOString().slice(0, 10),
    districts: fromDistricts,
    stations: fromStations,
  };
  // One place a line, so the file reads and compares sensibly in git.
  const lines = (o: Record<string, Record<string, number>>) =>
    Object.entries(o)
      .map(([k, v]) => `${JSON.stringify(k)}:${JSON.stringify(v)}`)
      .join(',\n');
  writeFileSync(
    join(root, 'data/road-miles.json'),
    `{"note":${JSON.stringify(result.note)},\n"credit":${JSON.stringify(credit)},\n"built":"${result.built}",\n"districts":{\n${lines(fromDistricts)}},\n"stations":{\n${lines(fromStations)}}}\n`,
  );
  console.log('wrote data/road-miles.json');
}

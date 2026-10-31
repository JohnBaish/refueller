// Builds data/postcodes/<area>.json: the position of every postcode in Great Britain, for searching from a full postcode
// (John, 31 October; PLAN idea 4). From OS Open Names (the same download as data/outcodes.json; GB, CSV), one file per postcode
// area ("RG"), which the page loads only when someone types a full postcode in that area, so the website only ever sees the
// area, as it does today, and the full postcode never leaves the visitor's device.
//
// Each district is one string: its first postcode's position, then each postcode's inward code ("7HN") and its position as a
// step from the one before, in units of 0.0001 degrees (about 11 metres north-south, 7 east-west). Decoded by
// src/lib/postcodes.ts.
//
// `npm run postcodes <Open Names folder>` (the unzipped download, holding Data/; not kept in the repo):
//   https://api.os.uk/downloads/v1/products/OpenNames/downloads?area=GB&format=CSV&redirect
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { splitLine, sortKey } from './build-outcodes.ts';
import { fromBritishGrid } from './lib/grid.ts';

export const STEP = 1e4; // positions in units of 0.0001 degrees

export function encodeDistrict(list: [string, number, number][]): string {
  const sorted = [...list].sort((a, b) => a[0].localeCompare(b[0]));
  const q = sorted.map(([inward, lat, lon]) => [inward, Math.round(lat * STEP), Math.round(lon * STEP)] as const);
  let [pLat, pLon] = [q[0][1], q[0][2]];
  return `${pLat},${pLon}|${q
    .map(([inward, la, lo]) => {
      const s = `${inward}${la - pLat},${lo - pLon}`;
      [pLat, pLon] = [la, lo];
      return s;
    })
    .join(';')}`;
}

function main(dir: string) {
  const areas = new Map<string, Map<string, [string, number, number][]>>();
  for (const file of readdirSync(join(dir, 'Data')).filter((f) => f.endsWith('.csv'))) {
    for (const line of readFileSync(join(dir, 'Data', file), 'utf8').split(/\r?\n/)) {
      if (!line.includes(',Postcode,')) continue;
      const f = splitLine(line);
      // Columns (Doc/OS_Open_Names_Header.csv): 2 NAME1 ("RG4 7HN"), 6 TYPE, 7 LOCAL_TYPE, 8 GEOMETRY_X, 9 GEOMETRY_Y.
      if (f[6] !== 'other' || f[7] !== 'Postcode') continue;
      const [outcode, inward] = f[2].split(' ');
      if (!outcode || !/^\d[A-Z]{2}$/.test(inward ?? '')) continue;
      const area = /^[A-Z]+/.exec(outcode)![0];
      const { latitude, longitude } = fromBritishGrid(Number(f[8]), Number(f[9]));
      if (!areas.has(area)) areas.set(area, new Map());
      const d = areas.get(area)!;
      if (!d.has(outcode)) d.set(outcode, []);
      d.get(outcode)!.push([inward, latitude, longitude]);
    }
  }
  const out = 'data/postcodes';
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  let total = 0;
  for (const [area, districts] of [...areas].sort()) {
    const lines = [...districts.keys()]
      .sort((a, b) => sortKey(a).localeCompare(sortKey(b)))
      .map((o) => {
        total += districts.get(o)!.length;
        return `${JSON.stringify(o)}:${JSON.stringify(encodeDistrict(districts.get(o)!))}`;
      });
    writeFileSync(join(out, `${area}.json`), `{\n${lines.join(',\n')}\n}\n`);
  }
  writeFileSync(join(out, 'README.md'), `Every postcode's position in Great Britain, one file per postcode area, from OS Open Names (scripts/build-postcodes.ts). Made ${new Date().toISOString().slice(0, 10)}.\n`);
  console.log(`${total} postcodes in ${areas.size} postcode areas.`);
}

if (process.argv[1]?.endsWith('build-postcodes.ts')) {
  const dir = process.argv[2];
  if (!dir) throw new Error('Usage: node scripts/build-postcodes.ts <Open Names folder>');
  main(dir);
}

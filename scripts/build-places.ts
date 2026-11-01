// Builds data/places.json: every city, town, village and suburb (and Open Names' "other settlements") in Great Britain, for typing a place name in the journey planner
// (John, 1 November 2026: From and To take a place or a postcode, Via a place only). From OS Open Names (the same download as
// data/outcodes.json); hamlets are left out, as agreed, to keep the file small and the namesakes few.
// The page loads it only when someone types a name in the journey planner, and looks names up on their own device.
//
// Each place: [name shown, other name or "", county or council area, latitude, longitude, kind, postcode district]. Where Open Names gives a place
// two names (Welsh or Gaelic and English), the English one is shown and both can be typed. Kind: c city, t town, s suburb, v village.
//
// `npm run places <Open Names folder>` (the unzipped download, holding Data/ and Doc/; not kept in the repo).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { splitLine } from './build-outcodes.ts';
import { fromBritishGrid } from './lib/grid.ts';
import { norm } from '../src/lib/places.ts';

// "Other Settlement" holds many well-known parts of towns (Caversham, Wimbledon, Clapham in London), so it counts as a suburb.
const KINDS: Record<string, string> = { City: 'c', Town: 't', 'Suburban Area': 's', 'Other Settlement': 's', Village: 'v' };

// "Caerdydd - Cardiff" (Open Names gives some Welsh council areas in both languages) becomes "Cardiff"; a leading "The" goes.
export function areaName(county: string, borough: string): string {
  const raw = county || borough;
  const parts = raw.split(' - ');
  return parts[parts.length - 1].replace(/^The /, '').trim();
}

export type PlaceRow = [string, string, string, number, number, string, string];

// One Open Names line into a place, or null. Columns (Doc/OS_Open_Names_Header.csv): 2 NAME1, 3 NAME1_LANG, 4 NAME2, 5 NAME2_LANG,
// 6 TYPE, 7 LOCAL_TYPE, 8 GEOMETRY_X, 9 GEOMETRY_Y, 16 POSTCODE_DISTRICT, 21 DISTRICT_BOROUGH, 24 COUNTY_UNITARY.
export function placeFrom(f: string[]): PlaceRow | null {
  if (f[6] !== 'populatedPlace' || !KINDS[f[7]]) return null;
  const [n1, l1, n2, l2] = [f[2], f[3], f[4], f[5]];
  // The English name first when one of the two is English (Cardiff, not Caerdydd).
  const [shown, other] = n2 && l2 === 'eng' && l1 !== 'eng' ? [n2, n1] : [n1, n2];
  const g = fromBritishGrid(Number(f[8]), Number(f[9]));
  return [shown, other || '', areaName(f[24], f[21]), Math.round(g.latitude * 1e4) / 1e4, Math.round(g.longitude * 1e4) / 1e4, KINDS[f[7]], f[16]];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2];
  if (!dir) throw new Error('Usage: npm run places <Open Names folder>');
  const places: PlaceRow[] = [];
  for (const file of readdirSync(join(dir, 'Data')).filter((f) => f.endsWith('.csv')).sort()) {
    for (const line of readFileSync(join(dir, 'Data', file), 'utf8').split(/\r?\n/)) {
      if (!line.includes(',populatedPlace,')) continue;
      const p = placeFrom(splitLine(line));
      if (p) places.push(p);
    }
  }
  places.sort((a, b) => a[0].localeCompare(b[0], 'en-GB') || a[2].localeCompare(b[2], 'en-GB') || a[6].localeCompare(b[6]));
  // The postcode district is kept only where it's needed to tell places apart (same name and area), to keep the file small.
  const key = (p: PlaceRow) => `${norm(p[0])}|${norm(p[2])}`; // as the page compares them ("Àird" and "Aird" are the same)
  const count = new Map<string, number>();
  for (const p of places) count.set(key(p), (count.get(key(p)) ?? 0) + 1);
  for (const p of places) if (count.get(key(p))! < 2) p[6] = '';
  const licence = readFileSync(join(dir, 'Doc', 'licence.txt'), 'latin1'); // Open Names' licence file is Latin-1
  const credit = /Contains OS data[^\n]*/.exec(licence)?.[0].trim();
  if (!credit) throw new Error('No OS credit line in Doc/licence.txt');
  const made = new Date().toISOString().slice(0, 10);
  const out = {
    note: 'Cities, towns, suburbs and villages of Great Britain, from OS Open Names (scripts/build-places.ts): [name, other name, county or council area, latitude, longitude, kind (c city, t town, s suburb, v village), postcode district where needed to tell places apart].',
    credit,
    made,
    places,
  };
  writeFileSync(new URL('../data/places.json', import.meta.url), JSON.stringify(out));
  const counts = places.reduce<Record<string, number>>((c, p) => ((c[p[5]] = (c[p[5]] ?? 0) + 1), c), {});
  console.log(`${places.length} places written to data/places.json`, counts);
}

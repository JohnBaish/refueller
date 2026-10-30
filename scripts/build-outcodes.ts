// Builds data/outcodes.json: the middle of every postcode district in Great Britain (the first half of a postcode, "RG4"),
// for the postcode box (SPEC Q4 A: district centres for now). From the postcodes in OS Open Names (GB, CSV): each district's
// middle is the average position of its postcodes, turned into latitude and longitude, and the place most of them are in.
// Northern Ireland isn't in OS Open Names, so BT districts are never in the file. Adapted from Hindcaster's build-outcodes.ts.
//
// `npm run outcodes <Open Names folder>` (the unzipped download, holding Data/ and Doc/; not kept in the repo):
//   https://api.os.uk/downloads/v1/products/OpenNames/downloads?area=GB&format=CSV&redirect
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fromBritishGrid } from './lib/grid.ts';

// One CSV line into its cells (Open Names quotes cells that hold commas).
export function splitLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

// Postcode districts sort as people expect: RG1, RG2 … RG10, not RG1, RG10, RG2.
export const sortKey = (o: string) => o.replace(/\d+/, (n) => n.padStart(3, '0'));

type Tally = { x: number; y: number; units: number; places: Map<string, number> };

function main(dir: string) {
  const districts = new Map<string, Tally>();
  for (const file of readdirSync(join(dir, 'Data')).filter((f) => f.endsWith('.csv'))) {
    for (const line of readFileSync(join(dir, 'Data', file), 'utf8').split(/\r?\n/)) {
      if (!line.includes(',Postcode,')) continue;
      const f = splitLine(line);
      // Columns (Doc/OS_Open_Names_Header.csv): 2 NAME1 ("RG4 7HN"), 6 TYPE, 7 LOCAL_TYPE, 8 GEOMETRY_X, 9 GEOMETRY_Y,
      // 18 POPULATED_PLACE.
      if (f[6] !== 'other' || f[7] !== 'Postcode') continue;
      const outcode = f[2].split(' ')[0];
      const t = districts.get(outcode) ?? { x: 0, y: 0, units: 0, places: new Map() };
      t.x += Number(f[8]);
      t.y += Number(f[9]);
      t.units++;
      if (f[18]) t.places.set(f[18], (t.places.get(f[18]) ?? 0) + 1);
      districts.set(outcode, t);
    }
  }
  const licence = readFileSync(join(dir, 'Doc', 'licence.txt'), 'latin1'); // Latin-1, not UTF-8
  const credits = [...licence.matchAll(/Contains [^\n]*?\d{4}\.?/g)].map((m) => m[0].trim());
  const outcodes: Record<string, [number, number, string]> = {};
  for (const o of [...districts.keys()].sort((a, b) => sortKey(a).localeCompare(sortKey(b)))) {
    const t = districts.get(o)!;
    const { latitude, longitude } = fromBritishGrid(t.x / t.units, t.y / t.units);
    const place = [...t.places].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
    outcodes[o] = [Math.round(latitude * 1e5) / 1e5, Math.round(longitude * 1e5) / 1e5, place];
  }
  writeFileSync(
    'data/outcodes.json',
    `{"note":"The middle of each postcode district in Great Britain (scripts/build-outcodes.ts), from OS Open Names: latitude, longitude, main place.",\n` +
      `"credits":${JSON.stringify(credits)},\n"made":${JSON.stringify(new Date().toISOString().slice(0, 10))},\n"outcodes":{\n` +
      Object.entries(outcodes).map(([k, v]) => `${JSON.stringify(k)}:${JSON.stringify(v)}`).join(',\n') +
      '\n}}\n',
  );
  console.log(`${Object.keys(outcodes).length} postcode districts in Great Britain.`);
  console.log(`Credits in the download's licence file: ${credits.join(' | ')}`);
}

if (process.argv[1]?.endsWith('build-outcodes.ts')) {
  const dir = process.argv[2];
  if (!dir) throw new Error('Usage: node scripts/build-outcodes.ts <Open Names folder>');
  main(dir);
}

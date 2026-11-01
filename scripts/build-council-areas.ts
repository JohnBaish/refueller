// Builds data/council-areas.json: which council area, ceremonial county, region and country every postcode in Great Britain is in,
// for "The wider picture"'s averages at every level (src/lib/levels.ts; John, November 1st 2026). From OS Open Names (the same
// download as data/postcodes/; GB, CSV), whose postcode entries carry their district or borough, county or unitary authority,
// region and country. Each postcode area has three lookups: postcodes not in their sector's usual council area, each sector's
// usual council area, and each district's usual council area (so a new or mistyped postcode still finds one).
//
// The council area is the district or borough where there is one (Maidstone, in Kent; a London borough; a metropolitan district
// such as Leeds), otherwise the unitary authority (Reading). The ceremonial county is the Lieutenancies Act 1997's, from the council
// areas, as in Hindcaster's scripts/build-areas.ts (checked there against OS Boundary-Line: every English settlement agreed).
// Stockton-on-Tees is split between Durham and North Yorkshire by the Tees, so it is given no county. Scotland and Wales have no
// regions, and no ceremonial counties are used there.
//
// `npm run council-areas <Open Names folder>` (the unzipped download, holding Data/; not kept in the repo):
//   https://api.os.uk/downloads/v1/products/OpenNames/downloads?area=GB&format=CSV&redirect
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { splitLine } from './build-outcodes.ts';
import type { AreaLookup, Locality } from '../src/lib/levels.ts';

// The Act's Schedule 1 paragraph 3 (as amended), in Open Names' names for the unitary authorities (from Hindcaster).
const ACT: Record<string, string> = {
  Bedford: 'Bedfordshire', 'Central Bedfordshire': 'Bedfordshire', Luton: 'Bedfordshire',
  'Milton Keynes': 'Buckinghamshire',
  'City of Peterborough': 'Cambridgeshire',
  'Cheshire East': 'Cheshire', 'Cheshire West and Chester': 'Cheshire', Halton: 'Cheshire', Warrington: 'Cheshire',
  Cumberland: 'Cumbria', 'Westmorland and Furness': 'Cumbria',
  'City of Derby': 'Derbyshire',
  'City of Plymouth': 'Devon', Torbay: 'Devon',
  'Bournemouth, Christchurch and Poole': 'Dorset',
  'County Durham': 'Durham', Darlington: 'Durham', Hartlepool: 'Durham',
  'City of Kingston upon Hull': 'East Riding of Yorkshire',
  'The City of Brighton and Hove': 'East Sussex',
  'Southend-on-Sea': 'Essex', Thurrock: 'Essex',
  'South Gloucestershire': 'Gloucestershire',
  'City of Portsmouth': 'Hampshire', 'City of Southampton': 'Hampshire',
  Medway: 'Kent',
  'Blackburn with Darwen': 'Lancashire', Blackpool: 'Lancashire',
  'City of Leicester': 'Leicestershire',
  'North Lincolnshire': 'Lincolnshire', 'North East Lincolnshire': 'Lincolnshire',
  'North Northamptonshire': 'Northamptonshire', 'West Northamptonshire': 'Northamptonshire',
  Middlesbrough: 'North Yorkshire', 'Redcar and Cleveland': 'North Yorkshire', York: 'North Yorkshire',
  'City of Nottingham': 'Nottinghamshire',
  'Telford and Wrekin': 'Shropshire',
  'Bath and North East Somerset': 'Somerset', 'North Somerset': 'Somerset',
  'City of Stoke-on-Trent': 'Staffordshire',
  Swindon: 'Wiltshire',
  'Isles of Scilly': 'Cornwall',
  'Bracknell Forest': 'Berkshire', Reading: 'Berkshire', Slough: 'Berkshire', 'West Berkshire': 'Berkshire',
  'Windsor and Maidenhead': 'Berkshire', Wokingham: 'Berkshire',
  'City of Bristol': 'Bristol',
  'County of Herefordshire': 'Herefordshire',
};
const COUNTY_ITSELF = new Set([
  'Buckinghamshire', 'Cambridgeshire', 'Cornwall', 'Derbyshire', 'Devon', 'Dorset', 'East Riding of Yorkshire', 'East Sussex',
  'Essex', 'Gloucestershire', 'Greater London', 'Hampshire', 'Hertfordshire', 'Isle of Wight', 'Kent', 'Lancashire',
  'Leicestershire', 'Lincolnshire', 'Norfolk', 'North Yorkshire', 'Northumberland', 'Nottinghamshire', 'Oxfordshire',
  'Rutland', 'Shropshire', 'Somerset', 'Staffordshire', 'Suffolk', 'Surrey', 'Warwickshire', 'West Sussex', 'Wiltshire',
  'Worcestershire',
]);
// The metropolitan districts, by county; the names Hindcaster's pages show (John, B6: the county "West Midlands ceremonial county").
const METROPOLITAN: Record<string, string[]> = {
  'Greater Manchester': ['Bolton', 'Bury', 'Manchester', 'Oldham', 'Rochdale', 'Salford', 'Stockport', 'Tameside', 'Trafford', 'Wigan'],
  Merseyside: ['Knowsley', 'Liverpool', 'Sefton', 'St. Helens', 'Wirral'],
  'South Yorkshire': ['Barnsley', 'Doncaster', 'Rotherham', 'Sheffield'],
  'Tyne and Wear': ['Gateshead', 'Newcastle upon Tyne', 'North Tyneside', 'South Tyneside', 'Sunderland'],
  'West Midlands ceremonial county': ['Birmingham', 'Coventry', 'Dudley', 'Sandwell', 'Solihull', 'Walsall', 'City of Wolverhampton'],
  'West Yorkshire': ['Bradford', 'Calderdale', 'Kirklees', 'Leeds', 'Wakefield'],
};
// Open Names' English regions, as Hindcaster's pages name them (B6).
const REGION: Record<string, string> = {
  'North East': 'North East England', 'North West': 'North West England', 'Yorkshire and the Humber': 'Yorkshire and the Humber',
  'East Midlands': 'East Midlands', 'West Midlands': 'West Midlands region', Eastern: 'East of England', London: 'Greater London',
  'South East': 'South East England', 'South West': 'South West England',
};

/** A council area's name as shown: the English part of a Welsh name; "The" dropped; the City of London and the Western Isles. */
export function shownName(raw: string): string {
  let n = raw.includes(' - ') ? raw.split(' - ').pop()! : raw;
  n = n.replace(/^The /, '').replace(/^the /, '');
  if (n === 'City and County of the City of London') return 'City of London';
  if (n === 'Na h-Eileanan an Iar') return 'Western Isles';
  return n[0].toUpperCase() + n.slice(1);
}

export function localityOf(district: string, countyUnitary: string, region: string, country: string): Locality {
  const local = shownName(district || countyUnitary);
  if (country !== 'England') return [local, null, null, country];
  let county: string | null = null;
  if (countyUnitary === 'Greater London') county = district === 'City and County of the City of London' ? 'City of London' : 'Greater London';
  else if (ACT[countyUnitary]) county = ACT[countyUnitary];
  else if (COUNTY_ITSELF.has(countyUnitary)) county = countyUnitary;
  else if (!countyUnitary) county = Object.entries(METROPOLITAN).find(([, ds]) => ds.includes(district))?.[0] ?? null;
  return [local, county, REGION[region] ?? null, country];
}

function main(dir: string) {
  const locals: Locality[] = [];
  const index = new Map<string, number>();
  // area -> district -> sector -> [postcode, locality index][]
  const tree = new Map<string, Map<string, Map<string, [string, number][]>>>();
  const unplaced = new Set<string>();
  for (const file of readdirSync(join(dir, 'Data')).filter((f) => f.endsWith('.csv'))) {
    for (const line of readFileSync(join(dir, 'Data', file), 'utf8').split(/\r?\n/)) {
      if (!line.includes(',Postcode,')) continue;
      const f = splitLine(line);
      // Columns (Doc/OS_Open_Names_Header.csv): 2 NAME1, 7 LOCAL_TYPE, 21 DISTRICT_BOROUGH, 24 COUNTY_UNITARY, 27 REGION, 29 COUNTRY.
      if (f[7] !== 'Postcode') continue;
      const [out, inward] = f[2].split(' ');
      if (!out || !/^\d[A-Z]{2}$/.test(inward ?? '')) continue;
      const loc = localityOf(f[21], f[24], f[27], f[29]);
      if (loc[3] === 'England' && (!loc[1] || !loc[2])) unplaced.add(`${loc[0]} (county ${loc[1]}, region ${loc[2]})`);
      const k = JSON.stringify(loc);
      if (!index.has(k)) {
        index.set(k, locals.length);
        locals.push(loc);
      }
      const area = /^[A-Z]+/.exec(out)![0];
      const a = tree.get(area) ?? tree.set(area, new Map()).get(area)!;
      const d = a.get(out) ?? a.set(out, new Map()).get(out)!;
      const sec = `${out} ${inward[0]}`;
      (d.get(sec) ?? d.set(sec, []).get(sec)!).push([`${out} ${inward}`, index.get(k)!]);
    }
  }
  const most = (xs: number[]) => {
    const c = new Map<number, number>();
    for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1);
    return [...c].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
  };
  const areas: Record<string, AreaLookup> = {};
  let exceptions = 0;
  let postcodes = 0;
  for (const [area, ds] of [...tree].sort()) {
    const lk: AreaLookup = { d: {}, s: {}, p: {} };
    for (const [out, secs] of [...ds].sort()) {
      lk.d[out] = most([...secs.values()].flat().map((x) => x[1]));
      for (const [sec, pcs] of [...secs].sort()) {
        const usual = (lk.s[sec] = most(pcs.map((x) => x[1])));
        postcodes += pcs.length;
        for (const [pc, i] of pcs)
          if (i !== usual) {
            lk.p[pc] = i;
            exceptions++;
          }
      }
    }
    areas[area] = lk;
  }
  const lines = Object.entries(areas).map(([a, lk]) => `${JSON.stringify(a)}:${JSON.stringify(lk)}`);
  writeFileSync(
    'data/council-areas.json',
    `{"note":"Which council area, ceremonial county, region and country each postcode is in, from OS Open Names (scripts/build-council-areas.ts). locals: [name, county, region, country]; areas: per postcode area, d (district), s (sector) and p (postcodes not in their sector's usual council area), each an index into locals. Made ${new Date().toISOString().slice(0, 10)}.",\n"locals":[\n${locals.map((l) => JSON.stringify(l)).join(',\n')}],\n"areas":{\n${lines.join(',\n')}}}\n`,
  );
  console.log(`${locals.length} council areas; ${postcodes} postcodes in ${Object.keys(areas).length} postcode areas; ${exceptions} not in their sector's usual council area.`);
  if (unplaced.size) console.log(`English council areas without a county or region: ${[...unplaced].join('; ')}`);
}

if (process.argv[1]?.endsWith('build-council-areas.ts')) {
  const dir = process.argv[2];
  if (!dir) throw new Error('Usage: node scripts/build-council-areas.ts <Open Names folder>');
  main(dir);
}

// Loading the page's data files (scripts/lib/pageData.ts). Every visitor asks for the same files whatever they type: the
// index, then the postcode areas the eight nearest stations are in. Nothing about a search is in any request.
import type { DetailRow, PageIndex, RoadFile } from './pageTypes.ts';

let index: Promise<PageIndex> | null = null;
const areas = new Map<string, Promise<DetailRow[]>>();
const roadFiles = new Map<string, Promise<RoadFile>>();
const postcodeFiles = new Map<string, Promise<Record<string, string>>>();

async function json<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

export function loadIndex(): Promise<PageIndex> {
  index ??= json<PageIndex>('/data/index.json').catch((e) => {
    index = null; // try again next time
    throw e;
  });
  return index;
}

export function loadArea(version: string, area: string): Promise<DetailRow[]> {
  const key = `${version}/${area}`;
  if (!areas.has(key)) {
    areas.set(
      key,
      json<DetailRow[]>(`/data/${version}/${encodeURIComponent(area)}.json`).catch((e) => {
        areas.delete(key);
        throw e;
      }),
    );
  }
  return areas.get(key)!;
}

// The calculator's road miles for one postcode area (loaded only when a "Worth driving here?" panel opens). An area with no
// file (no road figures there) gives an empty table rather than an error.
export function loadRoads(folder: string, area: string): Promise<RoadFile> {
  const key = `${folder}/${area}`;
  if (!roadFiles.has(key)) {
    roadFiles.set(
      key,
      fetch(`/data/${folder}/${encodeURIComponent(area)}.json`).then(
        (res) => (res.ok ? (res.json() as Promise<RoadFile>) : {}),
        (e) => {
          roadFiles.delete(key);
          throw e;
        },
      ),
    );
  }
  return roadFiles.get(key)!;
}

// Every postcode's position in one postcode area (only when a full postcode is typed; src/lib/postcodes.ts).
export function loadPostcodes(folder: string, area: string): Promise<Record<string, string>> {
  const key = `${folder}/${area}`;
  if (!postcodeFiles.has(key)) {
    postcodeFiles.set(
      key,
      json<Record<string, string>>(`/data/${folder}/${encodeURIComponent(area)}.json`).catch((e) => {
        postcodeFiles.delete(key);
        throw e;
      }),
    );
  }
  return postcodeFiles.get(key)!;
}

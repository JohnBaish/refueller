// Loading the page's data files (scripts/lib/pageData.ts). Every visitor asks for the same files whatever they type: the
// index, then the postcode areas the eight nearest stations are in. Nothing about a search is in any request.
import type { DetailRow, PageIndex } from './pageTypes.ts';

let index: Promise<PageIndex> | null = null;
const areas = new Map<string, Promise<DetailRow[]>>();

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

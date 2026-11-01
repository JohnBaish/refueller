// Place names for the journey planner (John, 1 November 2026): From and To take a place name or a postcode, Via a place name only.
// The list (data/places.json, scripts/build-places.ts) is cities, towns, suburbs and villages from OS Open Names; it is searched on
// the visitor's device, so nothing typed leaves it.

export type PlaceRow = [string, string, string, number, number, string, string];
export type PlaceFile = { credit: string; made: string; places: PlaceRow[] };
export type NamedPlace = { name: string; other: string; area: string; lat: number; lon: number; kind: string; district: string; shared?: boolean; clash?: boolean; twin?: boolean };

const KIND_ORDER: Record<string, number> = { c: 0, t: 1, s: 2, v: 3 };

// For matching only: small letters, no accents, "&" as "and", "Saint" as "St", punctuation as spaces.
export function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\bsaint\b/g, 'st')
    .trim();
}

// Just "Andover" where only one place has the name; "Newport, Isle of Wight" (or "Newport, Newport", the Welsh city, whose
// council area has the same name) where several do; and "Sutton, Shropshire (TF9)" where several share both name and area.
export const placeLabel = (p: NamedPlace) => (p.shared && p.area ? `${p.name}, ${p.area}${p.clash ? ` (${p.district})` : ''}` : p.name);

export type PlaceIndex = { all: NamedPlace[]; keys: { name: string; other: string; label: string }[] };
export function makePlaceIndex(f: PlaceFile): PlaceIndex {
  const all: NamedPlace[] = f.places.map(([name, other, area, lat, lon, kind, district]) => ({ name, other, area, lat, lon, kind, district }));
  const tally = (key: (p: NamedPlace) => string) => {
    const c = new Map<string, number>();
    for (const p of all) c.set(key(p), (c.get(key(p)) ?? 0) + 1);
    return (p: NamedPlace) => c.get(key(p))! > 1;
  };
  const sharedName = tally((p) => norm(p.name));
  const sharedArea = tally((p) => `${norm(p.name)}|${norm(p.area)}`);
  for (const p of all) {
    p.shared = sharedName(p);
    p.clash = sharedArea(p);
  }
  // A few still share everything shown (two Habosts in HS2): picking one from the list then keeps its position too (placeAt).
  const twins = tally((p) => norm(placeLabel(p)));
  for (const p of all) p.twin = twins(p);
  return { all, keys: all.map((p) => ({ name: norm(p.name), other: norm(p.other), label: norm(placeLabel(p)) })) };
}

// Up to `limit` places matching what's typed: the name (or its other name) starting with it first, then a later word of the name
// ("wootton" finds Royal Wootton Bassett); an exact name before longer ones; cities, then towns, suburbs and villages.
export function suggest(ix: PlaceIndex, typed: string, limit = 8): NamedPlace[] {
  const q = norm(typed);
  if (q.length < 2) return [];
  const found: { p: NamedPlace; score: number }[] = [];
  ix.keys.forEach((k, i) => {
    let score = -1;
    if (k.label === q || k.name === q || k.other === q) score = 0;
    else if (k.label.startsWith(q) || k.name.startsWith(q) || k.other.startsWith(q)) score = 1;
    else if (` ${k.name}`.includes(` ${q}`) || (k.other && ` ${k.other}`.includes(` ${q}`))) score = 2;
    if (score >= 0) found.push({ p: ix.all[i], score });
  });
  return found
    .sort((a, b) => a.score - b.score || KIND_ORDER[a.p.kind] - KIND_ORDER[b.p.kind] || a.p.name.length - b.p.name.length || placeLabel(a.p).localeCompare(placeLabel(b.p), 'en-GB'))
    .slice(0, limit)
    .map((x) => x.p);
}

// What a typed name means: one place (an exact label such as "Newport, Isle of Wight", or a name only one place has), several
// with that name (the visitor must choose), or none.
export type PlaceFind = { ok: true; place: NamedPlace } | { ok: false; problem: 'several'; places: NamedPlace[] } | { ok: false; problem: 'none' };
// Where a picked place shares its whole label with another, its position goes with it ("58.2474,-6.1647") to say which.
export const placeAt = (p: NamedPlace) => (p.twin ? `${p.lat},${p.lon}` : undefined);

export function findPlace(ix: PlaceIndex, typed: string, at?: string): PlaceFind {
  const q = norm(typed);
  if (!q) return { ok: false, problem: 'none' };
  const byLabel = ix.keys.flatMap((k, i) => (k.label === q ? [ix.all[i]] : []));
  if (byLabel.length === 1) return { ok: true, place: byLabel[0] };
  if (byLabel.length > 1 && at) {
    const [lat, lon] = at.split(',').map(Number);
    const exact = byLabel.find((p) => p.lat === lat && p.lon === lon);
    if (exact) return { ok: true, place: exact };
  }
  // A unique place typed with its area in full ("Horsham, West Sussex"), though its label is just "Horsham" (John, 1 November).
  const withArea = ix.all.filter((p) => !p.shared && p.area && norm(`${p.name}, ${p.area}`) === q);
  if (withArea.length === 1) return { ok: true, place: withArea[0] };
  const byName = ix.keys.flatMap((k, i) => (k.name === q || k.other === q ? [ix.all[i]] : []));
  if (byName.length === 1) return { ok: true, place: byName[0] };
  if (byName.length > 1 || byLabel.length > 1) return { ok: false, problem: 'several', places: byName.length ? byName : byLabel };
  return { ok: false, problem: 'none' };
}

// Does it look like a postcode (or the first half of one) rather than a place name? "RG1", "RG1 8FR", "ec1a 1bb".
export const looksLikePostcode = (typed: string) => /^\s*[A-Za-z]{1,2}\d[A-Za-z\d]?(\s*\d[A-Za-z]{2})?\s*$/.test(typed);

// The first few places sharing a name, biggest first (cities, then towns, suburbs and villages), as they're labelled, for the message
// that asks the visitor to choose: “Newport, Newport”, “Newport, Isle of Wight” or “Newport, Pembrokeshire” (fresh look 3.2, John,
// November 1st 2026).
export function namesakes(places: NamedPlace[], n = 3): string {
  const labels = [...places]
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || placeLabel(a).length - placeLabel(b).length || placeLabel(a).localeCompare(placeLabel(b), 'en-GB'))
    .map((p) => `“${placeLabel(p)}”`)
    .filter((l, i, all) => all.indexOf(l) === i) // two Habosts share a whole label: named once
    .slice(0, n);
  return labels.length < 2 ? labels.join('') : `${labels.slice(0, -1).join(', ')} or ${labels[labels.length - 1]}`;
}

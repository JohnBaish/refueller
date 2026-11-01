import { readFileSync } from 'node:fs';
import { journey, makeNetwork, toPlace } from '/home/user/refueller/src/lib/route.ts';
import { rival, routeWords, type Town } from '/home/user/refueller/src/lib/routeWords.ts';
import { routeWordsMid } from './route-middle-only.ts';
import { routeWordsFill } from './route-middle-gentler.ts';
const net = makeNetwork(JSON.parse(readFileSync('/home/user/refueller/data/route-roads.json', 'utf8')));
const places = JSON.parse(readFileSync('/home/user/refueller/data/places.json', 'utf8')).places as any[];
const towns: Town[] = places.filter((q) => q[5] === 'c' || q[5] === 't').map((q) => { const g = toPlace(q[3], q[4]); return { name: q[0], e: g.easting, n: g.northing, city: q[5] === 'c' }; });
const find = (s: string) => { const [n, a] = s.split('|'); const x = places.find((q) => q[0] === n && (!a || q[2] === a)); return toPlace(x[3], x[4]); };
const trips = [['Caversham|Reading', 'Downham Market'], ['Wokingham', 'Horsham|West Sussex'], ['Reading|Reading', 'Bristol'], ['Reading|Reading', 'Exeter'], ['Reading|Reading', 'Downham Market'], ['Oxford|Oxfordshire', 'Brighton'], ['Bath', 'Southampton'], ['Leeds|Leeds', 'Manchester'], ['Cambridge|Cambridgeshire', 'Oxford|Oxfordshire'], ['Guildford|Surrey', 'Brighton'], ['Reading|Reading', 'Southampton'], ['London|Greater London', 'Birmingham'], ['Cardiff', 'Bristol'], ['Norwich', 'Ipswich'], ['York', 'Scarborough|North Yorkshire'], ['Exeter', 'Penzance'], ['Carlisle', 'Newcastle upon Tyne'], ['Swindon|Swindon', 'Gloucester'], ['Bath', 'Salisbury|Wiltshire'], ['Reading|Reading', 'Oxford|Oxfordshire'], ['Worcester', 'Hereford']];
for (const [f, t] of trips) {
  const a = find(f), b = find(t);
  const j = journey(net, [a, b], []);
  if (!j.ok) { console.log(f, t, j.problem); continue; }
  const r = rival(net, j.start, j.end, j.links);
  const ch = { nodes: j.path, links: j.links };
  const before = routeWords(net, ch, r, towns, a, b), after = routeWordsMid(net, ch, r, towns, a, b), fill = routeWordsFill(net, ch, r, towns, a, b);
  console.log(`${f.split('|')[0]} to ${t.split('|')[0]} (${Math.round(j.miles)} mi): ${before}  →  ${after}  |  gentler: ${fill}`);
}

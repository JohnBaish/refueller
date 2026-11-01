import { Fragment, useEffect, useMemo, useState, type FormEvent } from 'react';
import { collectedText, PriceCell, REPORT_URL, useNow } from './Results.tsx';
import { loadChoices, saveChoices, type Fuel } from '../lib/calc.ts';
import { loadArea, loadIndex, loadPostcodes, loadRouteRoads } from '../lib/load.ts';
import { getPlaces, PlaceBox } from './PlaceBox.tsx';
import { fromDetail, type PageIndex } from '../lib/pageTypes.ts';
import { decodeDistrict } from '../lib/postcodes.ts';
import { useIsNarrow } from '../lib/responsive.ts';
import { findPlace, looksLikePostcode, placeAt, placeLabel, type NamedPlace, type PlaceIndex } from '../lib/places.ts';
import {
  endTyped,
  isPlace,
  journey,
  makeNetwork,
  pcText,
  routeCheapest,
  routeEight,
  routeHash,
  routeMiles,
  todayText,
  toPlace,
  ROUTE_EXTRA_MILES,
  ROUTE_EXTRA_MINUTES,
  ROUTE_CORRIDOR_METRES,
  endChoices,
  type Network,
  type End,
  type RouteRow,
  type RouteTarget,
} from '../lib/route.ts';
import { membersOnly, milesBetween, milesText, postcodeArea, readPostcode, tidyAddress, tidyName } from '../lib/search.ts';

// "Find cheaper fuel near the route" (John, 31 October 2026; option b): the form, then the eight cheapest within three extra
// miles in the order you'd reach them. Everything is worked out on this device (src/lib/route.ts).

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

type Field = 'from' | 'via' | 'to';
const LABEL: Record<Field, string> = { from: 'From', via: 'Via (optional)', to: 'To' };
// The faint examples in the boxes (John, 1 November).
const EXAMPLE: Record<Field, string> = { from: 'Reading, RG1 or RG1 8FR', via: 'Andover', to: 'Exeter, EX4 or EX4 6TJ' };

export function JourneyForm({ target }: { target: RouteTarget }) {
  const initial = (e?: End) => (e ? endTyped(e) : '');
  const [typed, setTyped] = useState<Record<Field, string>>({ from: initial(target.from), via: initial(target.via), to: initial(target.to) });
  const [problem, setProblem] = useState('');
  // The place picked from each box's list, to tell apart the few places that share a whole label.
  const [picked, setPicked] = useState<Partial<Record<Field, NamedPlace>>>({});
  useEffect(() => setTyped({ from: initial(target.from), via: initial(target.via), to: initial(target.to) }), [target.from, target.via, target.to]);

  async function go(e: FormEvent) {
    e.preventDefault();
    setProblem('');
    let outcodes;
    let places: PlaceIndex | null;
    try {
      outcodes = (await loadIndex()).outcodes;
      places = Object.values(typed).some((t) => t.trim() && !looksLikePostcode(t)) ? await getPlaces() : null;
    } catch {
      setProblem('Sorry, the postcodes and places couldn’t be loaded. Check your connection and try again.');
      return;
    }
    const read: Partial<Record<Field, End>> = {};
    for (const f of ['from', 'via', 'to'] as Field[]) {
      const t = typed[f].trim();
      const name = f === 'via' ? 'Via' : LABEL[f];
      if (f === 'via' && !t) continue;
      if (!t) {
        setProblem(`Please type a place or a postcode in ${name}, such as ${f === 'from' ? 'Reading or RG1' : 'Exeter or EX4'}.`);
        return;
      }
      if (looksLikePostcode(t)) {
        if (f === 'via') {
          setProblem('Via takes a place name, such as Andover, rather than a postcode.');
          return;
        }
        const r = readPostcode(t, outcodes);
        if (!r.ok) {
          setProblem(
            r.problem === 'northern-ireland'
              ? `${name}: Refueller covers Great Britain only for now, so Northern Ireland postcodes aren’t included yet.`
              : `${name}: we can’t find ${t.toUpperCase().split(/\s+/)[0]} among Great Britain’s postcodes.`,
          );
          return;
        }
        read[f] = { outcode: r.outcode, ...(r.inward ? { inward: r.inward } : {}) };
        continue;
      }
      const chosen = picked[f] && placeLabel(picked[f]) === t ? picked[f] : undefined;
      const prior = target[f] && isPlace(target[f]) && target[f].place === t ? target[f].at : undefined;
      const found = places ? findPlace(places, t, chosen ? placeAt(chosen) : prior) : ({ ok: false, problem: 'none' } as const);
      if (!found.ok) {
        setProblem(
          found.problem === 'several'
            ? `${name}: there’s more than one ${found.places[0].name}. Choose one from the list as you type, such as “${placeLabel(found.places[0])}”.`
            : `${name}: we can’t find “${t}” among Great Britain’s towns, villages and suburbs. Check the spelling, or try a postcode${f === 'via' ? ' in From or To' : ''}.`,
        );
        return;
      }
      const at = placeAt(found.place);
      read[f] = { place: placeLabel(found.place), ...(at ? { at } : {}) };
    }
    location.hash = routeHash({ kind: 'route', ...read } as RouteTarget);
  }

  return (
    <form className="search-form" onSubmit={go} noValidate>
      <div className="search journey">
        {(['from', 'via', 'to'] as Field[]).map((f) => (
          <PlaceBox key={f} id={`jf-${f}`} label={LABEL[f]} placeholder={EXAMPLE[f]} postcodes={f !== 'via'} enterKeyHint={f === 'to' ? 'go' : 'next'} value={typed[f]} onChange={(v) => setTyped((t) => ({ ...t, [f]: v }))} onPick={(p) => setPicked((x) => ({ ...x, [f]: p }))} />
        ))}
        <button type="submit" className="btn btn-primary">
          Find
        </button>
      </div>
      {problem ? (
        <p className="problem" role="alert">
          {problem}
        </p>
      ) : (
        <p className="hint">
          From and To take a place or a postcode (the full postcode, or just the first half). Via takes a place: the route passes near it
          rather than through it. It’s all worked out on this page: nothing you type leaves it.
        </p>
      )}
    </form>
  );
}

// The network and the stations' positions, worked out once per visit.
let network: { file: string; net: Promise<Network> } | null = null;
const getNetwork = (file: string) => {
  if (network?.file !== file) network = { file, net: loadRouteRoads(file).then(makeNetwork) };
  return network.net.catch((e) => {
    network = null;
    throw e;
  });
};
let stationPlaces: { version: string; places: ReturnType<typeof toPlace>[] } | null = null;
const getStationPlaces = (index: PageIndex) => {
  if (stationPlaces?.version !== index.version) stationPlaces = { version: index.version, places: index.points.map((p) => toPlace(p[0], p[1])) };
  return stationPlaces.places;
};

type Where = { lat: number; lon: number; label: string; short: string; notFound?: string };
class CantFind extends Error {}
async function whereIs(index: PageIndex, e: End): Promise<Where> {
  if (isPlace(e)) {
    const ix = await getPlaces();
    const found = ix ? findPlace(ix, e.place, e.at) : null;
    if (!found?.ok) throw new CantFind(e.place);
    return { lat: found.place.lat, lon: found.place.lon, label: placeLabel(found.place), short: found.place.name };
  }
  const [lat, lon, place] = index.outcodes[e.outcode] ?? [];
  if (lat === undefined) throw new CantFind(e.outcode);
  const town = place.split(' / ')[0];
  const district = { lat, lon, label: `${e.outcode} (${town})`, short: e.outcode };
  if (!e.inward) return district;
  const file = index.postcodes ? await loadPostcodes(index.postcodes.folder, postcodeArea(e.outcode)) : {};
  const at = file[e.outcode] ? decodeDistrict(file[e.outcode]).get(e.inward) : undefined;
  const full = pcText(e);
  return at ? { lat: at[0], lon: at[1], label: `${full} (${town})`, short: full } : { ...district, notFound: full };
}

type Found = { ok: true; index: PageIndex; miles: number; candidates: RouteRow[]; startEight: RouteRow[]; endEight: RouteRow[]; from: Where; to: Where; via?: Where } | { ok: false; message: string };

async function find(t: Required<Pick<RouteTarget, 'from' | 'to'>> & RouteTarget): Promise<Found> {
  const index = await loadIndex();
  if (!index.route) return { ok: false, message: 'Sorry, the road map isn’t available at the moment. Try again later.' };
  let from: Where, to: Where, via: Where | undefined;
  try {
    [from, to, via] = await Promise.all([whereIs(index, t.from), whereIs(index, t.to), t.via ? whereIs(index, t.via) : Promise.resolve(undefined)]);
  } catch (e) {
    if (e instanceof CantFind) return { ok: false, message: `We can’t find “${e.message}”. Check it in the boxes above and press Find again.` };
    throw e;
  }
  const net = await getNetwork(index.route.file);
  const places = [from, ...(via ? [via] : []), to].map((w) => toPlace(w.lat, w.lon));
  const j = journey(net, places, getStationPlaces(index));
  if (!j.ok)
    return {
      ok: false,
      message:
        j.problem === 'no-road'
          ? 'There’s no road route between those places (a ferry may be needed), so Refueller can’t work out a journey.'
          : j.problem === 'via-far'
            ? `There’s no main road within about three miles of ${via?.short ?? 'the via place'}, so Refueller can’t route the journey past it.`
            : 'One of those places is too far from a main road for Refueller to work out a journey.',
    };
  const near = index.points.map((p, i) => ({ p, i })).filter(({ i }) => j.extra[i] <= ROUTE_EXTRA_MILES && j.minutes[i] <= ROUTE_EXTRA_MINUTES && j.offRoute[i] <= ROUTE_CORRIDOR_METRES);
  // The eight stations nearest each end, as the main list finds them (in a straight line), for the comparison at either end.
  const nearestTo = (w: Where) =>
    index.points
      .map((p, i) => ({ p, i, d: milesBetween(w.lat, w.lon, p[0], p[1]) }))
      .sort((a, b) => a.d - b.d || a.i - b.i)
      .slice(0, 8);
  const [atStart, atEnd] = [nearestTo(from), nearestTo(to)];
  const areas = [...new Set([...near, ...atStart, ...atEnd].map(({ p }) => p[2]))];
  const files = new Map(await Promise.all(areas.map(async (a) => [a, await loadArea(index.version, index.areas[a])] as const)));
  const rowOf = ({ p, i, d }: { p: PageIndex['points'][number]; i: number; d?: number }): RouteRow => {
    const { station, prices } = fromDetail(files.get(p[2])![p[3]], p[0], p[1]);
    return { station, prices, along: j.along[i], extra: j.extra[i], minutes: j.minutes[i], offRoute: j.offRoute[i], ...(d === undefined ? {} : { fromEnd: d }) };
  };
  const candidates = near.map(rowOf);
  return { ok: true, index, miles: j.miles, candidates, startEight: atStart.map(rowOf), endEight: atEnd.map(rowOf), from, to, via };
}

function Notes({ found, shown, within, now }: { found: Extract<Found, { ok: true }>; shown: number; within: number; now: number }) {
  const missing = [found.from, found.via, found.to].filter((w): w is Where => !!w?.notFound);
  return (
    <p className="notes">
      {missing.map((w) => `We couldn’t find ${w.notFound} (it may be new, or mistyped), so the middle of ${w.label.split(' ')[0]} is used. `)}
      The route is about {Math.round(found.miles)} miles by road{found.via ? `, passing near ${found.via.short}` : ''}.{' '}
      {within === 0
        ? `No station close to the route adds less than ${ROUTE_EXTRA_MILES} miles and ${ROUTE_EXTRA_MINUTES} minutes to it, there and back.`
        : shown === within
          ? `${cap(WORDS[within] ?? String(within))} station${within === 1 ? '' : 's'} close to the route ${within === 1 ? 'adds' : 'add'} no more than ${ROUTE_EXTRA_MILES} miles and about ${ROUTE_EXTRA_MINUTES} minutes to it, there and back; here ${within === 1 ? 'it is' : 'they are'}, in the order you’d reach them.`
          : `Of the ${within} stations close to the route that add no more than ${ROUTE_EXTRA_MILES} miles and about ${ROUTE_EXTRA_MINUTES} minutes to it, there and back, these are the eight cheapest, in the order you’d reach them.`}{' '}
      For comparison, the cheapest of the stations near each end of the journey is added to the list, shown first and last (and, where that’s a members-only Costco, the cheapest for everyone else too). Distances are by main roads, so
      they’re a guide. Opening hours are today’s. Prices collected at {collectedText(found.index.collected, now)}, as
      reported by each station; they may have changed since.{' '}
      <a href={REPORT_URL} target="_blank" rel="noopener noreferrer">
        Report a wrong price
      </a>
      .
    </p>
  );
}

export function JourneyResults({ target }: { target: RouteTarget }) {
  const now = useNow();
  const narrow = useIsNarrow(720);
  const [found, setFound] = useState<Found | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [fuel, setFuel] = useState<Fuel>(() => loadChoices().fuel);

  useEffect(() => {
    if (!target.from || !target.to) return;
    let live = true;
    setFound(null);
    setFailed(false);
    find({ ...target, from: target.from, to: target.to }).then(
      (f) => live && setFound(f),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [target.from && endTyped(target.from), target.to && endTyped(target.to), target.via?.place, attempt]);

  const chosen = useMemo(() => {
    if (!found?.ok) return null;
    const start = endChoices(found.startEight, fuel);
    const end = endChoices(found.endEight, fuel).filter((r) => !start.some((s) => s.station.id === r.station.id));
    const leaveOut = new Set([...start, ...end].map((r) => r.station.id));
    return { start, end, ...routeEight(found.candidates, fuel, leaveOut) };
  }, [found, fuel]);
  if (!target.from || !target.to) return null;
  if (failed)
    return (
      <div className="message" role="alert">
        <p>Sorry, the journey couldn’t be worked out. Check your connection and try again.</p>
        <button type="button" className="btn btn-secondary" onClick={() => setAttempt((a) => a + 1)}>
          Try again
        </button>
      </div>
    );
  if (!found) return <p className="message muted">Working out the route…</p>;
  if (!found.ok)
    return (
      <p className="message" role="alert">
        {found.message}
      </p>
    );

  const rows = chosen!.rows;
  // Shown together, in this order: the cheapest near the start, the stations on the way, the cheapest near the end. "Cheapest" and the
  // small chart compare all of them.
  type Shown = { r: RouteRow; group: 'start' | 'way' | 'end' };
  const shown: Shown[] = [
    ...chosen!.start.map((r) => ({ r, group: 'start' as const })),
    ...rows.map((r) => ({ r, group: 'way' as const })),
    ...chosen!.end.map((r) => ({ r, group: 'end' as const })),
  ];
  const cheapest = routeCheapest(
    shown.map((x) => x.r),
    fuel,
  );
  const all = shown.map((x) => x.r.prices[fuel]!.p).sort((a, b) => a - b);
  const fuelName = fuel === 'e10' ? 'Unleaded' : 'Diesel';
  const choose = (f: Fuel) => {
    setFuel(f);
    saveChoices({ ...loadChoices(), fuel: f });
  };
  const name = (r: RouteRow) => (
    <>
      <div className="brand">{r.station.brand}</div>
      <div className="sname">{tidyName(r.station.name)}</div>
      {membersOnly(r.station) && <div className="members">Members only</div>}
    </>
  );
  const price = (r: RouteRow, i: number) => <PriceCell p={r.prices[fuel]} cheapest={cheapest[i]} fuel={fuel} now={now} all={all} members={membersOnly(r.station)} />;
  const endName = (g: Shown['group']) => (g === 'start' ? found.from : found.to).short;
  const where = (x: Shown) => (x.group === 'way' ? `${routeMiles(x.r.along)} from the start` : `${milesText(x.r.fromEnd!)} from ${endName(x.group)}`);
  const extraText = (r: RouteRow) => (Number.isFinite(r.extra) ? routeMiles(r.extra) : '–');
  const GROUP: Record<Shown['group'], string> = { start: 'Cheapest near the start', way: 'On the way', end: 'Cheapest near the end' };
  const firstOf = (i: number) => i === 0 || shown[i - 1].group !== shown[i].group;
  const today = (r: RouteRow) => todayText(r.station, now, found.index.bank);

  return (
    <>
      <div className="results-head">
        <h3>
          {rows.length ? `${cap(WORDS[rows.length])} cheaper station${rows.length === 1 ? '' : 's'}` : 'No stations'} near the route from {found.from.label} to {found.to.label}{found.via ? `, via ${found.via.short}` : ''}
        </h3>
      </div>
      <div className="fuel-btns route-fuel" role="group" aria-label="Fuel">
        {(['e10', 'diesel'] as const).map((f) => (
          <button key={f} type="button" className="fuel-btn" aria-pressed={fuel === f} onClick={() => choose(f)}>
            {f === 'e10' ? 'Unleaded' : 'Diesel'}
          </button>
        ))}
      </div>
      <Notes found={found} shown={rows.length} within={chosen!.within} now={now} />
      {shown.length === 0 ? null : narrow ? (
        <div className="cards">
          {shown.map((x, i) => (
            <div key={x.r.station.id}>
              {firstOf(i) && <div className="grp">{GROUP[x.group]}</div>}
              <div className="pcard">
                <div className="pcard-top">
                  <div>{name(x.r)}</div>
                  <div className="dist mono route-extra">
                    {extraText(x.r)}
                    <div className="route-extra-lbl">extra</div>
                  </div>
                </div>
                <div className="grid">
                  <div className="lbl">{fuelName}</div>
                  <div>{price(x.r, i)}</div>
                  <div className="lbl">{x.group === 'way' ? 'On the way' : 'Where'}</div>
                  <div>{where(x)}</div>
                  <div className="lbl">Today</div>
                  <div className="openv">{today(x.r)}</div>
                  <div className="lbl">Address</div>
                  <div className="addr">{tidyAddress(x.r.station)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="table-box">
          <table className="table stations">
            <colgroup>
              <col className="station" />
              <col />
              <col />
              <col />
              <col />
            </colgroup>
            <thead>
              <tr>
                <th>Station</th>
                <th className="c">Where</th>
                <th className="c">Extra miles</th>
                <th className="c">{fuel === 'e10' ? 'Unleaded (E10)' : 'Diesel'}</th>
                <th className="c">Today</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((x, i) => (
                <Fragment key={x.r.station.id}>
                  {firstOf(i) && (
                    <tr className="grp-row">
                      <td colSpan={5}>
                        <div className="grp">{GROUP[x.group]}</div>
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td>
                      {name(x.r)}
                      <div className="addr">{tidyAddress(x.r.station)}</div>
                    </td>
                    <td className="c">{where(x)}</td>
                    <td className="c mono dist">{extraText(x.r)}</td>
                    <td className="c">{price(x.r, i)}</td>
                    <td className="c">{today(x.r)}</td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { collectedText, PriceCell, REPORT_URL, useNow } from './Results.tsx';
import { loadChoices, saveChoices, type Fuel } from '../lib/calc.ts';
import { loadArea, loadIndex, loadPostcodes, loadRouteRoads } from '../lib/load.ts';
import { fromDetail, type PageIndex } from '../lib/pageTypes.ts';
import { decodeDistrict } from '../lib/postcodes.ts';
import { useIsNarrow } from '../lib/responsive.ts';
import {
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
  type Network,
  type Pc,
  type RouteRow,
  type RouteTarget,
} from '../lib/route.ts';
import { membersOnly, postcodeArea, readPostcode, tidyAddress, tidyName } from '../lib/search.ts';

// "Find cheaper fuel near the route" (John, 31 October 2026; option b): the form, then the eight cheapest within three extra
// miles in the order you'd reach them. Everything is worked out on this device (src/lib/route.ts).

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

type Field = 'from' | 'via' | 'to';
const LABEL: Record<Field, string> = { from: 'From', via: 'Via (optional)', to: 'To' };

export function JourneyForm({ target }: { target: RouteTarget }) {
  const initial = (p?: Pc) => (p ? pcText(p).replace(' ', ' ') : '');
  const [typed, setTyped] = useState<Record<Field, string>>({ from: initial(target.from), via: initial(target.via), to: initial(target.to) });
  const [problem, setProblem] = useState('');
  useEffect(() => setTyped({ from: initial(target.from), via: initial(target.via), to: initial(target.to) }), [target.from, target.via, target.to]);

  async function go(e: FormEvent) {
    e.preventDefault();
    setProblem('');
    let outcodes;
    try {
      outcodes = (await loadIndex()).outcodes;
    } catch {
      setProblem('Sorry, the postcodes couldn’t be loaded. Check your connection and try again.');
      return;
    }
    const read: Partial<Record<Field, Pc>> = {};
    for (const f of ['from', 'via', 'to'] as Field[]) {
      if (f === 'via' && !typed.via.trim()) continue;
      const r = readPostcode(typed[f], outcodes);
      if (!r.ok) {
        const name = f === 'via' ? 'Via' : LABEL[f];
        setProblem(
          r.problem === 'empty'
            ? `Please type a postcode in ${name}, such as RG1 8FR.`
            : r.problem === 'northern-ireland'
              ? `${name}: Refueller covers Great Britain only for now, so Northern Ireland postcodes aren’t included yet.`
              : r.problem === 'not-found'
                ? `${name}: we can’t find ${typed[f].trim().toUpperCase().split(/\s+/)[0]} among Great Britain’s postcodes.`
                : `${name}: that doesn’t look like a postcode. Try one like RG1 or RG1 8FR.`,
        );
        return;
      }
      read[f] = { outcode: r.outcode, ...(r.inward ? { inward: r.inward } : {}) };
    }
    location.hash = routeHash({ kind: 'route', ...read });
  }

  const box = (f: Field) => (
    <label className="jf" key={f}>
      <span className="jl">{LABEL[f]}</span>
      <input
        className="input"
        value={typed[f]}
        onChange={(e) => setTyped({ ...typed, [f]: e.target.value })}
        placeholder={f === 'via' ? 'RG1 or RG1 8FR' : ''}
        autoCapitalize="characters"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint={f === 'to' ? 'go' : 'next'}
        maxLength={10}
      />
    </label>
  );
  return (
    <form className="search-form" onSubmit={go} noValidate>
      <div className="search journey">
        {box('from')}
        {box('via')}
        {box('to')}
        <button type="submit" className="btn btn-primary">
          Find
        </button>
      </div>
      {problem ? (
        <p className="problem" role="alert">
          {problem}
        </p>
      ) : (
        <p className="hint">Full postcodes or just the first half (RG1). The route is worked out on this page: nothing you type leaves it.</p>
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

type Where = { lat: number; lon: number; label: string; notFound?: string };
async function whereIs(index: PageIndex, p: Pc): Promise<Where> {
  const [lat, lon, place] = index.outcodes[p.outcode] ?? [];
  if (lat === undefined) throw new Error('unknown district');
  const district = { lat, lon, label: `${p.outcode} (${place.split(' / ')[0]})` };
  if (!p.inward) return district;
  const file = index.postcodes ? await loadPostcodes(index.postcodes.folder, postcodeArea(p.outcode)) : {};
  const at = file[p.outcode] ? decodeDistrict(file[p.outcode]).get(p.inward) : undefined;
  const full = pcText(p);
  return at ? { lat: at[0], lon: at[1], label: `${full} (${place.split(' / ')[0]})` } : { ...district, notFound: full };
}

type Found = { ok: true; index: PageIndex; miles: number; candidates: RouteRow[]; from: Where; to: Where; via?: Where } | { ok: false; message: string };

async function find(t: Required<Pick<RouteTarget, 'from' | 'to'>> & RouteTarget): Promise<Found> {
  const index = await loadIndex();
  if (!index.route) return { ok: false, message: 'Sorry, the road map isn’t available at the moment. Try again later.' };
  const [from, to, via] = await Promise.all([whereIs(index, t.from), whereIs(index, t.to), t.via ? whereIs(index, t.via) : Promise.resolve(undefined)]);
  const net = await getNetwork(index.route.file);
  const places = [from, ...(via ? [via] : []), to].map((w) => toPlace(w.lat, w.lon));
  const j = journey(net, places, getStationPlaces(index));
  if (!j.ok)
    return {
      ok: false,
      message:
        j.problem === 'no-road'
          ? 'There’s no road route between those places (a ferry may be needed), so Refueller can’t work out a journey.'
          : 'One of those places is too far from a main road for Refueller to work out a journey.',
    };
  const near = index.points.map((p, i) => ({ p, i })).filter(({ i }) => j.extra[i] <= ROUTE_EXTRA_MILES && j.minutes[i] <= ROUTE_EXTRA_MINUTES);
  const areas = [...new Set(near.map(({ p }) => p[2]))];
  const files = new Map(await Promise.all(areas.map(async (a) => [a, await loadArea(index.version, index.areas[a])] as const)));
  const candidates = near.map(({ p, i }) => {
    const { station, prices } = fromDetail(files.get(p[2])![p[3]], p[0], p[1]);
    return { station, prices, along: j.along[i], extra: j.extra[i], minutes: j.minutes[i] };
  });
  return { ok: true, index, miles: j.miles, candidates, from, to, via };
}

function Notes({ found, shown, within, now }: { found: Extract<Found, { ok: true }>; shown: number; within: number; now: number }) {
  const missing = [found.from, found.via, found.to].filter((w): w is Where => !!w?.notFound);
  return (
    <p className="notes">
      {missing.map((w) => `We couldn’t find ${w.notFound} (it may be new, or mistyped), so the middle of ${w.label.split(' ')[0]} is used. `)}
      The route is about {Math.round(found.miles)} miles by road{found.via ? `, via ${found.via.label}` : ''}.{' '}
      {within === 0
        ? `No station adds less than ${ROUTE_EXTRA_MILES} miles and ${ROUTE_EXTRA_MINUTES} minutes to it, there and back.`
        : shown === within
          ? `${cap(WORDS[within] ?? String(within))} station${within === 1 ? ' adds' : 's add'} no more than ${ROUTE_EXTRA_MILES} miles and about ${ROUTE_EXTRA_MINUTES} minutes to it, there and back; here ${within === 1 ? 'it is' : 'they are'}, in the order you’d reach them.`
          : `Of the ${within} stations that add no more than ${ROUTE_EXTRA_MILES} miles and about ${ROUTE_EXTRA_MINUTES} minutes to it, there and back, these are the cheapest, in the order you’d reach them.`}{' '}
      Distances are by main roads, so they’re a guide. Opening hours are today’s. Prices collected at {collectedText(found.index.collected, now)}, as
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
  }, [target.from?.outcode, target.from?.inward, target.to?.outcode, target.to?.inward, target.via?.outcode, target.via?.inward, attempt]);

  const chosen = useMemo(() => (found?.ok ? routeEight(found.candidates, fuel) : null), [found, fuel]);
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
  const cheapest = routeCheapest(rows, fuel);
  const all = rows.map((r) => r.prices[fuel]!.p).sort((a, b) => a - b);
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
  const today = (r: RouteRow) => todayText(r.station, now, found.index.bank);

  return (
    <>
      <div className="results-head">
        <h3>
          {rows.length ? `${cap(WORDS[rows.length])} cheaper station${rows.length === 1 ? '' : 's'}` : 'No stations'} near the route from {found.from.label} to {found.to.label}
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
      {rows.length === 0 ? null : narrow ? (
        <div className="cards">
          {rows.map((r, i) => (
            <div key={r.station.id} className="pcard">
              <div className="pcard-top">
                <div>{name(r)}</div>
                <div className="dist mono route-extra">
                  {routeMiles(r.extra)}
                  <div className="route-extra-lbl">extra</div>
                </div>
              </div>
              <div className="grid">
                <div className="lbl">{fuelName}</div>
                <div>{price(r, i)}</div>
                <div className="lbl">On the way</div>
                <div>{routeMiles(r.along)} from the start</div>
                <div className="lbl">Today</div>
                <div className="openv">{today(r)}</div>
                <div className="lbl">Address</div>
                <div className="addr">{tidyAddress(r.station)}</div>
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
                <th className="c">On the way</th>
                <th className="c">Extra miles</th>
                <th className="c">{fuel === 'e10' ? 'Unleaded (E10)' : 'Diesel'}</th>
                <th className="c">Today</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.station.id}>
                  <td>
                    {name(r)}
                    <div className="addr">{tidyAddress(r.station)}</div>
                  </td>
                  <td className="c">{routeMiles(r.along)} from the start</td>
                  <td className="c mono dist">{routeMiles(r.extra)}</td>
                  <td className="c">{price(r, i)}</td>
                  <td className="c">{today(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

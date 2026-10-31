import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { CalcPanel, type Origin } from './Calc.tsx';
import { HistoryPanel, type Histories } from './History.tsx';
import { cheaperFuels } from '../lib/calc.ts';
import { fromDetail, type PageIndex } from '../lib/pageTypes.ts';
import { loadArea, loadIndex } from '../lib/load.ts';
import { useIsNarrow } from '../lib/responsive.ts';
import {
  clockText,
  hoursProblem,
  isOld,
  milesBetween,
  milesText,
  nearestFrom,
  openText,
  postcodeArea,
  tidyAddress,
  tidyName,
  ukNow,
  updatedText,
  type Price,
  type Row,
  type Station,
} from '../lib/search.ts';

// What the eight are centred on: the middle of a postcode district, or one station (#station/RG/d20f21e97871).
export type Target = { kind: 'postcode'; outcode: string } | { kind: 'station'; area: string; id: string };

export const stationHash = (s: Station) => `#station/${postcodeArea(s.postcode)}/${s.id}`;

// Fuel Finder's own page for reporting a wrong price (the Fair Use policy asks for the link; SPEC §2a).
export const REPORT_URL = 'https://www.fuel-finder.service.gov.uk/motorist/price-report';

const WORDS = ['no', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'];

// The current time, moved on every minute, so "Open until …" and "Price set … ago" stay right while the page is open.
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  return now;
}

// "10.15am today", "4.15pm yesterday", "10.15am on October 28th".
function collectedText(iso: string, now: number): string {
  const t = Date.parse(iso);
  const when = ukNow(t);
  const time = clockText(`${String(Math.floor(when.mins / 60)).padStart(2, '0')}:${String(when.mins % 60).padStart(2, '0')}`);
  const today = ukNow(now).date;
  const yesterday = ukNow(now - 86_400_000).date;
  if (when.date === today) return `${time} today`;
  if (when.date === yesterday) return `${time} yesterday`;
  const [, m, d] = when.date.split('-').map(Number);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const ord = d % 10 === 1 && d !== 11 ? 'st' : d % 10 === 2 && d !== 12 ? 'nd' : d % 10 === 3 && d !== 13 ? 'rd' : 'th';
  return `${time} on ${months[m - 1]} ${d}${ord}`;
}

function PriceCell({ p, cheapest, fuel, now }: { p?: Price; cheapest: boolean; fuel: 'e10' | 'diesel'; now: number }) {
  if (!p) return <span className="none">Doesn’t sell {fuel === 'e10' ? 'unleaded' : 'diesel'}</span>;
  return (
    <>
      <div className="price mono">{p.p.toFixed(1)}p</div>
      {cheapest && (
        <div>
          <span className="cheap-tag">Cheapest</span>
        </div>
      )}
      <div className={`upd${isOld(p.u, now) ? ' old' : ''}`}>{updatedText(p.u, now)}</div>
      {p.x && (
        <div className="unusual">
          Unusual price, may be a mistake.{' '}
          <a href={REPORT_URL} target="_blank" rel="noopener noreferrer">
            Report it
          </a>
        </div>
      )}
    </>
  );
}

function OpenCell({ row }: { row: Row }) {
  const [more, setMore] = useState(false);
  const text = openText(row.open);
  if (row.open.open === false) return <span className="closed-tag">{text}</span>;
  if (row.open.open !== null || !row.open.wrong) return <>{text}</>;
  // Hours that look wrong: "More" explains which rule caught them (John, 30 October).
  return (
    <>
      <div>{text}</div>
      <button type="button" className="more-btn" aria-expanded={more} onClick={() => setMore((m) => !m)}>
        {more ? 'Less' : 'More'}
      </button>
      {more && <p className="more-text">{hoursProblem(row.station)}</p>}
    </>
  );
}

// "Find stations near this one" (John, 30 October; first called "Centre on this station"): searches again from that
// station's own position. Hidden on 31 October (John: it adds clutter, and the other two are better; to think about much later,
// PLAN idea 2). Everything behind it stays: set SHOW_FIND_NEAR to true to bring the link back. A #station/… address still works.
const SHOW_FIND_NEAR = false;
// "Worth driving here?" (PLAN Stage 7), which opens the calculator under the station: only on a station cheaper than the
// nearest open one for at least one fuel (John, 30 October), as elsewhere it could only say there's nothing to work out;
// and "Price history" (31 October), on every station. One panel open at a time.
type PanelKind = 'calc' | 'history';
type Calc = { open: { id: string; kind: PanelKind } | null; toggle: (id: string, kind: PanelKind) => void; offered: (r: Row) => boolean; panel: (r: Row) => ReactNode };

function RowLinks({ row, centreId, calc }: { row: Row; centreId?: string; calc: Calc }) {
  const isOpen = (kind: PanelKind) => calc.open?.id === row.station.id && calc.open.kind === kind;
  return (
    <div className="row-links">
      {SHOW_FIND_NEAR && row.station.id !== centreId && (
        <a className="centre-link" href={stationHash(row.station)}>
          Find stations near this one
        </a>
      )}
      {calc.offered(row) && (
        <button type="button" className="centre-link link-btn" aria-expanded={isOpen('calc')} onClick={() => calc.toggle(row.station.id, 'calc')}>
          Worth driving here?
        </button>
      )}
      <button type="button" className="centre-link link-btn" aria-expanded={isOpen('history')} onClick={() => calc.toggle(row.station.id, 'history')}>
        Price history
      </button>
    </div>
  );
}

const distanceText = (row: Row, centreId?: string) => (row.station.id === centreId ? 'This station' : milesText(row.miles));

function Table({ rows, now, centreId, calc }: { rows: Row[]; now: number; centreId?: string; calc: Calc }) {
  return (
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
            <th className="c">Distance</th>
            <th className="c">Unleaded (E10)</th>
            <th className="c">Diesel</th>
            <th className="c">Open</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <Fragment key={r.station.id}>
              <tr className={r.open.open === false ? 'closed' : undefined}>
                <td>
                  <div className="brand">{r.station.brand}</div>
                  <div className="sname">{tidyName(r.station.name)}</div>
                  <div className="addr">{tidyAddress(r.station)}</div>
                  <RowLinks row={r} centreId={centreId} calc={calc} />
                </td>
                <td className="c mono dist">{distanceText(r, centreId)}</td>
                <td className="c">
                  <PriceCell p={r.prices.e10} cheapest={r.cheapest.e10} fuel="e10" now={now} />
                </td>
                <td className="c">
                  <PriceCell p={r.prices.diesel} cheapest={r.cheapest.diesel} fuel="diesel" now={now} />
                </td>
                <td className="c">
                  <OpenCell row={r} />
                </td>
              </tr>
              {calc.open?.id === r.station.id && (
                <tr className="calc-row">
                  <td colSpan={5}>{calc.panel(r)}</td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Cards({ rows, now, centreId, calc }: { rows: Row[]; now: number; centreId?: string; calc: Calc }) {
  return (
    <div className="cards">
      {rows.map((r) => (
        <div key={r.station.id} className={`pcard${r.open.open === false ? ' closed' : ''}`}>
          <div className="pcard-top">
            <div>
              <div className="brand">{r.station.brand}</div>
              <div className="sname">{tidyName(r.station.name)}</div>
            </div>
            <div className="dist mono">{distanceText(r, centreId)}</div>
          </div>
          <div className="grid">
            <div className="lbl">Unleaded</div>
            <div>
              <PriceCell p={r.prices.e10} cheapest={r.cheapest.e10} fuel="e10" now={now} />
            </div>
            <div className="lbl">Diesel</div>
            <div>
              <PriceCell p={r.prices.diesel} cheapest={r.cheapest.diesel} fuel="diesel" now={now} />
            </div>
            <div className="lbl">Open</div>
            <div className="openv">
              <OpenCell row={r} />
            </div>
            <div className="lbl">Address</div>
            <div className="addr">{tidyAddress(r.station)}</div>
          </div>
          <RowLinks row={r} centreId={centreId} calc={calc} />
          {calc.open?.id === r.station.id && calc.panel(r)}
        </div>
      ))}
    </div>
  );
}

type Found = { index: PageIndex; lat: number; lon: number; rows: Row[]; histories: Histories; heading: string; from: string; centreId?: string };

// Asked for a station that isn't in this collection (closed since the link was made, say).
class NotListed extends Error {}

// The eight nearest stations to the target: positions from the index, then the details of just the postcode areas those eight
// are in.
async function find(target: Target, now: number): Promise<Found> {
  const index = await loadIndex();
  let lat: number, lon: number, heading: string, from: string, centreId: string | undefined;
  if (target.kind === 'postcode') {
    const [la, lo, place] = index.outcodes[target.outcode];
    [lat, lon, heading, from] = [la, lo, `${target.outcode} (${place})`, `the middle of ${target.outcode}`];
  } else {
    const a = index.areas.indexOf(target.area);
    if (a < 0) throw new NotListed();
    const file = await loadArea(index.version, target.area);
    const i = file.findIndex((r) => r[9] === target.id);
    const point = index.points.find((p) => p[2] === a && p[3] === i);
    if (i < 0 || !point) throw new NotListed();
    const name = tidyName(file[i][0]);
    [lat, lon, heading, from, centreId] = [point[0], point[1], name, name, target.id];
  }
  const nearest = index.points
    .map((p, i) => ({ p, i, miles: milesBetween(lat, lon, p[0], p[1]) }))
    .sort((a, b) => a.miles - b.miles || a.i - b.i)
    .slice(0, 8);
  const files = new Map<number, Awaited<ReturnType<typeof loadArea>>>();
  await Promise.all([...new Set(nearest.map((n) => n.p[2]))].map(async (a) => files.set(a, await loadArea(index.version, index.areas[a]))));
  const stations = [];
  const prices: Record<string, { e10?: Price; diesel?: Price }> = {};
  const histories: Histories = {};
  for (const n of nearest) {
    const d = fromDetail(files.get(n.p[2])![n.p[3]], n.p[0], n.p[1]);
    stations.push(d.station);
    prices[d.station.id] = d.prices;
    histories[d.station.id] = d.history;
  }
  const rows = nearestFrom(lat, lon, stations, prices, index.outcodes, index.bank, now);
  return { index, lat, lon, rows, histories, heading, from, centreId };
}

export function Results({ target }: { target: Target }) {
  const now = useNow();
  const narrow = useIsNarrow(720);
  const [found, setFound] = useState<Found | null>(null);
  const [failed, setFailed] = useState<'' | 'load' | 'not-listed'>('');
  const [attempt, setAttempt] = useState(0);
  const [panel, setPanel] = useState<{ id: string; kind: PanelKind } | null>(null);
  const key = target.kind === 'postcode' ? target.outcode : `${target.area}/${target.id}`;

  useEffect(() => {
    let live = true;
    setFailed('');
    setFound(null);
    setPanel(null);
    find(target, Date.now())
      .then((f) => live && setFound(f))
      .catch((e) => live && setFailed(e instanceof NotListed ? 'not-listed' : 'load'));
    return () => {
      live = false;
    };
    // `key` stands for the target, so a new object for the same place doesn't search again.
  }, [key, attempt]);

  if (failed === 'not-listed')
    return (
      <div className="message" role="alert">
        <p>That station isn’t listed any more. Try a postcode instead.</p>
      </div>
    );
  if (failed)
    return (
      <div className="message" role="alert">
        <p>Sorry, the prices couldn’t be loaded. Check your connection and try again.</p>
        <button type="button" className="btn btn-secondary" onClick={() => setAttempt((a) => a + 1)}>
          Try again
        </button>
      </div>
    );
  if (!found) return <p className="message muted">Finding stations…</p>;

  // Opening states and "cheapest" worked out again for the current minute.
  const rows = nearestFrom(
    found.lat,
    found.lon,
    found.rows.map((r) => r.station),
    Object.fromEntries(found.rows.map((r) => [r.station.id, r.prices])),
    found.index.outcodes,
    found.index.bank,
    now,
  );
  const closed = rows.filter((r) => r.open.open === false).length;
  const nowUk = ukNow(now);
  const nowText = `${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][nowUk.day]} ${clockText(`${String(Math.floor(nowUk.mins / 60)).padStart(2, '0')}:${String(nowUk.mins % 60).padStart(2, '0')}`)}`;
  const stale = now - Date.parse(found.index.collected) > 24 * 3_600_000;
  const origin: Origin = target.kind === 'postcode' ? { area: /^[A-Z]+/.exec(target.outcode)?.[0] ?? '', key: target.outcode } : { area: target.area, key: target.id };
  // One panel open at a time.
  const calc: Calc = {
    open: panel,
    toggle: (id, kind) => setPanel((c) => (c?.id === id && c.kind === kind ? null : { id, kind })),
    offered: (r) => cheaperFuels(r, rows).length > 0,
    panel: (r) =>
      panel?.kind === 'history' ? (
        <HistoryPanel
          row={r}
          rows={rows}
          histories={found.histories}
          collected={found.index.collected}
          recordedFrom={found.index.history?.recordedFrom ?? found.index.collected}
          onClose={() => setPanel(null)}
        />
      ) : (
        <CalcPanel row={r} rows={rows} origin={origin} centreId={found.centreId} roads={found.index.roads} onClose={() => setPanel(null)} />
      ),
  };

  return (
    <>
      <div className="results-head">
        <h3>
          {WORDS[rows.length]} nearest stations to {found.heading}
        </h3>
      </div>
      <p className="notes">
        Straight-line distances from {found.from}.
        {closed > 0 && ` ${WORDS[closed]} of them ${closed === 1 ? 'is' : 'are'} closed now (${nowText}).`} Prices collected at{' '}
        {collectedText(found.index.collected, now)}, as reported by each station; they may have changed since.
        {stale && ' The latest collection is older than usual, so some prices may be out of date.'}{' '}
        <a href={REPORT_URL} target="_blank" rel="noopener noreferrer">
          Report a wrong price
        </a>
        .
      </p>
      {narrow ? <Cards rows={rows} now={now} centreId={found.centreId} calc={calc} /> : <Table rows={rows} now={now} centreId={found.centreId} calc={calc} />}
    </>
  );
}

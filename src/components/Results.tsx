import { useEffect, useState } from 'react';
import { fromDetail, type PageIndex } from '../lib/pageTypes.ts';
import { loadArea, loadIndex } from '../lib/load.ts';
import { useIsNarrow } from '../lib/responsive.ts';
import {
  clockText,
  isOld,
  milesBetween,
  milesText,
  nearestEight,
  openText,
  tidyAddress,
  tidyName,
  ukNow,
  updatedText,
  type Price,
  type Row,
} from '../lib/search.ts';

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
  const text = openText(row.open);
  return row.open.open === false ? <span className="closed-tag">{text}</span> : <>{text}</>;
}

function Table({ rows, now }: { rows: Row[]; now: number }) {
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
            <tr key={r.station.id} className={r.open.open === false ? 'closed' : undefined}>
              <td>
                <div className="brand">{r.station.brand}</div>
                <div className="sname">{tidyName(r.station.name)}</div>
                <div className="addr">{tidyAddress(r.station)}</div>
              </td>
              <td className="c mono dist">{milesText(r.miles)}</td>
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
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Cards({ rows, now }: { rows: Row[]; now: number }) {
  return (
    <div className="cards">
      {rows.map((r) => (
        <div key={r.station.id} className={`pcard${r.open.open === false ? ' closed' : ''}`}>
          <div className="pcard-top">
            <div>
              <div className="brand">{r.station.brand}</div>
              <div className="sname">{tidyName(r.station.name)}</div>
            </div>
            <div className="dist mono">{milesText(r.miles)}</div>
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
        </div>
      ))}
    </div>
  );
}

type Found = { index: PageIndex; place: string; rows: Row[] };

// The eight nearest stations to the middle of a postcode district: positions from the index, then the details of just the
// postcode areas those eight are in.
async function find(outcode: string, now: number): Promise<Found> {
  const index = await loadIndex();
  const [lat, lon] = index.outcodes[outcode];
  const nearest = index.points
    .map((p, i) => ({ p, i, miles: milesBetween(lat, lon, p[0], p[1]) }))
    .sort((a, b) => a.miles - b.miles || a.i - b.i)
    .slice(0, 8);
  const files = new Map<number, Awaited<ReturnType<typeof loadArea>>>();
  await Promise.all([...new Set(nearest.map((n) => n.p[2]))].map(async (a) => files.set(a, await loadArea(index.version, index.areas[a]))));
  const stations = [];
  const prices: Record<string, { e10?: Price; diesel?: Price }> = {};
  for (const n of nearest) {
    const id = `${index.areas[n.p[2]]}:${n.p[3]}`;
    const d = fromDetail(files.get(n.p[2])![n.p[3]], n.p[0], n.p[1], id);
    stations.push(d.station);
    prices[id] = d.prices;
  }
  const r = nearestEight(outcode, stations, prices, index.outcodes, index.bank, now);
  return { index, place: r.place, rows: r.rows };
}

export function Results({ outcode }: { outcode: string }) {
  const now = useNow();
  const narrow = useIsNarrow(720);
  const [found, setFound] = useState<Found | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setFailed(false);
    find(outcode, Date.now())
      .then((f) => live && setFound(f))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [outcode, attempt]);

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
  const rows = nearestEight(
    outcode,
    found.rows.map((r) => r.station),
    Object.fromEntries(found.rows.map((r) => [r.station.id, r.prices])),
    found.index.outcodes,
    found.index.bank,
    now,
  ).rows;
  const closed = rows.filter((r) => r.open.open === false).length;
  const nowUk = ukNow(now);
  const nowText = `${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][nowUk.day]} ${clockText(`${String(Math.floor(nowUk.mins / 60)).padStart(2, '0')}:${String(nowUk.mins % 60).padStart(2, '0')}`)}`;
  const stale = now - Date.parse(found.index.collected) > 24 * 3_600_000;

  return (
    <>
      <div className="results-head">
        <h3>
          {WORDS[rows.length]} nearest stations to {outcode} ({found.place})
        </h3>
      </div>
      <p className="notes">
        Straight-line distances from the middle of {outcode}.
        {closed > 0 && ` ${WORDS[closed]} of them ${closed === 1 ? 'is' : 'are'} closed now (${nowText}).`} Prices collected at{' '}
        {collectedText(found.index.collected, now)}, as reported by each station; they may have changed since.
        {stale && ' The latest collection is older than usual, so some prices may be out of date.'}{' '}
        <a href={REPORT_URL} target="_blank" rel="noopener noreferrer">
          Report a wrong price
        </a>
        .
      </p>
      {narrow ? <Cards rows={rows} now={now} /> : <Table rows={rows} now={now} />}
    </>
  );
}

import { useEffect, useState, type PointerEvent } from 'react';
import { stationSteps, type Histories } from './History.tsx';
import { eightSeries, gbSeries, pence1, AVERAGE_DAYS, FUELS, type AveragesPage, type Point } from '../lib/averages.ts';
import { levelRows, localIndex, pence, type AreaLookup, type Pair } from '../lib/levels.ts';
import { axisDate, dateWords } from '../lib/history.ts';
import { loadAverages, loadCouncils } from '../lib/load.ts';
import type { PageIndex } from '../lib/pageTypes.ts';
import { useIsNarrow } from '../lib/responsive.ts';
import { postcodeArea, type Row } from '../lib/search.ts';

// "The wider picture" (John, 1 November 2026; no dots on any line, John): under the list, the average price at these eight
// stations and in their council area, county, region, country and Great Britain, each with a fact (src/lib/levels.ts; John,
// November 1st, option B of design/previews/levels/), in place of the key; then a chart for unleaded and one for diesel, each on its
// own scale, with the eight and Great Britain at each collection over the last 30 days (the postcode area's line taken out with
// option B). The mean of the usual prices (src/lib/averages.ts). Colours: the eight in the graph's terracotta (as "this station" in
// the price history), Great Britain in grey and dashed (as the average there), so neither is told apart by colour alone.

type Fuel = 'e10' | 'diesel';
type Line = { key: 'eight' | 'gb'; label: string; pts: Point[] };
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];

function Chart({ lines, fuelName, narrow, start, end }: { lines: Line[]; fuelName: string; narrow: boolean; start: number; end: number }) {
  const [tip, setTip] = useState<number | null>(null);
  const shown = lines.filter((l) => l.pts.length);
  if (!shown.length) return <p className="avg-none">No {fuelName.toLowerCase()} prices to average yet.</p>;
  const w = narrow ? 340 : 470;
  const h = 210;
  const [L, R, T, B] = [44, 52, 12, 26];
  const ps = shown.flatMap((l) => l.pts.map((p) => p.p));
  const lo = Math.floor(Math.min(...ps) - 0.6);
  const hi = Math.ceil(Math.max(...ps) + 0.6);
  const span = Math.max(end - start, 1);
  const x = (t: number) => L + ((t - start) / span) * (w - L - R);
  const y = (p: number) => T + ((hi - p) / (hi - lo)) * (h - T - B);
  const stepY = hi - lo > 12 ? 5 : hi - lo > 6 ? 2 : 1;
  const grid: number[] = [];
  for (let p = Math.ceil(lo / stepY) * stepY; p <= hi; p += stepY) grid.push(p);
  // Axis dates at UK midday, counted back from the last collection's day, at most about five.
  const dayMs = 86_400_000;
  const lastDay = Date.parse(`${new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date(end))}T12:00:00Z`);
  const days = Math.max(1, Math.round((lastDay - start) / dayMs) + 1);
  const every = Math.max(1, Math.ceil(days / (narrow ? 4 : 6)));
  const ticks: number[] = [];
  for (let d = 0; ; d += every) {
    const t = lastDay - d * dayMs;
    if (t < start - dayMs / 2) break;
    if (t >= start - dayMs / 2 && t <= end + dayMs / 2) ticks.push(Math.max(start, Math.min(end, t)));
  }
  // End labels, moved apart when they would overlap.
  const ends = shown.map((l) => ({ l, v: l.pts[l.pts.length - 1].p, y: y(l.pts[l.pts.length - 1].p) + 4 })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 13) ends[i].y = ends[i - 1].y + 13;
  // The collection times, for pointing and tapping.
  const times = [...new Set(shown.flatMap((l) => l.pts.map((p) => p.t)))].sort((a, b) => a - b);
  const near = (px: number) => times.reduce((best, t, i) => (Math.abs(x(t) - px) < Math.abs(x(times[best]) - px) ? i : best), 0);
  const pick = (e: PointerEvent<SVGRectElement>) => {
    const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    setTip(near(((e.clientX - r.left) / r.width) * w));
  };
  const at = tip === null ? null : times[tip];
  const tipRows = at === null ? [] : shown.map((l) => ({ l, p: l.pts.find((p) => p.t === at) })).filter((r) => r.p);
  const tipW = 168;
  const tipX = at === null ? 0 : Math.min(Math.max(x(at) - tipW / 2, 0), w - tipW);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" className="avg-svg" role="img" aria-label={`${fuelName}: average prices`}>
      {grid.map((p) => (
        <g key={p}>
          <line className="g-grid" x1={L} x2={w - R} y1={y(p)} y2={y(p)} />
          <text className="g-ax" x={L - 6} y={y(p) + 4} textAnchor="end">
            {p}p
          </text>
        </g>
      ))}
      {ticks.map((t) => (
        <text key={t} className="g-ax" x={x(t)} y={h - 6} textAnchor="middle">
          {axisDate(t)}
        </text>
      ))}
      {shown.map((l) => (
        <g key={l.key}>
          {l.pts.length > 1 && <polyline className={`a-${l.key}`} points={l.pts.map((p) => `${x(p.t)},${y(p.p)}`).join(' ')} />}
          {l.pts.length === 1 && l.pts.map((p) => <circle key={p.t} className={`a-dot a-dot-${l.key}`} cx={x(p.t)} cy={y(p.p)} r={3.5} />)}
        </g>
      ))}
      {ends.map((e) => (
        <text key={e.l.key} className="g-lab" x={w - R + 6} y={e.y}>
          {pence1(e.v)}
        </text>
      ))}
      {at !== null && <line className="g-cross" x1={x(at)} x2={x(at)} y1={T} y2={h - B} />}
      <rect
        className="g-hit"
        x={L}
        y={T}
        width={w - L - R}
        height={h - T - B}
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={(e) => e.pointerType === 'mouse' && setTip(null)}
      />
      {at !== null && (
        <g className="g-tip" pointerEvents="none">
          <rect x={tipX} y={T + 2} width={tipW} height={22 + tipRows.length * 17} rx={8} />
          <text className="g-tip-b" x={tipX + 10} y={T + 19}>
            {dateWords(at, true)}
          </text>
          {tipRows.map((r, i) => (
            <text key={r.l.key} x={tipX + 10} y={T + 37 + i * 17}>
              {r.l.label}: {pence1(r.p!.p)}
            </text>
          ))}
        </g>
      )}
    </svg>
  );
}

// The charts' two lines: the eight in terracotta, Great Britain in grey and dashed.
function Key({ label, inline }: { label: string; inline?: boolean }) {
  return (
    <span className={`hist-legend avg-key${inline ? ' avg-key-inline' : ''}`}>
      <span>
        <i className="a-key-eight" />
        {label}
      </span>
      <span>
        <i className="a-key-gb" />
        Great Britain
      </span>
    </span>
  );
}

export function AveragesSection({ index, rows, histories, where }: { index: PageIndex; rows: Row[]; histories: Histories; where: string }) {
  const narrow = useIsNarrow(720);
  const [page, setPage] = useState<AveragesPage | null>(null);
  const [lookup, setLookup] = useState<AreaLookup | null>(null);
  const area = postcodeArea(where);
  useEffect(() => {
    let live = true;
    if (index.averages) {
      loadAverages(index.averages.file).then((f) => live && setPage(f), () => live && setPage(null));
      // Which council area the place is in; without it, the list goes straight from the eight to Great Britain.
      loadCouncils(index.averages.councils, area).then((l) => live && setLookup(l), () => live && setLookup(null));
    }
    return () => {
      live = false;
    };
  }, [index.averages, area]);
  if (!index.averages || !page || !page.gb.length) return null;
  const times = page.gb.map(([t]) => Date.parse(t));
  const [start, end] = [times[0], times[times.length - 1]];
  // The eight shown that sell each fuel at a usual price, and their average at each collection.
  const selling = (fuel: Fuel) => rows.filter((r) => r.prices[fuel] && !r.prices[fuel]!.x);
  const eightPts = (fuel: Fuel) => eightSeries(selling(fuel).map((r) => stationSteps(r, histories, fuel)), times);
  const eightLabel = `These ${WORDS[rows.length]} stations`;
  const linesFor = (fuel: Fuel): Line[] => {
    const n = selling(fuel).length;
    return [
      { key: 'eight', label: n === rows.length ? eightLabel : `The ${WORDS[n]} here that sell it`, pts: eightPts(fuel) },
      { key: 'gb', label: 'Great Britain', pts: gbSeries(page, fuel) },
    ];
  };
  const meanNow = (fuel: Fuel) => {
    const ps = selling(fuel).map((r) => r.prices[fuel]!.p);
    return ps.length ? Math.round((ps.reduce((a, b) => a + b, 0) / ps.length) * 100) / 100 : null;
  };
  // The eight's change since the first collection at which every one's price is known, for both fuels.
  const series = FUELS.map(eightPts);
  const t0 = Math.max(...series.filter((s) => s.length).map((s) => s[0].t));
  const at0 = series.map((s) => s.find((p) => p.t === t0)?.p ?? null) as Pair;
  const li = lookup ? localIndex(lookup, where) : null;
  const list = levelRows({
    eight: { name: eightLabel, now: [meanNow('e10'), meanNow('diesel')], then: Number.isFinite(t0) ? at0 : null, since: Number.isFinite(t0) ? dateWords(t0, false) : '' },
    local: li === null ? null : (page.locals[li] ?? null),
    locals: page.locals,
    latest: page.latest[1],
    first: page.first[1],
    since: dateWords(Date.parse(page.first[0]), false),
  });
  const filling = end - start < (AVERAGE_DAYS - 1) * 86_400_000;
  const price = (p: number | null) => (p === null ? '–' : pence(p));
  return (
    <section className="avg-sec" data-noprint>
      <h3>The wider picture</h3>
      <p>
        {/* John's wording (1 November): one sentence while the record builds up, another once it covers the whole 30 days. */}
        {filling
          ? `Average prices (excluding unusual ones) as collected by Refueller. This history will eventually show ${AVERAGE_DAYS} days. It is currently building up since recording began on ${dateWords(Date.parse(page.first[0]), false)}.`
          : `Average prices over the last ${AVERAGE_DAYS} days as collected by Refueller. Unusual prices are not included.`}
      </p>
      {/* A short key above the charts (John, November 1st): one line over both on a computer, beside each chart's heading on a phone,
          where the diesel chart is far down. The list under the charts is the full key. */}
      {!narrow && <Key label={eightLabel} />}
      <div className="avg-charts">
        <div className="hist avg-ch">
          <h4>
            Unleaded{narrow && <Key label={eightLabel} inline />}
          </h4>
          <Chart lines={linesFor('e10')} fuelName="Unleaded" narrow={narrow} start={start} end={end} />
        </div>
        <div className="hist avg-ch">
          <h4>
            Diesel{narrow && <Key label={eightLabel} inline />}
          </h4>
          <Chart lines={linesFor('diesel')} fuelName="Diesel" narrow={narrow} start={start} end={end} />
        </div>
      </div>
      {/* The averages at every level (John, November 1st: option B), under the charts (John: graph first), as their key: the two
          rows drawn in the charts carry their line. */}
      <div className="lv-box">
        <div className="lv-row lv-head" aria-hidden="true">
          <span>Average</span>
          <span className="lv-p">Unleaded</span>
          <span className="lv-p">Diesel</span>
        </div>
        {list.map((r) => (
          <div className="lv-row" key={r.key}>
            <span className="lv-name">
              {(r.key === 'eight' || r.key === 'GB') && <i className={r.key === 'eight' ? 'a-key-eight' : 'a-key-gb'} aria-hidden="true" />}
              {r.name}
            </span>
            <span className="lv-p">{price(r.now[0])}</span>
            <span className="lv-p">{price(r.now[1])}</span>
            <span className="lv-small">
              Unleaded <b>{price(r.now[0])}</b> · Diesel <b>{price(r.now[1])}</b>
            </span>
            {r.fact && <span className="lv-fact">{r.fact}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}

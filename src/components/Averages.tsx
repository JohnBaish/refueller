import { useEffect, useState, type PointerEvent } from 'react';
import { stationSteps, type Histories } from './History.tsx';
import { eightSeries, pence1, seriesOf, AVERAGE_DAYS, type AveragesFile, type Point } from '../lib/averages.ts';
import { axisDate, dateWords } from '../lib/history.ts';
import { loadAverages } from '../lib/load.ts';
import type { PageIndex } from '../lib/pageTypes.ts';
import { useIsNarrow } from '../lib/responsive.ts';
import type { Row } from '../lib/search.ts';

// "Average prices" (John, 1 November 2026; option B of the mock-ups): under the list, a chart for unleaded and one for diesel, each
// on its own scale, with the average at these eight stations, in the postcode area and across Great Britain at each collection over
// the last 30 days. The mean of the usual prices (src/lib/averages.ts). Colours: the eight in the graph's terracotta (as "this
// station" in the price history), the area in blue (checked with the dataviz validator against terracotta, light and dark), Great
// Britain in grey and dashed (as the average there), so no line is told apart by colour alone.

type Fuel = 'e10' | 'diesel';
type Line = { key: 'eight' | 'area' | 'gb'; label: string; pts: Point[] };
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
          {(l.key === 'eight' || l.pts.length === 1) && l.pts.map((p) => <circle key={p.t} className={`a-dot a-dot-${l.key}`} cx={x(p.t)} cy={y(p.p)} r={3.5} />)}
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

export function AveragesSection({ index, rows, histories, area }: { index: PageIndex; rows: Row[]; histories: Histories; area: string }) {
  const narrow = useIsNarrow(720);
  const [file, setFile] = useState<AveragesFile | null>(null);
  useEffect(() => {
    let live = true;
    if (index.averages) loadAverages(index.averages.file).then((f) => live && setFile(f), () => live && setFile(null));
    return () => {
      live = false;
    };
  }, [index.averages?.file]);
  if (!index.averages || !file || !file.collections.length) return null;
  const times = file.collections.map(([t]) => Date.parse(t));
  const [start, end] = [times[0], times[times.length - 1]];
  const areaLabel = `${area} postcodes`;
  const linesFor = (fuel: Fuel): Line[] => {
    // The eight shown that sell the fuel at a usual price.
    const selling = rows.filter((r) => r.prices[fuel] && !r.prices[fuel]!.x);
    const eight = eightSeries(
      selling.map((r) => stationSteps(r, histories, fuel)),
      times,
    );
    const eightLabel = selling.length === rows.length ? `These ${WORDS[rows.length]} stations` : `The ${WORDS[selling.length]} here that sell it`;
    return [
      { key: 'eight', label: eightLabel, pts: eight },
      { key: 'area', label: areaLabel, pts: seriesOf(file, area, fuel) },
      { key: 'gb', label: 'Great Britain', pts: seriesOf(file, 'GB', fuel) },
    ];
  };
  const filling = end - start < (AVERAGE_DAYS - 1) * 86_400_000;
  return (
    <section className="avg-sec" data-noprint>
      <h3>Average prices</h3>
      <p>
        The average price of unleaded and diesel at each of Refueller’s collections: at these {WORDS[rows.length]} stations, in {area}{' '}
        postcodes and across Great Britain, over the last {AVERAGE_DAYS} days
        {filling ? ` (since recording began on ${dateWords(start, false)})` : ''}. Unusual prices are not included.
      </p>
      <div className="hist-legend">
        <span>
          <i className="a-key-eight" />
          These {WORDS[rows.length]} stations
        </span>
        <span>
          <i className="a-key-area" />
          {areaLabel}
        </span>
        <span>
          <i className="a-key-gb" />
          Great Britain
        </span>
      </div>
      <div className="avg-charts">
        <div className="hist avg-ch">
          <h4>Unleaded</h4>
          <Chart lines={linesFor('e10')} fuelName="Unleaded" narrow={narrow} start={start} end={end} />
        </div>
        <div className="hist avg-ch">
          <h4>Diesel</h4>
          <Chart lines={linesFor('diesel')} fuelName="Diesel" narrow={narrow} start={start} end={end} />
        </div>
      </div>
    </section>
  );
}

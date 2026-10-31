import { useState } from 'react';
import { fuelWord, loadChoices, saveChoices, type Fuel } from '../lib/calc.ts';
import { average, axisDate, dateWords, historySentence, steps, windowFor, type Hist, type Step } from '../lib/history.ts';
import { useIsNarrow } from '../lib/responsive.ts';
import { tidyName, type Row } from '../lib/search.ts';

export type Histories = Record<string, { e10?: Hist; diesel?: Hist }>;

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];

// A station's known prices for a fuel: its history (last 14 days, with set times) or just its current price.
export function stationSteps(row: Row, histories: Histories, fuel: Fuel): Step[] {
  const h = histories[row.station.id]?.[fuel];
  if (h) return steps(h);
  const p = row.prices[fuel];
  return p ? [{ t: Date.parse(p.u), p: p.p }] : [];
}

type Geo = { w: number; h: number; left: number; right: number; top: number; bottom: number; xEvery: number };

function Chart({ mine, avg, start, end, geo, label }: { mine: Step[]; avg: { from: number; steps: Step[] } | null; start: number; end: number; geo: Geo; label: string }) {
  const [tip, setTip] = useState<number | null>(null);
  const { w, h, left: L, right: R, top: T, bottom: B } = geo;
  const ps = [...mine.map((s) => s.p), ...(avg?.steps.map((s) => s.p) ?? [])];
  const lo = Math.floor(Math.min(...ps) - 0.6);
  const hi = Math.ceil(Math.max(...ps) + 0.6);
  const x = (t: number) => L + ((Math.max(t, start) - start) / (end - start)) * (w - L - R);
  const y = (p: number) => T + ((hi - p) / (hi - lo)) * (h - T - B);
  const stepY = hi - lo > 12 ? 5 : hi - lo > 6 ? 2 : 1;
  const grid = [];
  for (let p = Math.ceil(lo / stepY) * stepY; p <= hi; p += stepY) grid.push(p);
  // Axis dates at UK midnights, every few days, counted back from the end so the latest date is always shown.
  const ticks: number[] = [];
  const endDay = Date.parse(`${new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date(end))}T12:00:00Z`);
  for (let d = 0; ; d += geo.xEvery) {
    const t = endDay - d * 86_400_000;
    if (t < start) break;
    ticks.push(t);
  }
  const path = (st: Step[], from: number) => {
    let d = '';
    st.forEach((s, i) => (d += i === 0 ? `M${x(Math.max(s.t, from))},${y(s.p)}` : `H${x(s.t)}V${y(s.p)}`));
    return `${d}H${x(end)}`;
  };
  const known = mine[0].t;
  const me = mine[mine.length - 1].p;
  const av = avg ? avg.steps[avg.steps.length - 1].p : null;
  let ym = y(me) + 4;
  let ya = av === null ? 0 : y(av) + 4;
  if (av !== null && Math.abs(ym - ya) < 14) [ym, ya] = ym <= ya ? [ym - 7, ya + 7] : [ym + 7, ya - 7];
  const dots = mine.map((s, i) => ({ s, i })).filter(({ s }) => s.t >= start);
  const active = tip === null ? null : mine[tip];
  return (
    // A mouse shows a dot's label while pointing at it; on a touch screen a tap shows it and a tap elsewhere on the graph hides it
    // (touch screens also send "mouse leave" after a tap, so only a real mouse leaving hides it).
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      role="img"
      aria-label={label}
      className="hist-svg"
      onPointerLeave={(e) => e.pointerType === 'mouse' && setTip(null)}
      onClick={(e) => (e.target as Element).classList.contains('g-hit') || setTip(null)}
    >
      <defs>
        <pattern id="hist-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" className="g-hatch" />
        </pattern>
      </defs>
      {grid.map((p) => (
        <g key={p}>
          <line x1={L} x2={w - R} y1={y(p)} y2={y(p)} className="g-grid" />
          <text x={L - 6} y={y(p) + 4} className="g-ax" textAnchor="end">
            {p}p
          </text>
        </g>
      ))}
      {ticks.map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={h - B} y2={h - B + 4} className="g-axl" />
          <text x={x(t)} y={h - 8} className="g-ax" textAnchor="middle">
            {axisDate(t)}
          </text>
        </g>
      ))}
      <line x1={L} x2={w - R} y1={h - B} y2={h - B} className="g-axl" />
      {known > start && (
        <>
          <rect x={L} y={T} width={x(known) - L} height={h - T - B} fill="url(#hist-hatch)" />
          {x(known) - L > 90 && (
            <text x={(L + x(known)) / 2} y={T + (h - T - B) / 2 + 4} className="g-unk-t" textAnchor="middle">
              Not recorded
            </text>
          )}
        </>
      )}
      {avg && <path d={path(avg.steps, avg.from)} className="g-avg" />}
      <path d={path(mine, start)} className="g-me" />
      <text x={w - R + 8} y={ym} className="g-lab g-lab-me">
        {me.toFixed(1)}p
      </text>
      {av !== null && (
        <text x={w - R + 8} y={ya} className="g-lab">
          {av.toFixed(1)}p
        </text>
      )}
      {active && <line x1={x(active.t)} x2={x(active.t)} y1={T} y2={h - B} className="g-cross" />}
      {dots.map(({ s, i }) => (
        <g key={s.t}>
          {/* A wider invisible circle makes the dot easy to point at or tap. */}
          <circle cx={x(s.t)} cy={y(s.p)} r={14} className="g-hit" onPointerEnter={(e) => e.pointerType === 'mouse' && setTip(i)} onClick={() => setTip(i)} />
          <circle cx={x(s.t)} cy={y(s.p)} r={tip === i ? 6 : 4.5} className="g-dot" pointerEvents="none" />
        </g>
      ))}
      {active &&
        (() => {
          const prev = tip! > 0 ? mine[tip! - 1] : null;
          const tw = 200;
          const th = 50;
          const tx = x(active.t);
          const bx = Math.max(L, Math.min(tx - tw - 10 < L ? tx + 10 : tx - tw - 10, w - tw - 2));
          const by = Math.max(2, y(active.p) - th - 12);
          return (
            <g className="g-tip" pointerEvents="none">
              <rect x={bx} y={by} width={tw} height={th} rx={8} />
              <text x={bx + 10} y={by + 20} className="g-tip-b">
                {active.p.toFixed(1)}p{prev ? `, was ${prev.p.toFixed(1)}p` : ''}
              </text>
              <text x={bx + 10} y={by + 38}>
                set {dateWords(active.t, true).replace(/^(.*) on (.*)$/, '$2 at $1')}
              </text>
            </g>
          );
        })()}
    </svg>
  );
}

// "Price history" (PLAN idea 1; John, 31 October): the last 14 days of a station's price, against the average of the stations shown.
export function HistoryPanel({ row, rows, histories, collected, recordedFrom, onClose }: { row: Row; rows: Row[]; histories: Histories; collected: string; recordedFrom: string; onClose: () => void }) {
  const narrow = useIsNarrow(720);
  const [choices, setChoices] = useState(loadChoices);
  const [fuel, setFuel] = useState<Fuel>(() => (row.prices[choices.fuel] ? choices.fuel : row.prices.e10 ? 'e10' : 'diesel'));
  const { start, end } = windowFor(Date.parse(collected));
  const word = fuelWord(fuel);
  const mine = stationSteps(row, histories, fuel);
  const selling = rows.filter((r) => r.prices[fuel]);
  const avg = average(selling.map((r) => stationSteps(r, histories, fuel)), start, end);
  const avgLabel = selling.length === rows.length ? `Average of the ${WORDS[rows.length]} shown` : `Average of the ${WORDS[selling.length]} shown that sell ${word}`;
  const geo: Geo = narrow ? { w: 340, h: 230, left: 44, right: 48, top: 14, bottom: 26, xEvery: 4 } : { w: 980, h: 260, left: 44, right: 60, top: 14, bottom: 26, xEvery: 2 };
  const pick = (f: Fuel) => {
    setFuel(f);
    const c = { ...choices, fuel: f };
    setChoices(c);
    saveChoices(c);
  };
  const stillFilling = Date.parse(recordedFrom) > start;
  return (
    <div className="calc hist" role="region" aria-label="Price history">
      <div className="calc-head">
        <h4>Price history</h4>
        <button type="button" className="more-btn" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="calc-say">
        The last 14 days at {tidyName(row.station.name).replace(/ – .*/, '')}, against the {avgLabel.slice(0, 1).toLowerCase() + avgLabel.slice(1)}.
      </p>
      <div className="fuel-btns" role="group" aria-label="Fuel">
        {(['e10', 'diesel'] as const).map((f) => (
          <button key={f} type="button" className="fuel-btn" aria-pressed={fuel === f} onClick={() => pick(f)}>
            {f === 'e10' ? 'Unleaded' : 'Diesel'}
          </button>
        ))}
      </div>
      {mine.length === 0 ? (
        <p className="calc-say">This station doesn’t sell {word}.</p>
      ) : (
        <>
          <div className="hist-legend">
            <span>
              <i />
              This station
            </span>
            {avg && (
              <span>
                <i className="avg" />
                {avgLabel}
              </span>
            )}
          </div>
          <Chart mine={mine} avg={avg} start={start} end={end} geo={geo} label={`${word} at this station and the average, last 14 days`} />
          <p className="hist-say">{historySentence(word, mine, start)}</p>
          <p className="calc-small">
            {stillFilling && `Refueller began recording prices on ${dateWords(Date.parse(recordedFrom), false)}, so the record fills in over the next fortnight. `}
            Each price is drawn from the time the station set it.
            {avg && ` The average is of the ${WORDS[selling.length]} stations shown${selling.length < rows.length ? ` that sell ${word}` : ''}`}
            {avg && (avg.from > start ? `, and starts once all their prices are known (from ${dateWords(avg.from, true)}).` : '.')}
          </p>
        </>
      )}
    </div>
  );
}

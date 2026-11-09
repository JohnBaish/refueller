import { useTapAway } from '../lib/tapAway.ts';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { getPlaces } from './PlaceBox.tsx';
import type { Target } from './Results.tsx';
import {
  areaName, asChange, changeWords, defaultKeys, freeSlot, groupOf, KIND_WORD, kindOf, matchAreas, MAX_AREAS, periodsAvailable,
  pointsFor, readSaved, SAVED, scaleFor, shownPair, signedPence, swapIn, withSlots,
  type FuelChoice, type PeriodId, type Point, type Saved, type SeriesGroup, type Slot, type View,
} from '../lib/compare.ts';
import { axisDate, dateWords } from '../lib/history.ts';
import { localIndex, type Locality } from '../lib/levels.ts';
import { loadAverages, loadCouncils, loadIndex, loadSeriesGroup } from '../lib/load.ts';
import type { PageIndex } from '../lib/pageTypes.ts';
import { findPlace, placeLabel, suggest, type NamedPlace } from '../lib/places.ts';
import { useIsNarrow } from '../lib/responsive.ts';
import { nearestDistrict, postcodeArea } from '../lib/search.ts';
import { deliver, imageName, LIGHT, makeImage, type ImgLine, type KeyItem } from '../lib/shareImage.ts';
import type { AveragesPage } from '../lib/averages.ts';

// "Compare areas over time" (John, November 9th 2026; design/previews/compare/, option A, round 2): chips for up to four areas, each in
// its own colour (Great Britain always grey); Unleaded, Diesel or Both; with both, two areas at a time (the others faded, "tap to
// show"), unleaded solid and diesel dotted, showing the change since the start of the period by default, or the prices; 1 month, and
// longer periods once the record covers them; a table of the price now and the change; and "Share chart". The choice is kept on the
// device (refueller.compare). It starts from the visitor's own council area, county, region and Great Britain.

type Fuel = 0 | 1;
const FUEL_WORD = ['unleaded', 'diesel'];
const DAY = 86_400_000;
const colourVar = (key: string, slots: Record<string, Slot>) => (key === 'GB' ? 'var(--g-avg)' : `var(--k${slots[key] ?? 0})`);
const colourLight = (key: string, slots: Record<string, Slot>) => (key === 'GB' ? LIGHT.gb : LIGHT.k[slots[key] ?? 0]);
const owner = (name: string) => `${name}${/s$/.test(name) ? '’' : '’s'}`;
const listWords = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

type ChartLine = { id: string; label: string; colour: string; dotted: boolean; pts: Point[] };

function Swatch({ colour, dotted }: { colour: string; dotted?: boolean }) {
  return <i className={`cmp-sw${dotted ? ' dot' : ''}`} style={{ borderColor: colour }} aria-hidden="true" />;
}

function Chart({ lines, change, narrow }: { lines: ChartLine[]; change: boolean; narrow: boolean }) {
  const [tip, setTip] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  useTapAway(tip !== null, svgRef, setTip);
  const shown = lines.filter((l) => l.pts.length);
  if (!shown.length) return <p className="avg-none">No averages to show for these yet.</p>;
  const w = narrow ? 340 : 760;
  const h = narrow ? 240 : 300;
  const fmt = (p: number) => (change ? signedPence(p) : `${p.toFixed(1)}p`);
  const named = !narrow;
  const [L, R, T, B] = [46, named ? Math.min(230, 30 + Math.max(...shown.map((l) => (l.label.length + 6) * 7))) : 54, 12, 26];
  const all = shown.flatMap((l) => l.pts);
  const { lo, hi, step } = scaleFor(all.map((p) => p.p));
  const start = Math.min(...all.map((p) => p.t));
  const end = Math.max(...all.map((p) => p.t));
  const span = Math.max(end - start, 1);
  const x = (t: number) => L + ((t - start) / span) * (w - L - R);
  const y = (p: number) => T + ((hi - p) / (hi - lo)) * (h - T - B);
  const grid: number[] = [];
  for (let p = Math.ceil(lo / step) * step; p <= hi; p += step) grid.push(p);
  const lastDay = Date.parse(`${new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date(end))}T12:00:00Z`);
  const days = Math.max(1, Math.round((lastDay - start) / DAY) + 1);
  const every = Math.max(1, Math.ceil(days / (narrow ? 4 : 6)));
  const ticks: number[] = [];
  for (let d = 0; ; d += every) {
    const t = lastDay - d * DAY;
    if (t < start - DAY / 2) break;
    ticks.push(Math.max(start, Math.min(end, t)));
  }
  const ends = shown.map((l) => ({ l, v: l.pts[l.pts.length - 1].p, y: y(l.pts[l.pts.length - 1].p) + 4 })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14;
  const times = [...new Set(all.map((p) => p.t))].sort((a, b) => a - b);
  const near = (px: number) => times.reduce((best, t, i) => (Math.abs(x(t) - px) < Math.abs(x(times[best]) - px) ? i : best), 0);
  const pick = (e: PointerEvent<SVGRectElement>) => {
    const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    setTip(near(((e.clientX - r.left) / r.width) * w));
  };
  const at = tip === null ? null : times[tip];
  const tipRows = at === null ? [] : shown.map((l) => ({ l, p: l.pts.find((p) => p.t === at) })).filter((r) => r.p);
  const tipW = narrow ? 210 : 240;
  const tipX = at === null ? 0 : Math.min(Math.max(x(at) - tipW / 2, 0), w - tipW);
  return (
    <svg ref={svgRef} viewBox={`0 0 ${w} ${h}`} width="100%" className="avg-svg cmp-svg" style={{ '--ar': w / h } as CSSProperties} role="img" aria-label="Average prices over time">
      {grid.map((p) => (
        <g key={p}>
          <line className={`g-grid${change && p === 0 ? ' cmp-zero' : ''}`} x1={L} x2={w - R} y1={y(p)} y2={y(p)} />
          <text className="g-ax" x={L - 6} y={y(p) + 4} textAnchor="end">
            {change ? (p === 0 ? '0p' : `${p < 0 ? '−' : '+'}${Math.abs(p)}p`) : `${p}p`}
          </text>
        </g>
      ))}
      {ticks.map((t) => (
        <text key={t} className="g-ax" x={x(t)} y={h - 6} textAnchor="middle">
          {axisDate(t)}
        </text>
      ))}
      {shown.map((l) => (
        <g key={l.id}>
          {l.pts.length > 1 && <polyline className={`cmp-line${l.dotted ? ' dot' : ''}`} style={{ stroke: l.colour }} points={l.pts.map((p) => `${x(p.t)},${y(p.p)}`).join(' ')} />}
          <circle className="cmp-end" style={{ fill: l.colour }} cx={x(l.pts[l.pts.length - 1].t)} cy={y(l.pts[l.pts.length - 1].p)} r={4} />
        </g>
      ))}
      {ends.map((e) => (
        <text key={e.l.id} className="g-lab" x={w - R + 8} y={e.y}>
          {named ? `${e.l.label} ` : ''}
          <tspan fontWeight={700}>{fmt(e.v)}</tspan>
        </text>
      ))}
      {at !== null && <line className="g-cross" x1={x(at)} x2={x(at)} y1={T} y2={h - B} />}
      <rect className="g-hit" x={L} y={T} width={w - L - R} height={h - T - B} onPointerMove={pick} onPointerDown={pick} onPointerLeave={(e) => e.pointerType === 'mouse' && setTip(null)} />
      {at !== null && (
        <g className="g-tip" pointerEvents="none">
          <rect x={tipX} y={T + 2} width={tipW} height={22 + tipRows.length * 17} rx={8} />
          <text className="g-tip-b" x={tipX + 10} y={T + 19}>
            {dateWords(at, true)}
          </text>
          {tipRows.map((r, i) => (
            <text key={r.l.id} x={tipX + 10} y={T + 37 + i * 17}>
              {r.l.label}: {fmt(r.p!.p)}
            </text>
          ))}
        </g>
      )}
    </svg>
  );
}

// A suggestion in the add box: an area itself, or a town with the council area whose average would be shown.
type Suggestion = { kind: 'area'; key: string } | { kind: 'town'; place: NamedPlace; council: string | null };

async function councilOf(index: PageIndex, page: AveragesPage, lat: number, lon: number, postcode?: string): Promise<Locality | null> {
  if (!index.averages) return null;
  const district = postcode ?? nearestDistrict(lat, lon, index.outcodes);
  const lookup = await loadCouncils(index.averages.councils, postcodeArea(district));
  const i = localIndex(lookup, district);
  return i === null ? null : (page.locals[i] ?? null);
}

// The visitor's own council area etc., from the postcode or place they last chose.
async function localityFrom(index: PageIndex, page: AveragesPage, back: Target | null): Promise<Locality | null> {
  if (!back || !index.averages) return null;
  if (back.kind === 'postcode') return councilOf(index, page, 0, 0, back.inward ? `${back.outcode} ${back.inward}` : back.outcode);
  if (back.kind === 'place') {
    const ix = await getPlaces();
    const f = ix ? findPlace(ix, back.place, back.at) : null;
    return f?.ok ? councilOf(index, page, f.place.lat, f.place.lon) : null;
  }
  return null;
}

function save(s: Saved) {
  try {
    localStorage.setItem(SAVED, JSON.stringify(s));
  } catch {
    // Not kept; the page still works.
  }
}
function savedRaw(): string | null {
  try {
    return localStorage.getItem(SAVED);
  } catch {
    return null;
  }
}

export function ComparePage({ back }: { back: Target | null }) {
  const narrow = useIsNarrow(720);
  const [base, setBase] = useState<{ index: PageIndex; page: AveragesPage } | null>(null);
  const [failed, setFailed] = useState(false);
  const [state, setState] = useState<Saved | null>(null);
  const [groups, setGroups] = useState<Record<string, SeriesGroup>>({});
  const [typed, setTyped] = useState('');
  const [adding, setAdding] = useState(false);
  const [sugg, setSugg] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(-1);
  const [note, setNote] = useState('');
  const [status, setStatus] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // The index, the averages page (for the list of areas and the council areas), then the starting choice.
  useEffect(() => {
    let live = true;
    (async () => {
      const index = await loadIndex();
      if (!index.averages) throw new Error('No averages');
      const page = await loadAverages(index.averages.file);
      const has = (k: string) => !!page.latest[1][k] && page.latest[1][k].some((v) => v !== null);
      let s = readSaved(savedRaw(), has);
      if (!s) {
        const local = await localityFrom(index, page, back).catch(() => null);
        const keys = defaultKeys(local, has);
        s = { keys, slots: withSlots(keys, {}), fuel: 'e10', view: 'change', period: '1m', pair: null };
      }
      if (!live) return;
      setBase({ index, page });
      setState(s);
    })().catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
    // The starting choice is worked out once, when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The record files for the chosen areas' groups.
  const needed = useMemo(() => (base && state ? [...new Set(state.keys.map((k) => groupOf(k, base.page.locals)))] : []), [base, state]);
  useEffect(() => {
    if (!base?.index.averages) return;
    let live = true;
    for (const g of needed) {
      if (groups[g]) continue;
      loadSeriesGroup(base.index.averages.series, g).then(
        (f) => live && setGroups((gs) => ({ ...gs, [g]: f })),
        () => live && setFailed(true),
      );
    }
    return () => {
      live = false;
    };
  }, [base, needed, groups]);

  // Suggestions as the visitor types: areas by name first, then towns, villages and suburbs with their council area.
  useEffect(() => {
    if (!base || !state) return;
    let live = true;
    const t = typed.trim();
    const allKeys = Object.keys(base.page.latest[1]).filter((k) => base.page.latest[1][k].some((v) => v !== null));
    const areas: Suggestion[] = matchAreas(allKeys.filter((k) => !state.keys.includes(k)), t).map((key) => ({ kind: 'area', key }));
    setSugg(areas);
    if (t.length >= 3) {
      getPlaces()
        .then(async (ix) => {
          if (!ix || !live) return;
          const names = new Set(areas.map((a) => (a.kind === 'area' ? areaName(a.key).toLowerCase() : '')));
          const towns = suggest(ix, t, 6).filter((p) => !names.has(p.name.toLowerCase())).slice(0, 8 - Math.min(areas.length, 4));
          const withCouncil = await Promise.all(
            towns.map(async (p): Promise<Suggestion> => ({ kind: 'town', place: p, council: (await councilOf(base.index, base.page, p.lat, p.lon).catch(() => null))?.[0] ?? null })),
          );
          if (live) setSugg([...areas.slice(0, 4), ...withCouncil]);
        })
        .catch(() => {});
    }
    return () => {
      live = false;
    };
  }, [typed, base, state]);

  if (failed) return <p className="message">Sorry, the averages couldn’t be loaded. Check your connection and try again.</p>;
  if (!base || !state) return <p className="loading">Loading the averages…</p>;

  const update = (s: Partial<Saved>) => {
    const next = { ...state, ...s };
    setState(next);
    save(next);
  };
  const has = (k: string) => !!base.page.latest[1][k] && base.page.latest[1][k].some((v) => v !== null);
  const addKey = (key: string, why = '') => {
    if (state.keys.includes(key)) {
      setNote(why ? `${why}, which is already in the chart.` : `${areaName(key)} is already in the chart.`);
    } else if (state.keys.length >= MAX_AREAS) {
      setNote('That’s four, the most a chart can show clearly. Remove one to add another.');
    } else {
      const keys = [...state.keys, key];
      const slots = key === 'GB' ? state.slots : { ...state.slots, [key]: freeSlot(state.slots, state.keys) };
      update({ keys, slots });
      setNote(why ? `${why}, so that’s the average shown.` : '');
    }
    setTyped('');
    setAdding(false);
    setActive(-1);
  };
  const choose = (s: Suggestion) => {
    if (s.kind === 'area') return addKey(s.key);
    const town = placeLabel(s.place);
    if (!s.council) return setNote(`We couldn’t find which council area ${town} is in.`);
    const key = `C:${s.council}`;
    const local = base.page.locals.find((l) => l[0] === s.council);
    if (!has(key)) {
      const county = local?.[1];
      setNote(`There aren’t enough stations in ${owner(s.council)} council area for an average.${county && has(`K:${county}`) ? ` Try its county, ${county}.` : ''}`);
      return;
    }
    addKey(key, s.council === s.place.name ? '' : `${s.place.name} is in ${owner(s.council)} council area`);
  };
  const remove = (key: string) => {
    const keys = state.keys.filter((k) => k !== key);
    const slots = { ...state.slots };
    delete slots[key];
    update({ keys, slots, pair: state.pair?.includes(key) ? null : state.pair });
    setNote('');
  };

  // The lines, once the record files are in.
  const both = state.fuel === 'both';
  const view: View = both ? state.view : 'price';
  const shown = both ? shownPair(state.keys, state.pair) : state.keys;
  const fuels: Fuel[] = state.fuel === 'both' ? [0, 1] : [state.fuel === 'diesel' ? 1 : 0];
  const ready = needed.every((g) => groups[g]);
  const anyGroup = Object.values(groups)[0];
  const firstMs = anyGroup ? Date.parse(anyGroup.times[0]) : 0;
  const lastMs = anyGroup ? Date.parse(anyGroup.times[anyGroup.times.length - 1]) : 0;
  const periods = periodsAvailable(firstMs, lastMs);
  const period = periods.find((p) => p.id === state.period) ?? periods[0];
  const lines = ready
    ? shown.flatMap((key) => {
        const g = groups[groupOf(key, base.page.locals)];
        const series = g?.areas[key];
        return fuels.map((f) => {
          const raw = series ? pointsFor(g.times, series, f, period.days, lastMs) : [];
          return { key, f, raw, label: both ? `${areaName(key)} ${FUEL_WORD[f]}` : areaName(key) };
        });
      })
    : [];
  const chartLines: ChartLine[] = lines.map((l) => ({
    id: `${l.key}|${l.f}`,
    label: l.label,
    colour: colourVar(l.key, state.slots),
    dotted: both && l.f === 1,
    pts: view === 'change' ? asChange(l.raw) : l.raw,
  }));
  const from = lines.length ? Math.min(...lines.filter((l) => l.raw.length).map((l) => l.raw[0].t)) : lastMs;
  const recordDays = Math.round((lastMs - firstMs) / DAY) + 1;

  const share = async () => {
    const imgLines: ImgLine[] = lines.map((l) => ({ label: l.label, colour: colourLight(l.key, state.slots), style: both && l.f === 1 ? 'dotted' : 'solid', pts: view === 'change' ? asChange(l.raw) : l.raw }));
    const key: KeyItem[] | undefined = both
      ? [...shown.map((k): KeyItem => ({ label: areaName(k), colour: colourLight(k, state.slots), style: 'solid' })), { label: 'Unleaded', colour: '#201e1d', style: 'solid' }, { label: 'Diesel', colour: '#201e1d', style: 'dotted' }]
      : undefined;
    const fuelWords = both ? 'Unleaded and diesel' : FUEL_WORD[fuels[0]][0].toUpperCase() + FUEL_WORD[fuels[0]].slice(1);
    const sub = `${listWords(shown.map(areaName))}, ${dateWords(from, false)} to ${dateWords(lastMs, false)}${view === 'change' ? `, change since ${dateWords(from, false)}` : ''}`;
    const canvas = makeImage({ heading: `${fuelWords}: average prices`, sub, key, panels: [{ lines: imgLines, change: view === 'change' }], named: true });
    const r = await deliver(canvas, imageName(lastMs), 'Average fuel prices');
    setStatus(r === 'copied' ? 'Copied: paste it into a message or document.' : r === 'saved' ? 'Saved as a picture.' : '');
  };

  return (
    <div className="cmp">
      <div className="cmp-box">
        <p className="cmp-h">Comparing</p>
        <div className="cmp-chips">
          {state.keys.map((k) => {
            const off = both && !shown.includes(k);
            return (
              <span className={`cmp-chip${off ? ' off' : ''}`} key={k}>
                {off ? (
                  <button type="button" className="cmp-chip-main" onClick={() => update({ pair: swapIn(shown, k) })} aria-label={`Show ${areaName(k)}`}>
                    <Swatch colour={colourVar(k, state.slots)} />
                    {areaName(k)} <small>tap to show</small>
                  </button>
                ) : (
                  <span className="cmp-chip-main">
                    <Swatch colour={colourVar(k, state.slots)} />
                    {areaName(k)} <small>{KIND_WORD[kindOf(k)]}</small>
                  </span>
                )}
                <button type="button" className="cmp-x" onClick={() => remove(k)} aria-label={`Remove ${areaName(k)}`}>
                  ✕
                </button>
              </span>
            );
          })}
          {state.keys.length < MAX_AREAS && !adding && (
            <button
              type="button"
              className="cmp-add"
              onClick={() => {
                setAdding(true);
                setNote('');
                setTimeout(() => inputRef.current?.focus(), 0);
              }}
            >
              + Add an area
            </button>
          )}
        </div>
        {adding && (
          <div className="cmp-addbox jf">
            <input
              ref={inputRef}
              id="cmp-add"
              className="input"
              value={typed}
              placeholder="A town, county, region or country"
              aria-label="Add an area"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={sugg.length > 0}
              aria-controls="cmp-add-list"
              aria-activedescendant={active >= 0 ? `cmp-add-${active}` : undefined}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              maxLength={60}
              enterKeyHint="go"
              onChange={(e) => {
                setTyped(e.target.value);
                setActive(-1);
              }}
              onBlur={() => !typed && setAdding(false)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActive((a) => (e.key === 'ArrowDown' ? Math.min(sugg.length - 1, a + 1) : Math.max(-1, a - 1)));
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  if (sugg[Math.max(0, active)]) choose(sugg[Math.max(0, active)]);
                } else if (e.key === 'Escape') {
                  setTyped('');
                  setAdding(false);
                }
              }}
            />
            {sugg.length > 0 && (
              <ul className="suggest" id="cmp-add-list" role="listbox">
                {sugg.map((s, i) => (
                  <li
                    key={s.kind === 'area' ? s.key : `${placeLabel(s.place)}|${s.place.lat}`}
                    id={`cmp-add-${i}`}
                    role="option"
                    aria-selected={i === active}
                    className={i === active ? 'on' : undefined}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(s)}
                  >
                    <span className="sg-name">{s.kind === 'area' ? areaName(s.key) : placeLabel(s.place)}</span>
                    <span className="sg-area">{s.kind === 'area' ? KIND_WORD[kindOf(s.key)] : s.council ? `in ${s.council} council area` : ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {note && <p className="cmp-note">{note}</p>}
        {both && state.keys.length > 2 ? (
          <p className="cmp-note">
            <b>Both fuels show two areas at a time.</b> Tap a faded one to show it instead.
          </p>
        ) : state.keys.length >= MAX_AREAS ? (
          <p className="cmp-note">That’s four, the most a chart can show clearly. Remove one to add another.</p>
        ) : (
          state.keys.length > 0 && <p className="cmp-note">You can add {['', 'three more', 'two more', 'one more'][state.keys.length]}.</p>
        )}
      </div>

      {state.keys.length === 0 ? (
        <p className="cmp-empty">Add an area to see its average prices.</p>
      ) : (
        <>
          <div className="cmp-controls">
            <span className="fuel-btns cmp-group" role="group" aria-label="Fuel">
              {(['e10', 'diesel', 'both'] as FuelChoice[]).map((f) => (
                <button key={f} type="button" className="fuel-btn" aria-pressed={state.fuel === f} onClick={() => update({ fuel: f })}>
                  {f === 'e10' ? 'Unleaded' : f === 'diesel' ? 'Diesel' : 'Both'}
                </button>
              ))}
            </span>
            {both && (
              <span className="cmp-pills" role="group" aria-label="Show">
                {(['change', 'price'] as View[]).map((v) => (
                  <button key={v} type="button" aria-pressed={state.view === v} onClick={() => update({ view: v })}>
                    {v === 'change' ? 'Change' : 'Prices'}
                  </button>
                ))}
              </span>
            )}
            <span className="cmp-pills" role="group" aria-label="Period">
              {periods.map((p) => (
                <button key={p.id} type="button" aria-pressed={p.id === period.id} onClick={() => update({ period: p.id as PeriodId })}>
                  {p.label}
                </button>
              ))}
            </span>
            <button type="button" className="cmp-share" onClick={share} disabled={!ready}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 15V3" />
                <path d="m7 8 5-5 5 5" />
                <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
              </svg>
              Share chart
            </button>
          </div>
          {status && (
            <p className="cmp-note" role="status">
              {status}
            </p>
          )}
          {anyGroup && (
            <p className="cmp-note">
              {recordDays < 30
                ? `Refueller began recording on ${dateWords(firstMs, false)}, so for now the chart shows the ${recordDays} days since then. Longer periods appear here as the record grows.`
                : periods.length < 4
                  ? 'Longer periods appear here as the record grows.'
                  : ''}
            </p>
          )}
          {both && view === 'change' && <p className="cmp-note">How much each price has moved since {dateWords(from, false)}. The table gives the prices themselves.</p>}
          {both && (
            <div className="cmp-key">
              {shown.map((k) => (
                <span key={k}>
                  <Swatch colour={colourVar(k, state.slots)} />
                  {areaName(k)}
                </span>
              ))}
              <span className="cmp-key-sep" aria-hidden="true" />
              <span>
                <Swatch colour="var(--color-text)" />
                Unleaded
              </span>
              <span>
                <Swatch colour="var(--color-text)" dotted />
                Diesel
              </span>
            </div>
          )}
          {!ready ? (
            <p className="loading">Loading the averages…</p>
          ) : (
            <>
              <div className="hist cmp-chart">
                <Chart lines={chartLines} change={view === 'change'} narrow={narrow} />
              </div>
              <div className="cmp-table">
                <div className="cmp-row cmp-head">
                  <span>{both ? 'Area and fuel' : 'Area'}</span>
                  <span className="cmp-p">Now</span>
                  <span className="cmp-c">Change since {dateWords(from, false)}</span>
                </div>
                {lines.map((l) => (
                  <div className="cmp-row" key={`${l.key}|${l.f}`}>
                    <span className="cmp-n">
                      <Swatch colour={colourVar(l.key, state.slots)} dotted={both && l.f === 1} />
                      {l.label}
                    </span>
                    <span className="cmp-p">{l.raw.length ? `${l.raw[l.raw.length - 1].p.toFixed(1)}p` : '–'}</span>
                    <span className="cmp-c">{l.raw.length ? changeWords(l.raw) : 'no average'}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

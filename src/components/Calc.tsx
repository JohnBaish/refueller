import { useEffect, useState } from 'react';
import { cheaperFuels, fuelWord, loadChoices, milesBox, nearestSelling, readNumber, saveChoices, TYPICAL_MPG, verdict } from '../lib/calc.ts';
import { loadRoads } from '../lib/load.ts';
import { tidyName, type Row } from '../lib/search.ts';

// Where the list is measured from, for the road miles: a postcode district ("RG4", in area RG) or a station's own code.
export type Origin = { area: string; key: string };

type Roads = { state: 'loading' } | { state: 'ready'; miles: (id: string) => number | undefined };

// "Worth driving here?" (PLAN Stage 7): a panel under one station, comparing it with the nearest open station selling the
// same fuel. Everything is worked out here, in the browser; the road miles come from a small file for the area the list is
// measured from, the same file for every visitor.
export function CalcPanel({ row, rows, origin, centreId, roads, onClose }: { row: Row; rows: Row[]; origin: Origin; centreId?: string; roads: { folder: string } | null; onClose: () => void }) {
  const [choices, setChoices] = useState(loadChoices);
  // Opens on the fuel used last time if this station is cheaper for it, otherwise on the fuel it is cheaper for. Only
  // pressing a fuel button changes the remembered one.
  const [fuel, setFuel] = useState(() => {
    const cheaper = cheaperFuels(row, rows);
    return cheaper.includes(choices.fuel) || cheaper.length === 0 ? choices.fuel : cheaper[0];
  });
  const [road, setRoad] = useState<Roads>({ state: 'loading' });
  const [miles, setMiles] = useState<{ text: string; typed: boolean } | null>(null);

  useEffect(() => {
    let live = true;
    const ready = (file: Record<string, Record<string, number>>) =>
      live && setRoad({ state: 'ready', miles: (id) => (id === centreId ? 0 : file[origin.key]?.[id] === undefined ? undefined : file[origin.key][id] / 10) });
    if (!roads) ready({});
    else loadRoads(roads.folder, origin.area).then(ready, () => ready({}));
    return () => {
      live = false;
    };
  }, [roads?.folder, origin.area, origin.key, centreId]);

  const update = (c: typeof choices) => {
    setChoices(c);
    saveChoices(c);
  };

  const here = row.prices[fuel];
  const near = nearestSelling(rows, fuel);
  const extra = (() => {
    if (road.state !== 'ready' || !near) return undefined;
    const a = road.miles(row.station.id);
    const b = road.miles(near.station.id);
    return a === undefined || b === undefined ? undefined : Math.max(0, 2 * (a - b));
  })();

  // The extra miles box starts at the road figure, again whenever the fuel (and so the station compared with) changes.
  useEffect(() => {
    setMiles(extra === undefined ? (road.state === 'ready' ? { text: '', typed: false } : null) : { text: milesBox(extra), typed: false });
  }, [fuel, road.state, extra]);

  const word = fuelWord(fuel);
  let message: string | null = null;
  if (!here) message = `This station doesn’t sell ${word}.`;
  else if (here.x) message = `This station’s ${word} price looks unusual, so it isn’t compared.`;
  else if (!near) message = `None of the open stations in the list sells ${word}, so there’s nothing to compare with.`;
  else if (near.station.id === row.station.id) message = `This is the nearest open station selling ${word}, so there’s nothing to compare it with.`;
  else if (here.p >= near.prices[fuel]!.p)
    message = `${word === 'unleaded' ? 'Unleaded' : 'Diesel'} here ${here.p === near.prices[fuel]!.p ? 'costs the same as' : 'costs more than'} at ${tidyName(near.station.name)}, the nearest open station selling it (${near.prices[fuel]!.p.toFixed(1)}p a litre), so it isn’t worth driving further for.`;

  const mpgText = choices.mpg[fuel] ?? String(TYPICAL_MPG[fuel]);
  const mpgTyped = choices.mpg[fuel] !== undefined;
  const spend = readNumber(choices.spend);
  const mpg = readNumber(mpgText);
  const extraMiles = miles ? readNumber(miles.text, true) : null;
  const result = !message && here && near && spend !== null && mpg !== null && extraMiles !== null ? verdict(spend, mpg, extraMiles, near.prices[fuel]!.p, here.p) : null;

  return (
    <div className="calc" role="region" aria-label="Worth driving here?">
      <div className="calc-head">
        <h4>Worth driving here?</h4>
        <button type="button" className="more-btn" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="calc-say">
        {message ?? (
          <>
            Compared with {tidyName(near!.station.name)}, the nearest open station selling {word} ({near!.prices[fuel]!.p.toFixed(1)}p a litre).
            {row.open.open === false && ' This station is closed now.'}
          </>
        )}
      </p>
      <div className="fuel-btns" role="group" aria-label="Fuel">
        {(['e10', 'diesel'] as const).map((f) => (
          <button key={f} type="button" className="fuel-btn" aria-pressed={fuel === f} onClick={() => {
              setFuel(f);
              update({ ...choices, fuel: f });
            }}>
            {f === 'e10' ? 'Unleaded' : 'Diesel'}
          </button>
        ))}
      </div>
      {!message && (
        <>
          <div className="calc-fields">
            <label className="calc-field">
              <span className="calc-lbl">I’ll spend</span>
              <span className="calc-box">
                £
                <input className="input mono" inputMode="decimal" value={choices.spend} onChange={(e) => update({ ...choices, spend: e.target.value })} />
              </span>
            </label>
            <label className="calc-field">
              <span className="calc-lbl">My car does</span>
              <span className="calc-box">
                <input
                  className="input mono"
                  inputMode="decimal"
                  value={mpgText}
                  onChange={(e) => update({ ...choices, mpg: { ...choices.mpg, [fuel]: e.target.value } })}
                />
                mpg
              </span>
              <span className="calc-hint">{mpgTyped ? 'your figure' : `a typical figure for ${fuel === 'e10' ? 'petrol' : 'diesel'}; change it to your car’s`}</span>
            </label>
            <label className="calc-field">
              <span className="calc-lbl">Extra miles, there and back</span>
              <span className="calc-box">
                about
                <input className="input mono" inputMode="decimal" value={miles?.text ?? ''} disabled={!miles} onChange={(e) => setMiles({ text: e.target.value, typed: true })} />
                miles
              </span>
              <span className="calc-hint">
                {!miles
                  ? 'working out the road miles…'
                  : miles.typed
                    ? 'your figure'
                    : extra === undefined
                      ? 'we don’t have a road figure for this one; type the extra miles there and back'
                      : 'by road; change it if your sat nav says otherwise'}
              </span>
            </label>
          </div>
          {result ? (
            <>
              <p className="calc-verdict">
                <strong>{result.kind === 'worth' ? 'Worth it' : result.kind === 'not' ? 'Not worth it' : 'About even'}:</strong> {result.text}
              </p>
              <p className="calc-small">
                {result.breakEven !== null && `It’s worth the trip if this station is at least ${result.breakEven.toFixed(1)}p a litre cheaper. `}
                This doesn’t count your time or wear on the car.
              </p>
            </>
          ) : (
            <p className="calc-small">Type how much you’ll spend, your car’s miles per gallon and the extra miles to see whether it’s worth it.</p>
          )}
        </>
      )}
    </div>
  );
}

// Mock-ups (1 November 2026) of an "Average prices" chart under RG4's list: Great Britain and the RG postcode area, unleaded and
// diesel, from the real collections of October 30th to November 1st (series.json, worked out from the git history of
// data/prices.json; prices marked unusual left out). Drawn into the built page in the browser only; no app code.
// Option A: one chart, four lines. Option B: two charts (unleaded, diesel), each its own scale. Option C: B with medians.
const { chromium } = require('playwright');
const fs = require('fs');
const series = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const OUT = '/home/user/refueller/design/previews/';
const URL0 = `http://localhost:${process.argv[2]}/#RG4`;

function inject(opts) {
  const { series, option, stat } = opts;
  const t0 = Date.parse('2026-10-30T00:00:00Z'), t1 = Date.parse('2026-11-01T24:00:00Z');
  const pts = (k) => series.map((r) => [Date.parse(r.at), r[k][stat]]);
  const css = `
  .avg-sec { margin-top: var(--space-8); padding-top: var(--space-4); border-top: 1px solid var(--color-divider); }
  .avg-sec h3 { font-size: 20px; margin: 0 0 var(--space-2); }
  .avg-sec p { font-size: 14px; margin: 0 0 8px; }
  .avg-sec .opt { font: 600 12px Figtree, sans-serif; letter-spacing: .06em; text-transform: uppercase; color: var(--color-accent-700, #a2471a); margin-bottom: 6px; }
  .avg-charts { display: grid; grid-template-columns: ${option === 'A' ? '1fr' : '1fr 1fr'}; gap: 18px 28px; }
  @media (max-width: 720px) { .avg-charts { grid-template-columns: 1fr; } }
  .avg-ch h4 { font-size: 15px; margin: 4px 0 2px; font-family: Figtree, sans-serif; font-weight: 700; }
  .avg-ch svg { display: block; width: 100%; overflow: visible; }
  .avg-ch .grid { stroke: var(--color-divider); }
  .avg-ch .ax { font: 11px Figtree, sans-serif; fill: var(--color-neutral-700); }
  .avg-ch .lab { font: 600 12px Figtree, sans-serif; fill: var(--color-text); }
  .leg { display: flex; flex-wrap: wrap; gap: 6px 18px; font-size: 12.5px; color: var(--color-neutral-700); margin: 2px 0 6px; }
  .leg span { display: inline-flex; align-items: center; gap: 6px; }
  .leg i { display: inline-block; width: 22px; height: 0; border-top-width: 2.5px; border-top-style: solid; }
  :root { --c-e10: #c05a14; --c-dsl: #2a64a8; }
  :root[data-theme="dark"] { --c-e10: #cf7a3f; --c-dsl: #5f97dc; }`;
  const W = 560, H = option === 'A' ? 260 : 200, L = 44, R = 70, T = 10, B = 26;
  const xs = (t) => L + ((t - t0) / (t1 - t0)) * (W - L - R);
  function chart(lines, lo, hi, step) {
    const ys = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
    let g = '';
    for (let v = lo; v <= hi + 1e-9; v += step) g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${ys(v)}" y2="${ys(v)}"/><text class="ax" x="${L - 6}" y="${ys(v) + 4}" text-anchor="end">${v.toFixed(0)}p</text>`;
    ['2026-10-30', '2026-10-31', '2026-11-01'].forEach((d, i) => {
      const t = Date.parse(d + 'T12:00:00Z');
      g += `<text class="ax" x="${xs(t)}" y="${H - 6}" text-anchor="middle">${['Oct 30th', 'Oct 31st', 'Nov 1st'][i]}</text>`;
    });
    for (const l of lines) {
      const p = pts(l.key);
      g += `<polyline fill="none" stroke="${l.color}" stroke-width="${l.dash ? 2 : 2.5}" ${l.dash ? 'stroke-dasharray="5 4"' : ''} stroke-linejoin="round" points="${p.map(([t, v]) => `${xs(t)},${ys(v)}`).join(' ')}"/>`;
      if (!l.dash) g += p.map(([t, v]) => `<circle cx="${xs(t)}" cy="${ys(v)}" r="3.5" fill="${l.color}" stroke="var(--color-bg)" stroke-width="2"/>`).join('');
      const [lt, lv] = p[p.length - 1];
      g += `<text class="lab" x="${xs(lt) + 8}" y="${ys(lv) + 4 + (l.nudge || 0)}">${lv.toFixed(1)}p</text>`;
    }
    return `<svg viewBox="0 0 ${W} ${H}" role="img">${g}</svg>`;
  }
  const leg = (items) => `<div class="leg">${items.map((i) => `<span><i style="border-top-color:${i.color};${i.dash ? 'border-top-style:dashed;border-top-width:2px' : ''}"></i>${i.name}</span>`).join('')}</div>`;
  const statWord = stat === 'mean' ? 'Average' : 'Middle';
  let body;
  if (option === 'A') {
    const lines = [
      { key: 'RG-diesel', color: 'var(--c-dsl)', nudge: -2 }, { key: 'GB-diesel', color: 'var(--c-dsl)', dash: 1, nudge: 6 },
      { key: 'RG-e10', color: 'var(--c-e10)', nudge: -4 }, { key: 'GB-e10', color: 'var(--c-e10)', dash: 1, nudge: 6 },
    ];
    body = leg([{ color: 'var(--c-e10)', name: 'Unleaded, RG (Reading)' }, { color: 'var(--c-e10)', dash: 1, name: 'Unleaded, Great Britain' }, { color: 'var(--c-dsl)', name: 'Diesel, RG (Reading)' }, { color: 'var(--c-dsl)', dash: 1, name: 'Diesel, Great Britain' }]) +
      `<div class="avg-charts"><div class="avg-ch">${chart(lines, 165, 205, 5)}</div></div>`;
  } else {
    const range = (keys) => { const v = keys.flatMap((k) => series.map((r) => r[k][stat])); return [Math.floor(Math.min(...v) - 1), Math.ceil(Math.max(...v) + 1)]; };
    const [a, b] = range(['RG-e10', 'GB-e10']); const [c, d] = range(['RG-diesel', 'GB-diesel']);
    body = leg([{ color: 'var(--g-me)', name: 'RG (Reading)' }, { color: 'var(--g-avg)', dash: 1, name: 'Great Britain' }]) +
      `<div class="avg-charts"><div class="avg-ch"><h4>Unleaded</h4>${chart([{ key: 'RG-e10', color: 'var(--g-me)' }, { key: 'GB-e10', color: 'var(--g-avg)', dash: 1, nudge: 4 }], a, b, 1)}</div>` +
      `<div class="avg-ch"><h4>Diesel</h4>${chart([{ key: 'RG-diesel', color: 'var(--g-me)', nudge: -3 }, { key: 'GB-diesel', color: 'var(--g-avg)', dash: 1, nudge: 6 }], c, d, 1)}</div></div>`;
  }
  const sec = document.createElement('section');
  sec.className = 'avg-sec';
  sec.innerHTML = `<style>${css}</style><div class="opt">Mock-up, option ${option}${stat === 'median' ? ' (middle prices)' : ''}</div>
    <h3>${statWord} prices</h3>
    <p>${stat === 'mean' ? 'The average' : 'The middle'} price of unleaded and diesel at each of Refueller’s collections, across Great Britain and in RG postcodes (Reading), since recording began on October 30th. Unusual prices are left out.</p>${body}`;
  const before = document.querySelector('.journey-front');
  before.parentNode.insertBefore(sec, before);
}

(async () => {
  const b = await chromium.launch();
  for (const [dev, o] of [['computer', { viewport: { width: 1200, height: 900 } }], ['phone', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }]]) {
    for (const scheme of ['light', 'dark']) {
      for (const [option, stat] of [['A', 'mean'], ['B', 'mean'], ['C', 'median']]) {
        if (scheme === 'dark' && option !== 'B') continue;
        const p = await (await b.newContext({ ...o, colorScheme: scheme })).newPage();
        await p.goto(URL0); await p.reload(); await p.waitForSelector('.journey-front');
        await p.evaluate(inject, { series, option: option === 'C' ? 'B' : option, stat });
        if (option === 'C') await p.evaluate(() => { document.querySelector('.avg-sec .opt').textContent = 'Mock-up, option C (B with middle prices, the median)'; });
        const el = p.locator('.avg-sec');
        await el.screenshot({ path: OUT + `averages-${option}-${dev}-${scheme}.png` });
        console.log(dev, scheme, option, 'overflow', await p.evaluate(() => document.documentElement.scrollWidth - innerWidth));
        await p.context().close();
      }
    }
  }
  await b.close();
})();

const { chromium } = require('playwright');
const fs = require('fs');
const D = '/tmp/claude-0/-home-user/d7a6fee5-4206-5672-972f-81c453fe6f20/scratchpad/graph/';
const OUT = '/home/user/refueller/design/previews/';
const rows = JSON.parse(fs.readFileSync(D + 'rg4-hist.json', 'utf8'));
const END = Date.parse('2026-10-30T16:15:00Z'); // the latest collection
const START = END - 14 * 864e5;

// A station's known steps for a fuel, clipped to the window: [{t, p}] from the first price's set time.
function steps(row, fuel) {
  const h = row.hist[fuel].map((x) => ({ t: Date.parse(x.u), p: x.p })).sort((a, b) => a.t - b.t);
  return h;
}
function priceAt(st, t) { let p = null; for (const s of st) if (s.t <= t) p = s.p; return p; }

function chart(row, fuel, w, h, opts) {
  const mine = steps(row, fuel);
  const all = rows.map((r) => steps(r, fuel));
  const avgFrom = Math.max(...all.map((s) => s[0].t));
  const times = [...new Set(all.flat().map((s) => s.t).filter((t) => t >= avgFrom).concat([avgFrom, END]))].sort((a, b) => a - b);
  const avg = times.map((t) => ({ t, p: all.reduce((a, s) => a + priceAt(s, t), 0) / all.length }));
  const ps = [...mine.map((s) => s.p), ...avg.map((a) => a.p)];
  const lo = Math.floor(Math.min(...ps) - 0.6), hi = Math.ceil(Math.max(...ps) + 0.6);
  const L = 44, R = opts.right, T = 14, B = 26;
  const x = (t) => L + ((Math.max(t, START) - START) / (END - START)) * (w - L - R);
  const y = (p) => T + ((hi - p) / (hi - lo)) * (h - T - B);
  let g = '';
  // grid and y labels
  const stepY = hi - lo > 6 ? 2 : 1;
  for (let p = lo; p <= hi; p += stepY) g += `<line x1="${L}" x2="${w - R}" y1="${y(p)}" y2="${y(p)}" class="g-grid"/><text x="${L - 6}" y="${y(p) + 4}" class="g-ax" text-anchor="end">${p}p</text>`;
  // x labels
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  for (let d = 0; d <= 14; d += opts.xEvery) {
    const t = Date.parse('2026-10-17T00:00:00Z') + d * 864e5;
    if (t > END) break;
    const dt = new Date(t);
    g += `<line x1="${x(t)}" x2="${x(t)}" y1="${h - B}" y2="${h - B + 4}" class="g-axl"/><text x="${x(t)}" y="${h - 8}" class="g-ax" text-anchor="middle">${months[dt.getUTCMonth()]} ${dt.getUTCDate()}</text>`;
  }
  g += `<line x1="${L}" x2="${w - R}" y1="${h - B}" y2="${h - B}" class="g-axl"/>`;
  // not known
  const known = mine[0].t;
  if (known > START) {
    g += `<rect x="${L}" y="${T}" width="${x(known) - L}" height="${h - T - B}" fill="url(#hatch)" class="g-unk"/>`;
    g += `<text x="${(L + x(known)) / 2}" y="${T + (h - T - B) / 2 + 4}" class="g-unk-t" text-anchor="middle">Not recorded</text>`;
  }
  // step path helper
  const path = (st, from) => {
    let d = '', last = null;
    for (const s of st) {
      const tx = x(Math.max(s.t, from));
      if (last === null) d += `M${tx},${y(s.p)}`; else d += `H${tx}V${y(s.p)}`;
      last = s;
    }
    return d + `H${x(END)}`;
  };
  g += `<path d="${path(avg, avgFrom)}" class="g-avg"/>`;
  g += `<path d="${path(mine, START)}" class="g-me"/>`;
  for (const s of mine) if (s.t >= START) g += `<circle cx="${x(s.t)}" cy="${y(s.p)}" r="4.5" class="g-dot"/>`;
  // end labels
  const me = mine[mine.length - 1].p, av = avg[avg.length - 1].p;
  let ym = y(me) + 4, ya = y(av) + 4;
  if (Math.abs(ym - ya) < 14) { if (ym < ya) { ym -= 7; ya += 7; } else { ym += 7; ya -= 7; } }
  g += `<text x="${w - R + 8}" y="${ym}" class="g-lab g-lab-me">${me.toFixed(1)}p</text><text x="${w - R + 8}" y="${ya}" class="g-lab">${av.toFixed(1)}p</text>`;
  if (opts.tip) {
    const s = mine[mine.length - 1], prev = mine[mine.length - 2];
    const tx = x(s.t), ty = y(s.p);
    g += `<line x1="${tx}" x2="${tx}" y1="${T}" y2="${h - B}" class="g-cross"/>`;
    const tw = 196, th = 50, bx = Math.min(tx - tw - 10, w - tw - 4), by = ty - th - 12;
    g += `<g class="g-tip"><rect x="${bx}" y="${by}" width="${tw}" height="${th}" rx="8"/><text x="${bx + 10}" y="${by + 20}" class="g-tip-b">${s.p.toFixed(1)}p, was ${prev ? prev.p.toFixed(1) + 'p' : '?'}</text><text x="${bx + 10}" y="${by + 38}">${opts.tip}</text></g>`;
    g += `<circle cx="${tx}" cy="${ty}" r="6" class="g-dot"/>`;
  }
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="Unleaded price at this station and the average, last 14 days"><defs><pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" class="g-hatch"/></pattern></defs>${g}</svg>`;
}

const CSS = `
:root{--g-me:#c05a14;--g-avg:#5f5a52}
:root[data-theme="dark"]{--g-me:#cf7a3f;--g-avg:#7a7266}
.hist .g-grid{stroke:var(--color-divider);stroke-width:1}
.hist .g-axl{stroke:var(--color-neutral-500);stroke-width:1}
.hist .g-ax{font:11px Figtree,sans-serif;fill:var(--color-neutral-700)}
.hist .g-me{fill:none;stroke:var(--g-me);stroke-width:2.5;stroke-linejoin:round;stroke-linecap:round}
.hist .g-avg{fill:none;stroke:var(--g-avg);stroke-width:2;stroke-dasharray:5 4;stroke-linejoin:round}
.hist .g-dot{fill:var(--g-me);stroke:var(--color-bg);stroke-width:2}
.hist .g-hatch{stroke:var(--color-neutral-400);stroke-width:1.2;opacity:.6}
.hist .g-unk-t{font:600 12px Figtree,sans-serif;fill:var(--color-neutral-700)}
.hist .g-lab{font:600 12px Figtree,sans-serif;fill:var(--color-neutral-700)}
.hist .g-lab-me{fill:var(--color-text)}
.hist .g-cross{stroke:var(--color-neutral-500);stroke-width:1}
.hist .g-tip rect{fill:var(--color-surface);stroke:var(--color-divider)}
.hist .g-tip text{font:12px Figtree,sans-serif;fill:var(--color-neutral-700)}
.hist .g-tip .g-tip-b{font-weight:600;fill:var(--color-text)}
.hist-legend{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:12.5px;color:var(--color-neutral-700);margin:2px 0 6px}
.hist-legend span{display:inline-flex;align-items:center;gap:6px}
.hist-legend i{display:inline-block;width:22px;height:0;border-top:2.5px solid var(--g-me)}
.hist-legend i.avg{border-top:2px dashed var(--g-avg)}
.hist-say{font-size:14px;margin:8px 0 4px}
`;

const NAMES = { cav: 'Caversham Esso Express', rex: 'Reading Extra – Petrol Filling Station' };
function panel(row, w, h, opts, say) {
  return `<div class="calc hist" data-mock="1"><div class="calc-head"><h4>Price history</h4><button type="button" class="more-btn">Close</button></div>
<p class="calc-say">The last 14 days at ${row.name.replace(/ – .*/, '')}, against the average of the eight stations shown.</p>
<div class="fuel-btns"><button class="fuel-btn" aria-pressed="true">Unleaded</button><button class="fuel-btn" aria-pressed="false">Diesel</button></div>
<div class="hist-legend"><span><i></i>This station</span><span><i class="avg"></i>Average of the eight shown</span></div>
${chart(row, 'e10', w, h, opts)}
<p class="hist-say">${say}</p>
<p class="calc-small">Refueller began recording prices on October 30th, so the record fills in over the next fortnight. Each price is drawn from the time the station set it. The average is of the eight stations shown, and starts once all eight prices are known (from 3pm on October 29th).</p></div>`;
}
const SAY = {
  cav: 'Unleaded here was 177.9p from October 14th until 3.07pm on October 30th, then 175.9p.',
  rex: 'Unleaded here has been 172.9p since 2.30pm on October 30th. Before that it was 173.9p, from 3pm on October 29th. Earlier prices weren’t recorded.',
};

(async () => {
  const b = await chromium.launch();
  const shots = [
    ['computer', { viewport: { width: 1200, height: 900 } }, 'light', 'cav', true],
    ['computer', { viewport: { width: 1200, height: 900 } }, 'light', 'rex', false],
    ['computer', { viewport: { width: 1200, height: 900 } }, 'dark', 'rex', false],
    ['phone', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, 'light', 'rex', false],
    ['phone', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, 'dark', 'cav', false],
  ];
  for (const [dev, opts, theme, who, tip] of shots) {
    const ctx = await b.newContext({ ...opts, colorScheme: theme });
    const p = await ctx.newPage();
    await p.addInitScript(() => Date.now = ((n) => () => n)(Date.parse('2026-10-30T17:00:00Z')));
    await p.goto('http://localhost:4182/#RG4');
    await p.waitForSelector('.sname');
    const row = rows.find((r) => r.name === NAMES[who]);
    const phone = dev === 'phone';
    const html = panel(row, phone ? 340 : 980, phone ? 230 : 260, { right: phone ? 48 : 60, xEvery: phone ? 4 : 2, tip: tip ? 'set October 30th at 3.07pm' : '' }, SAY[who]);
    const ok = await p.evaluate(({ html, css, name, phone }) => {
      const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
      // the link, on every row
      for (const links of document.querySelectorAll('.row-links')) { const a = document.createElement('button'); a.className = 'centre-link link-btn'; a.textContent = 'Price history'; links.appendChild(a); }
      const nameEl = [...document.querySelectorAll('.sname')].find((e) => e.textContent === name);
      if (!nameEl) return false;
      if (phone) { nameEl.closest('.pcard').insertAdjacentHTML('beforeend', html); }
      else { const tr = nameEl.closest('tr'); tr.insertAdjacentHTML('afterend', `<tr class="calc-row"><td colspan="5">${html}</td></tr>`); }
      return true;
    }, { html, css: CSS, name: NAMES[who], phone });
    if (!ok) throw new Error('row not found ' + who);
    const el = p.locator('.hist');
    await el.scrollIntoViewIfNeeded();
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    const file = `graph-${dev}-${who}-${theme}.png`;
    if (phone) { await p.evaluate(() => { const c = document.querySelector('.hist').closest('.pcard'); c.scrollIntoView(); }); await p.locator('.pcard:has(.hist)').screenshot({ path: OUT + file }); }
    else await p.locator('.hist').screenshot({ path: OUT + file });
    console.log(file, 'overflow', overflow);
    await ctx.close();
  }
  await b.close();
})();

// Mock-ups of the four ways to choose the eight for "Find cheaper fuel near the route" (31 October 2026), and the journey link
// moved to the bottom. Drawn into the built page in the browser only; no app code. Figures: journeys-2026-10-31.json.
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = '/home/user/refueller/design/previews/';
const J = JSON.parse(fs.readFileSync(__dirname + '/journeys-2026-10-31.json', 'utf8'));
const PORT = process.argv[2];

const W = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const miles = (m) => (m < 0.1 ? 'less than 0.1 miles' : m < 5 ? `${m.toFixed(1)} miles` : `${Math.round(m)} miles`);
const byPrice = (a, b) => a.price - b.price || a.extra - b.extra;
const byAlong = (a, b) => a.along - b.along;

// The four options. Each returns { rows, groups?, sentence }.
function choose(j, opt) {
  const c = j.all8.slice().sort(byPrice);
  if (opt === 'a') return { rows: c.slice(0, 8), sentence: 'cheapest first' };
  if (opt === 'b') return { rows: c.slice(0, 8).sort(byAlong), sentence: 'in the order you’d reach them' };
  if (opt === 'c') {
    const q = j.direct / 4, picked = [];
    const groups = [0, 1, 2, 3].map((k) => {
      const lo = k * q, hi = (k + 1) * q;
      const two = c.filter((r) => r.along >= lo && (r.along < hi || k === 3)).slice(0, 2);
      picked.push(...two);
      return { label: `${['First', 'Second', 'Third', 'Last'][k]} quarter: ${Math.round(lo)} to ${Math.round(hi)} miles from the start`, rows: two.sort(byAlong) };
    });
    return { rows: picked, groups, sentence: 'the two cheapest in each quarter of the journey, in the order you’d reach them' };
  }
  const end = 10;
  return { rows: c.filter((r) => r.along > end && r.along < j.direct - end).slice(0, 8), sentence: `cheapest first, leaving out the first and last ${end} miles (the postcode search covers those)` };
}

function priceHtml(r, shown) {
  const all = shown.map((x) => x.price).sort((a, b) => a - b), lo = all[0];
  const w = 8, gap = 2, H = 22, span = Math.max(all[all.length - 1] - lo, 0.1);
  const bars = all.map((p, k) => { const h = 2 + ((p - lo) / span) * (H - 2); return `<rect x="${k * (w + gap)}" y="${H - h}" width="${w}" height="${h}" rx="2"${p === r.price ? ' class="me"' : ''}/>`; }).join('');
  const t = Math.round(r.price * 10) - Math.round(lo * 10);
  const text = t <= 0 ? `Lowest of ${W[all.length]}` : `${(t / 10).toFixed(1)}p above the lowest`;
  return `<div class="price mono">${r.price.toFixed(1)}p</div>${r.price === lo ? '<div><span class="cheap-tag">Cheapest</span></div>' : ''}<div class="upd${r.old ? ' old' : ''}">${r.upd}</div>
    <div class="rank"><svg class="rank-bars" width="${all.length * (w + gap) - gap}" height="${H}">${bars}</svg><div class="rank-t">${text}</div></div>`;
}
const nameHtml = (r) => `<div class="brand">${r.brand}</div><div class="sname">${r.name}</div>${r.members ? '<div class="members">Members only</div>' : ''}`;

function results(j, opt, narrow) {
  const { rows, groups, sentence } = choose(j, opt);
  const head = `<div class="opt-label">Option ${opt}</div>
  <div class="results-head"><h3>${cap(W[rows.length])} cheaper stations near the route from ${j.from} (${j.fromPlace.split(' / ')[0]}) to ${j.to} (${j.toPlace})</h3></div>
  <div class="fuel-btns" style="margin-top:10px"><button class="fuel-btn" aria-pressed="true">Unleaded</button><button class="fuel-btn" aria-pressed="false">Diesel</button></div>
  <p class="notes">The route is about ${Math.round(j.direct)} miles by road. Of the ${j.within} stations that add no more than ${j.cap} miles to it, there and back,
  these are ${sentence}. Distances are by main roads, so they’re a guide. Opening hours are today’s. Prices collected at 4.15pm today, as reported by
  each station; they may have changed since. <a href="#">Report a wrong price</a>.</p>`;
  const sets = groups ?? [{ rows }];
  if (narrow) {
    return head + sets.map((g) => `${g.label ? `<div class="grp">${g.label}</div>` : ''}<div class="cards">${g.rows.map((r) => `
      <div class="pcard"><div class="pcard-top"><div>${nameHtml(r)}</div><div class="dist mono" style="text-align:right">${miles(r.extra)}<div style="font-size:11.5px;font-weight:400;color:var(--color-neutral-700)">extra</div></div></div>
      <div class="grid"><div class="lbl">Unleaded</div><div>${priceHtml(r, rows)}</div>
      <div class="lbl">On the way</div><div>${miles(r.along)} from the start</div>
      <div class="lbl">Today</div><div class="openv">${r.hours}</div></div></div>`).join('')}</div>`).join('');
  }
  return head + `<div class="table-box"><table class="table stations"><colgroup><col class="station"/><col/><col/><col/><col/></colgroup>
    <thead><tr><th>Station</th><th class="c">On the way</th><th class="c">Extra miles</th><th class="c">Unleaded (E10)</th><th class="c">Today</th></tr></thead><tbody>
    ${sets.map((g) => `${g.label ? `<tr class="grp-row"><td colspan="5"><div class="grp">${g.label}</div></td></tr>` : ''}${g.rows.map((r) => `<tr><td>${nameHtml(r)}<div class="addr">${r.address}</div></td>
      <td class="c">${miles(r.along)} from the start</td><td class="c mono dist">${miles(r.extra)}</td><td class="c">${priceHtml(r, rows)}</td><td class="c">${r.hours}</td></tr>`).join('')}`).join('')}
    </tbody></table></div>`;
}

const CSS = `.opt-label{display:inline-block;margin-top:28px;padding:3px 12px;border:2px dashed var(--color-accent);border-radius:8px;font-weight:700;color:var(--color-accent-700)}
.grp{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--color-neutral-700);margin:14px 0 6px}
.grp-row td{padding-bottom:0!important;border-bottom:0!important}
.journey-link{margin:40px 0 0;padding-top:16px;border-top:1px solid var(--color-divider);font-size:14px;color:var(--color-neutral-700)}
.journey-link a{color:var(--color-accent-700);font-weight:600}`;

(async () => {
  const b = await chromium.launch();
  const devices = [['computer', { viewport: { width: 1200, height: 900 } }], ['phone', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }]];
  const j = J.find((x) => x.from === 'RG1' && x.fuel === 'e10');
  for (const [dev, opts] of devices) {
    const ctx = await b.newContext({ ...opts, colorScheme: 'light' });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    const css = () => p.evaluate((c) => { const s = document.createElement('style'); s.textContent = c; document.head.append(s); }, CSS);
    // The link at the bottom: the postcode screen, and below a list of results.
    await p.goto(`http://localhost:${PORT}/#`); await p.evaluate(() => localStorage.clear()); await p.goto(`http://localhost:${PORT}/#`); await p.reload(); await p.waitForSelector('.search-form'); await css();
    const LINK = '<p class="journey-link">Planning a journey? <a href="#">Find cheaper fuel near the route.</a></p>';
    await p.evaluate((l) => document.querySelector('.footer-notice').insertAdjacentHTML('beforebegin', l), LINK);
    await p.screenshot({ path: OUT + `journey-3-start-bottom-${dev}.png`, fullPage: true });
    await p.goto(`http://localhost:${PORT}/#RG4`); await p.reload(); await p.waitForSelector('.sname'); await css();
    await p.evaluate((l) => document.querySelector('section.about').insertAdjacentHTML('beforebegin', l), LINK);
    await p.locator('.journey-link').evaluate((e) => e.scrollIntoView({ block: 'center' }));
    await p.screenshot({ path: OUT + `journey-3-results-bottom-${dev}.png` });
    // The four options, Reading to Bristol, unleaded.
    for (const opt of ['a', 'b', 'c', 'd']) {
      await p.goto(`http://localhost:${PORT}/#`); await p.reload(); await p.waitForSelector('.search-form'); await css();
      await p.evaluate((h) => {
        document.querySelector('.page-head').innerHTML = '<div class="card-kicker">Fuel prices</div><h2>Find cheaper fuel near the route</h2>';
        document.querySelector('.page-head').insertAdjacentHTML('afterend', `<div id="jr">${h}</div>`);
        document.querySelector('.footer-notice').remove();
      }, results(j, opt, dev === 'phone'));
      await p.locator('#jr').screenshot({ path: OUT + `journey-4-option-${opt}-${dev}.png` });
      console.log(opt, dev, choose(j, opt).rows.map((r) => `${r.price} ${Math.round(r.along)}mi`).join(', '), '| overflow', await p.evaluate(() => document.documentElement.scrollWidth - innerWidth));
    }
    // Cardiff to Bristol with the Costco note, option b.
    await p.goto(`http://localhost:${PORT}/#`); await p.reload(); await p.waitForSelector('.search-form'); await css();
    const c = J.find((x) => x.from === 'CF10');
    await p.evaluate((h) => { document.querySelector('.page-head').insertAdjacentHTML('afterend', `<div id="jr">${h}</div>`); }, results(c, 'b', dev === 'phone'));
    await (dev === 'phone' ? p.locator('.pcard', { has: p.locator('.members') }) : p.locator('tbody tr', { has: p.locator('.members') })).first().screenshot({ path: OUT + `journey-5-costco-${dev}.png` });
    if (errs.length) console.log('errors', errs);
    await ctx.close();
  }
  await b.close();
})();

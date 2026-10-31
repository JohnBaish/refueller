// Mock-up of "Find cheaper fuel near the route" (31 October 2026), drawn into the built page in the browser only; no app code.
// Figures: design/mock/journeys-2026-10-31.json, worked out from the 4.15pm collection on October 31st and a motorway + A + B
// road map from OS Open Roads (fastest route by rough speeds; extra miles = start to station to end, less the direct route).
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = '/home/user/refueller/design/previews/';
const J = JSON.parse(fs.readFileSync(__dirname + '/journeys-2026-10-31.json', 'utf8'));

const W = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];
const miles = (m) => (m < 0.1 ? 'less than 0.1 miles' : m < 5 ? `${m.toFixed(1)} miles` : `${Math.round(m)} miles`);
const rank = (r) => {
  const w = 8, gap = 2, H = 22, lo = r.all[0], span = Math.max(r.all[r.all.length - 1] - lo, 0.1);
  const bars = r.all.map((p, k) => { const h = 2 + ((p - lo) / span) * (H - 2); return `<rect x="${k * (w + gap)}" y="${H - h}" width="${w}" height="${h}" rx="2"${p === r.price ? ' class="me"' : ''}/>`; }).join('');
  return `<div class="rank"><svg class="rank-bars" width="${r.all.length * (w + gap) - gap}" height="${H}">${bars}</svg><div class="rank-t">${r.rank}</div></div>`;
};
const price = (r) => `<div class="price mono">${r.price.toFixed(1)}p</div>${r.cheapest ? '<div><span class="cheap-tag">Cheapest</span></div>' : ''}<div class="upd${r.old ? ' old' : ''}">${r.upd}</div>${rank(r)}`;
const along = (r) => `${miles(r.along)} from the start`;

function html(j, narrow) {
  const fuelName = j.fuel === 'e10' ? 'Unleaded (E10)' : 'Diesel';
  const head = `
  <div class="results-head"><h3>${W[j.rows.length][0].toUpperCase() + W[j.rows.length].slice(1)} cheapest stations near the route from ${j.from} (${j.fromPlace.split(' / ')[0]}) to ${j.to} (${j.toPlace})</h3></div>
  <div class="fuel-btns" style="margin-top:10px"><button class="fuel-btn" aria-pressed="${j.fuel === 'e10'}">Unleaded</button><button class="fuel-btn" aria-pressed="${j.fuel === 'diesel'}">Diesel</button></div>
  <p class="notes">The route is about ${Math.round(j.direct)} miles by road. These are the cheapest of the ${j.within} stations that add no more than ${j.cap} miles to it,
  there and back, cheapest first. Distances are by main roads, so they're a guide. Opening hours are today's, as we can't know when you'll get there.
  Prices collected at 4.15pm today, as reported by each station; they may have changed since. <a href="#">Report a wrong price</a>.</p>`;
  if (narrow) {
    return head + `<div class="cards">${j.rows.map((r) => `
      <div class="pcard"><div class="pcard-top"><div><div class="brand">${r.brand}</div><div class="sname">${r.name}</div></div><div class="dist mono" style="text-align:right">${miles(r.extra)}<div style="font-size:11.5px;font-weight:400;color:var(--color-neutral-700)">extra</div></div></div>
      <div class="grid"><div class="lbl">${j.fuel === 'e10' ? 'Unleaded' : 'Diesel'}</div><div>${price(r)}</div>
      <div class="lbl">On the way</div><div>${along(r)}</div>
      <div class="lbl">Today</div><div class="openv">${r.hours}</div>
      <div class="lbl">Address</div><div class="addr">${r.address}</div></div></div>`).join('')}</div>`;
  }
  return head + `<div class="table-box"><table class="table stations"><colgroup><col class="station"/><col/><col/><col/><col/></colgroup>
    <thead><tr><th>Station</th><th class="c">On the way</th><th class="c">Extra miles</th><th class="c">${fuelName}</th><th class="c">Today</th></tr></thead><tbody>
    ${j.rows.map((r) => `<tr><td><div class="brand">${r.brand}</div><div class="sname">${r.name}</div><div class="addr">${r.address}</div></td>
      <td class="c">${along(r)}</td><td class="c mono dist">${miles(r.extra)}</td><td class="c">${price(r)}</td><td class="c">${r.hours}</td></tr>`).join('')}
    </tbody></table></div>`;
}

const form = (j) => `
  <div class="card-kicker">Fuel prices</div>
  <h2>Find cheaper fuel near the route</h2>
  <p class="lead">Type where you’re starting and where you’re going. Refueller finds the cheapest stations that add no more than three miles to your journey.</p>
  <form class="search-form"><div class="search journey">
    <label class="jf"><span class="jl">From</span><input class="input" value="${j.from}"></label>
    <label class="jf"><span class="jl">Via (optional)</span><input class="input" placeholder="RG1 or RG1 8FR"></label>
    <label class="jf"><span class="jl">To</span><input class="input" value="${j.to}"></label>
    <button type="button" class="btn btn-primary">Find</button></div>
    <p class="hint">Full postcodes or just the first half (RG1). The route is worked out on this page: nothing you type leaves it.</p></form>`;
const CSS = `.journey{align-items:flex-end}.jf{display:flex;flex-direction:column;gap:4px}.jl{font-size:12px;font-weight:600;color:var(--color-neutral-700)}
.journey .input{width:170px}.journey-link{margin:14px 0 0;font-size:14px}.journey-link a{color:var(--color-accent-700);font-weight:600}
@media (max-width:720px){.journey .jf{flex:1 1 100%}.journey .input{width:100%}.journey .btn{flex:1 1 100%}}`;

(async () => {
  const b = await chromium.launch();
  const devices = [['computer', { viewport: { width: 1200, height: 900 } }], ['phone', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }]];
  for (const scheme of ['light', 'dark']) for (const [dev, opts] of devices) {
    const ctx = await b.newContext({ ...opts, colorScheme: scheme });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    // 1. The way in, on the postcode screen.
    await p.goto('http://localhost:4190/#'); await p.evaluate(() => localStorage.clear()); await p.goto('http://localhost:4190/#'); await p.waitForSelector('.search-form');
    await p.evaluate((css) => { const s = document.createElement('style'); s.textContent = css; document.head.append(s);
      document.querySelector('.hint').insertAdjacentHTML('afterend', '<p class="journey-link"><a href="#">Planning a journey? Find cheaper fuel near the route.</a></p>'); }, CSS);
    if (scheme === 'light') await p.screenshot({ path: OUT + `journey-1-start-${dev}.png`, fullPage: dev === 'phone' ? false : true });
    // 2. The journey screen with results.
    for (const j of J.filter((x) => scheme === 'light' || (x.from === 'RG1' && x.fuel === 'e10'))) {
      await p.evaluate(([formHtml, res]) => {
        document.querySelector('.page-head').innerHTML = formHtml;
        document.querySelector('.page-head').insertAdjacentHTML('afterend', `<div id="jr">${res}</div>`);
        document.querySelector('.footer-notice').insertAdjacentHTML('afterbegin', '');
      }, [form(j), html(j, dev === 'phone')]);
      const name = `journey-2-${j.from}-${j.to}-${j.fuel}-${dev}-${scheme}.png`;
      if (dev === 'computer') await p.screenshot({ path: OUT + name, fullPage: true });
      else {
        await p.screenshot({ path: OUT + name.replace('.png', '-top.png') });
        await p.locator('.pcard').nth(1).screenshot({ path: OUT + name.replace('.png', '-card.png') });
      }
      console.log(name, 'overflow', await p.evaluate(() => document.documentElement.scrollWidth - innerWidth));
      await p.evaluate(() => document.getElementById('jr').remove());
    }
    if (errs.length) console.log('errors', errs);
    await ctx.close();
  }
  await b.close();
})();

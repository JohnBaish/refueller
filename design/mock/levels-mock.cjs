const { chromium } = require('playwright');
// "Averages at every level" mock-ups (November 1st 2026), drawn into the built page in the browser only; no app code.
// Run against `npx vite preview --port 4191`. Figures: the 4.15pm collection on November 1st, worked out from data/prices.json
// and OS Open Names (each station's postcode -> council, region, country; Hindcaster's ceremonial-county table), unusual prices
// left out. A: John's idea, its own card just before the journey planner. B: the same list inside "The wider picture", above its
// charts, which then show two lines (the RG line removed).
const OUT = '/home/user/refueller/design/previews/levels/';
const ROWS = [
  ['These eight stations', '174.4', '199.7', 'Unleaded is down 0.8p since October 30th, when Refueller began recording.', 'eight'],
  ['Reading', '174.3', '200.1', 'Unleaded is 1.3p less than the Berkshire average.'],
  ['Berkshire', '175.6', '200.9', 'The second dearest county in England for unleaded, after the Isle of Wight.'],
  ['South East England', '173.8', '200.2', 'The dearest of England’s nine regions for both fuels.'],
  ['England', '172.6', '199.1', 'Unleaded averages range from 169.5p in West Yorkshire to 179.0p on the Isle of Wight.'],
  ['Great Britain', '172.5', '199.2', 'Wales is the cheapest of the three nations for both fuels, and Scotland the dearest.', 'gb'],
];
const inject = ({ variant, rows }) => {
  const css = `
  .lv{margin-top:var(--space-8);padding-top:var(--space-4);border-top:1px solid var(--color-divider)}
  .lv h3{font-size:20px;margin:0 0 var(--space-2)}
  .lv>p{font-size:14px;margin:0 0 10px}
  .lv-box{background:var(--color-surface);border-radius:var(--radius-lg,14px);padding:4px 18px}
  .lv-row{display:grid;grid-template-columns:1fr 92px 92px;column-gap:12px;align-items:baseline;padding:10px 0;border-top:1px solid var(--color-divider)}
  .lv-row:first-child{border-top:0}
  .lv-head{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--color-neutral-700);padding:10px 0 2px}
  .lv-name{font-weight:700;font-size:15px}
  .lv-p{text-align:center;font-weight:700;font-size:16px}
  .lv-fact{grid-column:1/-1;font-size:13.5px;color:var(--color-neutral-700);margin-top:2px}
  .lv-name i{display:inline-block;width:20px;height:0;vertical-align:middle;margin-right:8px}
  .lv-name i.eight{border-top:2.5px solid var(--g-me)} .lv-name i.gb{border-top:2px dashed var(--g-avg)}
  .lv-small{display:none}
  .avg-sec .lv-box{margin:4px 0 14px}
  @media (max-width:720px){
    .lv-box{padding:2px 14px}
    .lv-row{grid-template-columns:1fr auto;row-gap:2px}
    .lv-head{display:none}
    .lv-p{display:none}
    .lv-small{display:block;grid-column:1/-1;font-size:15px}
    .lv-small b{font-weight:700}
  }`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const box = document.createElement('div'); box.className = 'lv-box';
  box.innerHTML = `<div class="lv-row lv-head"><span>Average</span><span class="lv-p" style="font-size:12px;font-weight:400">Unleaded</span><span class="lv-p" style="font-size:12px;font-weight:400">Diesel</span></div>` +
    rows.map(([n, e, d, f, key]) => `<div class="lv-row"><span class="lv-name">${variant === 'b' && key ? `<i class="${key}"></i>` : ''}${n}</span><span class="lv-p">${e}p</span><span class="lv-p">${d}p</span>
      <span class="lv-small">Unleaded <b>${e}p</b> · Diesel <b>${d}p</b></span><span class="lv-fact">${f}</span></div>`).join('');
  const avg = document.querySelector('.avg-sec');
  if (variant === 'a') {
    const sec = document.createElement('section'); sec.className = 'lv';
    sec.innerHTML = `<h3>Averages around you</h3><p>Average prices at the 4.15pm collection on November 1st, unusual prices not included.</p>`;
    sec.appendChild(box);
    avg.after(sec);
  } else {
    // The list goes after the opening sentence and takes the place of the key; the RG line leaves the charts.
    avg.querySelector('.hist-legend').replaceWith(box);
    avg.querySelectorAll('.a-area').forEach((e) => e.remove());
    avg.querySelectorAll('.g-lab').forEach((e) => { if (/^(176\.3p|201\.2p)$/.test(e.textContent.trim())) e.remove(); });
  }
};
(async () => {
  const b = await chromium.launch();
  const errors = [];
  for (const [w, touch] of [[1200, false], [390, true]]) for (const theme of ['light', 'dark']) for (const variant of ['a', 'b']) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 2, colorScheme: theme });
    const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(String(e)));
    await p.goto('http://localhost:4191/#RG4-7SS'); await p.waitForSelector('.avg-sec svg', { timeout: 20000 });
    await p.waitForTimeout(500);
    await p.evaluate(inject, { variant, rows: [ROWS][0] });
    const sw = await p.evaluate(() => document.documentElement.scrollWidth);
    if (sw > w) errors.push(`sideways scroll ${variant} ${w} ${theme}: ${sw}`);
    const el = variant === 'a' ? await p.$('.lv') : await p.$('.avg-sec');
    const box = await el.boundingBox();
    const top = Math.max(0, box.y - 40), height = (variant === 'a' ? box.height : box.height) + 80;
    await p.screenshot({ path: `${OUT}levels-${variant}-${w > 720 ? 'computer' : 'phone'}-${theme}.png`, fullPage: true, clip: { x: 0, y: top, width: w, height: Math.min(height + 40, 3000) } });
    if (variant === 'a') {
      const both = await p.evaluate(() => { const a = document.querySelector('.avg-sec').getBoundingClientRect(), j = document.querySelector('.lv').getBoundingClientRect(); return [a.top + scrollY, j.bottom + scrollY]; });
      await p.screenshot({ path: `${OUT}levels-a-${w > 720 ? 'computer' : 'phone'}-${theme}-with-wider.png`, fullPage: true, clip: { x: 0, y: both[0] - 30, width: w, height: both[1] - both[0] + 60 } });
    }
    await ctx.close();
  }
  await b.close();
  console.log(errors.length ? errors.join('\n') : 'no errors, no sideways scroll');
})();

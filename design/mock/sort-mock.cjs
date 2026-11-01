const { chromium } = require('playwright');
// "Sort by" mock-ups (November 1st 2026), drawn into the built page in the browser only; no app code.
// Run against `vite preview --port 4190`. Computer A: sortable column headings. Computer B: the phone's strip above the table.
// Phone A: John's strip, the active choice in bold. Phone B: a three-part switch.
const OUT = '/home/user/refueller/design/previews/sort/';
const inject = ({ variant, by }) => {
  const table = !!document.querySelector('table.stations');
  const css = `
  .sort-strip{display:flex;flex-wrap:wrap;align-items:center;column-gap:4px;margin:0 0 var(--space-3);font-size:14px}
  .sort-strip .lab{color:var(--color-neutral-700);margin-right:4px}
  .sort-strip button{background:none;border:0;font:inherit;color:var(--color-accent-700);padding:0 8px;min-height:44px;cursor:pointer}
  .sort-strip button.on{color:var(--color-text);font-weight:700}
  .sort-strip .dot{color:var(--color-neutral-400)}
  .sort-seg{display:flex;align-items:center;gap:10px;margin:0 0 var(--space-3);font-size:14px}
  .sort-seg .lab{color:var(--color-neutral-700);white-space:nowrap}
  .sort-seg .seg{display:flex;flex:1;border:1px solid var(--color-accent);border-radius:999px;overflow:hidden}
  .sort-seg button{flex:1;min-height:44px;border:0;background:none;font:inherit;font-size:14px;color:var(--color-accent-700);cursor:pointer;padding:0 6px}
  .sort-seg button+button{border-left:1px solid var(--color-accent)}
  .sort-seg button.on{background:var(--color-accent);color:var(--color-bg);font-weight:600}
  .stations th.s{cursor:pointer;white-space:nowrap}
  .stations th.s span.a{display:inline-block;margin-left:4px;font-size:12px;letter-spacing:0;opacity:.55}
  .stations th.s.on{color:var(--color-text)}
  .stations th.s.on span.a{opacity:1;color:var(--color-accent)}
  .stations th.s:not(.on):hover{color:var(--color-accent-700)}
  .sort-note{font-weight:600;color:var(--color-text)}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  // The sort itself: distance, or the price in that column; stations without the fuel go last; ties by distance.
  const rows = table ? [...document.querySelectorAll('tbody tr:not(.calc-row)')] : [...document.querySelectorAll('.pcard')];
  const dist = (r) => { const t = r.querySelector('.dist').textContent; return /less than/.test(t) ? 0 : parseFloat(t); };
  const priceIn = (r, f) => {
    const cell = table ? r.children[f === 'e10' ? 2 : 3] : r.querySelectorAll('.grid > div')[f === 'e10' ? 1 : 3];
    const e = cell.querySelector('.price'); return e ? parseFloat(e.textContent) : Infinity;
  };
  const key = (r) => by === 'dist' ? [dist(r), 0] : [priceIn(r, by), dist(r)];
  const sorted = [...rows].sort((a, b) => { const x = key(a), y = key(b); return x[0] - y[0] || x[1] - y[1]; });
  const parent = rows[0].parentNode; sorted.forEach((r) => parent.appendChild(r));
  const notes = document.querySelector('.notes');
  if (by !== 'dist') {
    const s = document.createElement('span'); s.className = 'sort-note';
    s.textContent = ` Sorted by ${by === 'e10' ? 'unleaded' : 'diesel'} price, lowest first.`;
    notes.appendChild(s);
  }
  const label = { dist: 'Distance', e10: 'Unleaded price', diesel: 'Diesel price' };
  if (variant === 'heads') {
    const ths = document.querySelectorAll('.stations th');
    [['dist', 1], ['e10', 2], ['diesel', 3]].forEach(([k, i]) => {
      const th = ths[i]; th.classList.add('s'); if (k === by) th.classList.add('on');
      th.innerHTML = th.textContent + `<span class="a">${k === by ? '▲' : '⇅'}</span>`;
    });
  } else if (variant === 'strip') {
    const d = document.createElement('div'); d.className = 'sort-strip';
    d.innerHTML = `<span class="lab">Sort by:</span>` + ['dist', 'e10', 'diesel'].map((k) => `<button class="${k === by ? 'on' : ''}">${label[k]}</button>`).join('');
    (table ? document.querySelector('.table-box') : document.querySelector('.cards')).before(d);
  } else {
    const short = { dist: 'Distance', e10: 'Unleaded', diesel: 'Diesel' };
    const d = document.createElement('div'); d.className = 'sort-seg';
    d.innerHTML = `<span class="lab">Sort by</span><div class="seg">` + ['dist', 'e10', 'diesel'].map((k) => `<button class="${k === by ? 'on' : ''}">${short[k]}</button>`).join('') + `</div>`;
    document.querySelector('.cards').before(d);
  }
};
const shots = [
  ['computer', 'heads', 'dist', 'light'], ['computer', 'heads', 'e10', 'light'], ['computer', 'heads', 'e10', 'dark'],
  ['computer', 'strip', 'e10', 'light'],
  ['phone', 'strip', 'dist', 'light'], ['phone', 'strip', 'e10', 'light'], ['phone', 'strip', 'e10', 'dark'],
  ['phone', 'seg', 'e10', 'light'], ['phone', 'seg', 'e10', 'dark'],
];
(async () => {
  const b = await chromium.launch();
  for (const [dev, variant, by, theme] of shots) {
    const opts = dev === 'computer' ? { viewport: { width: 1200, height: 900 } } : { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 };
    const ctx = await b.newContext({ ...opts, colorScheme: theme });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto('http://localhost:4190/#BS15-4XB'); await p.waitForSelector('.sname');
    await p.evaluate(inject, { variant, by });
    const name = `sort-${dev}-${variant}-${by}-${theme}.png`;
    const box = await p.evaluate((dev) => {
      const top = document.querySelector('.results-head').getBoundingClientRect().top + scrollY - 10;
      const end = dev === 'computer' ? document.querySelectorAll('tbody tr:not(.calc-row)')[3].getBoundingClientRect().bottom + scrollY + 8
        : document.querySelectorAll('.pcard')[1].getBoundingClientRect().top + scrollY + 160;
      return { x: 0, y: top, width: innerWidth, height: end - top };
    }, dev);
    await p.screenshot({ path: OUT + name, clip: box, fullPage: true });
    console.log(name, 'overflow', await p.evaluate(() => document.documentElement.scrollWidth - innerWidth), errs.length ? errs : 'no errors');
    await ctx.close();
  }
  await b.close();
})();

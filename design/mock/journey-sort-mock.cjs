const { chromium } = require('playwright');
// Sorting the journey list: mock-ups (November 1st 2026), drawn into the built page in the browser only; no app code.
// Run against `vite preview --port 4192` (built from `feature-sort`). The list shows one fuel at a time, so "price" is that fuel's.
// A: the three groups kept, each sorted within itself. B: one list, the end stations tagged "Near the start" or "Near the end".
const OUT = '/home/user/refueller/design/previews/journey-sort/';
const inject = ({ variant, by }) => {
  const table = !!document.querySelector('table.stations');
  const css = `
  .sort-strip{display:flex;flex-wrap:wrap;align-items:center;column-gap:4px;margin:0 0 var(--space-3);font-size:14px}
  .sort-strip .sort-lab{color:var(--color-neutral-700);margin-right:4px}
  .sort-strip button{background:none;border:0;font:inherit;color:var(--color-accent-700);padding:0 7px;min-height:44px;cursor:pointer}
  .sort-strip button.on{color:var(--color-text);font-weight:700}
  .stations th.s{white-space:nowrap;cursor:pointer}
  .stations th.s .a{display:inline-block;margin-left:4px;font-size:12px;letter-spacing:0;opacity:.55}
  .stations th.s.on{color:var(--color-text)} .stations th.s.on .a{opacity:1;color:var(--color-accent)}
  .end-tag{display:inline-block;margin:2px 0 3px;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--color-note);border:1px solid currentColor;border-radius:999px;padding:1px 8px}
  .sort-note{font-weight:600;color:var(--color-text)}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  // Each station with its group, price and detour as shown.
  let group = '';
  const items = [];
  if (table) {
    for (const tr of document.querySelectorAll('tbody tr')) {
      if (tr.classList.contains('grp-row')) { group = tr.textContent.trim(); continue; }
      const d = tr.children[2].textContent; const e = tr.querySelector('.price');
      items.push({ el: tr, group, price: e ? parseFloat(e.textContent) : Infinity, detour: /\d/.test(d) ? parseFloat(d) : Infinity });
    }
  } else {
    for (const box of document.querySelectorAll('.cards > div')) {
      const g = box.querySelector('.grp'); if (g) group = g.textContent.trim();
      const lbls = [...box.querySelectorAll('.lbl')]; const det = lbls.find((l) => l.textContent === 'Detour').nextElementSibling.textContent;
      const e = box.querySelector('.price');
      items.push({ el: box, group, price: e ? parseFloat(e.textContent) : Infinity, detour: /\d/.test(det) ? parseFloat(det) : Infinity });
    }
  }
  items.forEach((x, i) => (x.i = i));
  const key = (x) => by === 'route' ? x.i : by === 'price' ? x.price : x.detour;
  const cmp = (a, b) => key(a) - key(b) || a.i - b.i;
  const parent = items[0].el.parentNode;
  if (by !== 'route') {
    if (variant === 'A') {
      // group headers stay; each group's rows are put back in their new order after its header
      for (const g of [...new Set(items.map((x) => x.group))]) {
        const ins = items.filter((x) => x.group === g).sort(cmp);
        const anchor = ins[0].el.previousElementSibling && table ? null : null;
        const first = items.find((x) => x.group === g).el;
        const marker = document.createComment('g'); parent.insertBefore(marker, first);
        ins.forEach((x) => parent.insertBefore(x.el, marker)); marker.remove();
        if (!table) { // the group heading lives inside the first card's wrapper: move it to the new first
          const h = items.filter((x) => x.group === g).map((x) => x.el.querySelector('.grp')).find(Boolean);
          if (h) ins[0].el.prepend(h);
        }
      }
    } else {
      document.querySelectorAll(table ? 'tr.grp-row' : '.cards .grp').forEach((g) => g.remove());
      [...items].sort(cmp).forEach((x) => parent.appendChild(x.el));
      for (const x of items) {
        if (/start|end/.test(x.group)) {
          const t = document.createElement('div'); t.className = 'end-tag';
          t.textContent = /start/.test(x.group) ? 'Near the start' : 'Near the end';
          const nameBox = table ? x.el.children[0] : x.el.querySelector('.pcard-top > div');
          nameBox.prepend(t);
        }
      }
    }
    const s = document.createElement('span'); s.className = 'sort-note';
    s.textContent = by === 'price' ? ' Sorted by price, lowest first.' : ' Sorted by detour, shortest first.';
    document.querySelector('.notes').appendChild(s);
  }
  if (table) {
    const ths = document.querySelectorAll('.stations th');
    [['route', 1], ['detour', 2], ['price', 3]].forEach(([k, i]) => {
      const th = ths[i]; th.classList.add('s'); if (k === by) th.classList.add('on');
      th.innerHTML = th.textContent + `<span class="a">${k === by ? '▲' : '⇅'}</span>`;
    });
  } else {
    const d = document.createElement('div'); d.className = 'sort-strip';
    d.innerHTML = `<span class="sort-lab">Sort by:</span>` + [['route', 'Journey order'], ['detour', 'Detour'], ['price', 'Price']].map(([k, w]) => `<button class="${k === by ? 'on' : ''}">${w}</button>`).join('');
    document.querySelector('.cards').before(d);
  }
};
const shots = [
  ['computer', 'A', 'route', 'light'], ['computer', 'A', 'price', 'light'], ['computer', 'B', 'price', 'light'], ['computer', 'B', 'price', 'dark'],
  ['phone', 'A', 'route', 'light'], ['phone', 'A', 'price', 'light'], ['phone', 'B', 'price', 'light'], ['phone', 'B', 'price', 'dark'],
];
(async () => {
  const b = await chromium.launch();
  for (const [dev, variant, by, theme] of shots) {
    const opts = dev === 'computer' ? { viewport: { width: 1200, height: 900 } } : { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 };
    const ctx = await b.newContext({ ...opts, colorScheme: theme });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto('http://localhost:4192/#route/RG1/BS1'); await p.waitForSelector('.notes .sname, .stations .sname, .cards .sname', { timeout: 30000 });
    await p.evaluate(inject, { variant, by });
    const name = `jsort-${dev}-${by === 'route' ? 'route' : variant}-${by}-${theme}.png`;
    const box = await p.evaluate((dev) => {
      const top = document.querySelector('.results-head').getBoundingClientRect().top + scrollY - 10;
      const last = dev === 'computer' ? document.querySelector('.table-box') : document.querySelectorAll('.cards > div')[3];
      const end = last.getBoundingClientRect().bottom + scrollY + 10;
      return { x: 0, y: top, width: innerWidth, height: end - top };
    }, dev);
    await p.screenshot({ path: OUT + name, clip: box, fullPage: true });
    console.log(name, 'overflow', await p.evaluate(() => document.documentElement.scrollWidth - innerWidth), errs.length ? errs : 'no errors');
    await ctx.close();
  }
  await b.close();
})();

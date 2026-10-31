const { chromium } = require('playwright');
const OUT = '/home/user/refueller/design/previews/';
// Draws the little chart under each price in the browser only (mock-up). Variant A: bars by pence above the cheapest;
// B: equal blocks in order (rank only); C: a dot strip from cheapest to dearest.
const inject = (variant) => {
  const css = `
  .rk{display:block;margin:4px auto 0;overflow:visible}
  .rk .o{fill:var(--color-neutral-400)} .rk .me{fill:var(--g-me)} .rk .ln{stroke:var(--color-neutral-400);stroke-width:1.5}
  .rk .tk{stroke:var(--color-neutral-500);stroke-width:1}
  .rk-t{font-size:11px;color:var(--color-neutral-700);margin-top:2px}
  .pcard .rk{margin-left:0} `;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const table = !!document.querySelector('table');
  const rows = table ? [...document.querySelectorAll('tbody tr:not(.calc-row)')] : [...document.querySelectorAll('.pcard')];
  const cellsOf = (r) => table ? [r.children[2], r.children[3]] : [r.querySelectorAll('.grid > div')[1], r.querySelectorAll('.grid > div')[3]];
  for (const f of [0, 1]) {
    const cells = rows.map((r) => cellsOf(r)[f]);
    const ps = cells.map((c) => { const e = c.querySelector('.price'); return e && !c.querySelector('.unusual') ? parseFloat(e.textContent) : null; });
    const all = ps.filter((p) => p !== null).sort((a, b) => a - b);
    const lo = all[0], hi = all[all.length - 1];
    const ord = (n) => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');
    const W = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];
    cells.forEach((c, i) => {
      const me = ps[i];
      if (me === null) return;
      const upd = c.querySelector('.upd');
      const n = all.length;
      const below = all.filter((p) => p < me).length;
      const same = all.filter((p) => p === me).length;
      let svg = '';
      if (variant === 'A') {
        const w = 8, gap = 2, H = 22, span = Math.max(hi - lo, 0.1);
        const bars = all.map((p, k) => { const h = 2 + ((p - lo) / span) * (H - 2); return `<rect x="${k * (w + gap)}" y="${H - h}" width="${w}" height="${h}" rx="2" class="${p === me ? 'me' : 'o'}"/>`; }).join('');
        svg = `<svg class="rk" width="${n * (w + gap) - gap}" height="${H}">${bars}</svg>`;
      } else if (variant === 'B') {
        const w = 10, gap = 2, H = 10;
        const bars = all.map((p, k) => `<rect x="${k * (w + gap)}" y="0" width="${w}" height="${H}" rx="2" class="${p === me ? 'me' : 'o'}"/>`).join('');
        svg = `<svg class="rk" width="${n * (w + gap) - gap}" height="${H}">${bars}</svg>`;
      } else {
        const Wd = 92, H = 14, span = Math.max(hi - lo, 0.1);
        const x = (p) => 5 + ((p - lo) / span) * (Wd - 10);
        const dots = all.filter((p) => p !== me).map((p) => `<circle cx="${x(p)}" cy="7" r="3.5" class="o"/>`).join('');
        svg = `<svg class="rk" width="${Wd}" height="${H}"><line x1="5" x2="${Wd - 5}" y1="7" y2="7" class="ln"/>${dots}<circle cx="${x(me)}" cy="7" r="5" class="me" stroke="var(--color-surface)" stroke-width="2"/></svg>`;
      }
      const diff = me - lo;
      const text = variant === 'B'
        ? (below === 0 ? `Lowest of ${W[n]}` : same > 1 ? `Joint ${ord(below + 1)} lowest of ${W[n]}` : `${ord(below + 1)} lowest of ${W[n]}`)
        : (diff < 0.05 ? `Lowest of ${W[n]}` : `${diff.toFixed(1)}p above the lowest`);
      const div = document.createElement('div');
      div.innerHTML = svg + `<div class="rk-t">${text}</div>`;
      upd.after(div);
    });
  }
};
(async () => {
  const b = await chromium.launch();
  for (const v of ['A', 'B', 'C']) {
    for (const [dev, opts] of [['computer', { viewport: { width: 1200, height: 900 } }], ['phone', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }]]) {
      const ctx = await b.newContext(opts);
      const p = await ctx.newPage();
      await p.goto('http://localhost:4188/#RG4'); await p.waitForSelector('.sname');
      await p.evaluate(inject, v);
      if (dev === 'computer') {
        const box = await p.evaluate(() => { const t = document.querySelector('.table-box').getBoundingClientRect(); const r = document.querySelectorAll('tbody tr')[3].getBoundingClientRect(); return { x: t.left, y: t.top + scrollY, width: t.width, height: r.bottom - t.top + 6 }; });
        await p.screenshot({ path: OUT + `rank-${v}-computer.png`, clip: box, fullPage: true });
      } else {
        await p.locator('.pcard').nth(5).screenshot({ path: OUT + `rank-${v}-phone.png` });
      }
      console.log(v, dev, 'overflow', await p.evaluate(() => document.documentElement.scrollWidth - innerWidth));
      await ctx.close();
    }
  }
  await b.close();
})();

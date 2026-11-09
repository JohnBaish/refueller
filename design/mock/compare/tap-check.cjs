const { chromium } = require('playwright');
// Tapping or clicking away from a chart removes its date line or label (John, November 9th 2026). Run against
// `npx vite preview --port 4198`.
(async () => {
  const b = await chromium.launch();
  const out = [];
  for (const [vp, touch] of [[{ width: 390, height: 844 }, true], [{ width: 1200, height: 900 }, false]]) {
    const p = await (await b.newContext({ viewport: vp, hasTouch: touch, isMobile: touch })).newPage();
    p.on('pageerror', (e) => out.push('ERR ' + e));
    const tapBox = async (bx) => (touch ? p.touchscreen.tap(bx.x + bx.width / 2, bx.y + bx.height / 2) : p.mouse.click(bx.x + bx.width / 2, bx.y + bx.height / 2));
    const tapEl = async (el) => {
      await el.scrollIntoViewIfNeeded();
      await tapBox(await el.boundingBox());
    };
    const tapAt = async (sel) => tapEl(await p.$(sel));
    const crosses = () => p.$$eval('.g-cross', (e) => e.length);
    await p.goto('http://localhost:4198/#RG4-7SS');
    await p.waitForSelector('.avg-sec .g-hit');
    const hits = await p.$$('.avg-sec .g-hit');
    await tapEl(hits[0]);
    const a = await crosses();
    await tapAt('.avg-sec h3');
    out.push(`${vp.width} main: after tap ${a}, after tapping away ${await crosses()}`);
    await tapEl(hits[0]);
    await tapEl(hits[1]);
    out.push(`${vp.width} main: first chart then the second, lines shown ${await crosses()}`);
    await tapAt('.avg-sec h3');
    await p.click('text=Price history');
    await p.waitForTimeout(500);
    const dots = await p.$$('.calc .g-hit');
    if (dots.length) {
      await tapEl(dots[dots.length - 1]);
      const t1 = await p.$$eval('.calc .g-tip', (e) => e.length);
      await tapAt('.calc h4, .calc p');
      out.push(`${vp.width} price history: label after tap ${t1}, after tapping away ${await p.$$eval('.calc .g-tip', (e) => e.length)}`);
    } else out.push(`${vp.width} no history dots`);
    await p.goto('http://localhost:4198/#compare');
    await p.waitForSelector('.cmp-chart .g-hit');
    await tapAt('.cmp-chart .g-hit');
    const c1 = await crosses();
    await tapAt('.cmp-table');
    out.push(`${vp.width} compare: after tap ${c1}, after tapping away ${await crosses()}`);
  }
  await b.close();
  console.log(out.join('\n'));
})();

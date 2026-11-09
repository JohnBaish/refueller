const { chromium } = require('playwright');
const fs = require('fs');
// Pictures of the "compare areas" mock-ups (November 9th 2026). Copies compare.html and data.json into dist/, then run against
// `npx vite preview --port 4196`. Also draws the proposed button into the real built page (browser only; no app code).
const DIST = '/home/user/refueller/dist/';
const OUT = '/home/user/refueller/design/previews/compare/';
fs.mkdirSync(OUT, { recursive: true });
const css = fs.readdirSync(DIST + 'assets').find((f) => /^index-.*\.css$/.test(f));
fs.writeFileSync(DIST + 'compare-mock.html', fs.readFileSync(__dirname + '/compare.html', 'utf8').replace('CSSFILE', 'assets/' + css));
fs.copyFileSync(__dirname + '/data.json', DIST + 'compare-data.json');
const SHOTS = [
  ['a-set1', 'opt=a&set=1'], ['a-set2-open', 'opt=a&set=2&open=1'], ['a-set3-diesel', 'opt=a&set=3&fuel=diesel'], ['a-periods', 'opt=a&set=1&periods=1'],
  ['b-set1', 'opt=b&set=1'], ['c-set1-open', 'opt=c&set=1&open=1'], ['c-set1', 'opt=c&set=1'],
];
(async () => {
  const b = await chromium.launch();
  const errors = [];
  for (const [w, touch] of [[1200, false], [390, true]]) for (const theme of ['light', 'dark']) {
    const dev = w > 720 ? 'computer' : 'phone';
    const ctx = await b.newContext({ viewport: { width: w, height: 900 }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 2, colorScheme: theme });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(String(e)));
    for (const [name, qs] of SHOTS) {
      if (theme === 'dark' && !['a-set1'].includes(name)) continue;
      await p.goto(`http://localhost:4196/compare-mock.html?${qs}&theme=${theme}`);
      await p.waitForSelector('body[data-ready]');
      await p.evaluate(() => document.fonts.ready);
      const sw = await p.evaluate(() => document.documentElement.scrollWidth);
      if (sw > w) errors.push(`sideways ${name} ${w}`);
      await p.screenshot({ path: `${OUT}${name}-${dev}-${theme}.png`, fullPage: true });
    }
    // The way in, on the real page: a big button under "The wider picture"'s list, before the journey planner.
    await p.goto('http://localhost:4196/#RG4-7SS');
    await p.reload();
    await p.waitForSelector('.avg-sec .lv-box');
    await p.evaluate(() => {
      const a = document.createElement('a');
      a.className = 'btn btn-secondary';
      a.style.cssText = 'display:flex;width:100%;min-height:52px;margin-top:18px;font-size:17px;gap:10px';
      a.innerHTML = '<svg width="22" height="18" viewBox="0 0 22 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 15 7 8l5 4 9-10"/><path d="M1 17h20" stroke-width="1.5"/></svg>Compare areas over time';
      document.querySelector('.lv-box').after(a);
    });
    const bx = await (await p.$('.avg-sec')).boundingBox();
    const jf = await (await p.$('.journey-front')).boundingBox();
    if ((await p.evaluate(() => document.documentElement.scrollWidth)) > w) errors.push(`sideways main ${w}`);
    await p.screenshot({ path: `${OUT}button-${dev}-${theme}.png`, fullPage: true, clip: { x: 0, y: Math.max(0, bx.y + bx.height - (w > 720 ? 520 : 760)), width: w, height: (w > 720 ? 520 : 760) + jf.height + 30 } });
    await ctx.close();
  }
  await b.close();
  console.log(errors.length ? errors.join('\n') : 'no errors, no sideways scroll');
})();

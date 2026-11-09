const { chromium } = require('playwright');
const fs = require('fs');
// Round 2 pictures of the "Compare areas" mock-up (November 9th 2026). Run against `npx vite preview --port 4196` after a build.
const DIST = '/home/user/refueller/dist/';
const OUT = '/home/user/refueller/design/previews/compare/r2-';
const css = fs.readdirSync(DIST + 'assets').find((f) => /^index-.*\.css$/.test(f));
fs.writeFileSync(DIST + 'round2.html', fs.readFileSync(__dirname + '/round2.html', 'utf8').replace('CSSFILE', 'assets/' + css));
fs.copyFileSync(__dirname + '/round2.js', DIST + 'round2.js');
fs.copyFileSync(__dirname + '/data.json', DIST + 'compare-data.json');
const SHOTS = [
  ['unleaded', 'fuel=e10&set=1'], ['both-change', 'fuel=both&view=change&set=1'], ['both-price', 'fuel=both&view=price&set=1'],
  ['woodley-open', 'fuel=e10&set=5&open=woodley'], ['woodley', 'fuel=diesel&set=4'],
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
      if (theme === 'dark' && name !== 'both-change') continue;
      await p.goto(`http://localhost:4196/round2.html?${qs}&theme=${theme}`);
      await p.waitForSelector('body[data-ready]');
      await p.evaluate(() => document.fonts.ready);
      if ((await p.evaluate(() => document.documentElement.scrollWidth)) > w) errors.push(`sideways ${name} ${w}`);
      await p.screenshot({ path: `${OUT}${name}-${dev}-${theme}.png`, fullPage: true });
    }
    await ctx.close();
  }
  // The picture that "Share chart" would make: always light, 1200px wide.
  const ctx = await b.newContext({ viewport: { width: 1200, height: 700 }, deviceScaleFactor: 1, colorScheme: 'light' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(String(e)));
  for (const [name, qs] of [['img-unleaded', 'fuel=e10&set=1&img=1'], ['img-both', 'fuel=both&view=change&set=1&img=1']]) {
    await p.goto(`http://localhost:4196/round2.html?${qs}`);
    await p.waitForSelector('body[data-ready]');
    await p.evaluate(() => document.fonts.ready);
    const box = await (await p.$('.shot')).boundingBox();
    await p.screenshot({ path: `${OUT}${name}.png`, clip: box });
  }
  await b.close();
  console.log(errors.length ? errors.join('\n') : 'no errors, no sideways scroll');
})();

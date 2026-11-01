const { chromium } = require('playwright');
// A key above "The wider picture"'s charts (November 1st 2026), drawn into the built page in the browser only; no app code.
// Run against `npx vite preview --port 4194`. A: one key line under the opening sentence, as before the list moved under the
// charts. B: the key beside each chart's heading.
const OUT = '/home/user/refueller/design/previews/key/';
const inject = (variant) => {
  const sec = document.querySelector('.avg-sec');
  const key = () => {
    const d = document.createElement('div');
    d.className = 'hist-legend';
    d.innerHTML = '<span><i class="a-key-eight"></i>These eight stations</span><span><i class="a-key-gb"></i>Great Britain</span>';
    return d;
  };
  if (variant === 'a') sec.querySelector('.avg-charts').before(key());
  else
    sec.querySelectorAll('.avg-ch h4').forEach((h) => {
      const k = key();
      k.style.cssText = 'display:inline-flex;margin:0 0 0 14px;font-weight:400;vertical-align:middle';
      h.appendChild(k);
    });
};
(async () => {
  const b = await chromium.launch();
  const errors = [];
  for (const [w, touch] of [[1200, false], [390, true]]) for (const theme of ['light', 'dark']) for (const v of ['a', 'b']) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 2, colorScheme: theme });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(String(e)));
    await p.goto('http://localhost:4194/#RG4-7SS');
    await p.reload();
    await p.waitForSelector('.avg-sec svg');
    await p.evaluate(inject, v);
    const sw = await p.evaluate(() => document.documentElement.scrollWidth);
    if (sw > w) errors.push(`sideways scroll ${v} ${w}`);
    const bx = await (await p.$('.avg-sec')).boundingBox();
    const ch = await (await p.$('.avg-charts')).boundingBox();
    await p.screenshot({ path: `${OUT}key-${v}-${w > 720 ? 'computer' : 'phone'}-${theme}.png`, fullPage: true, clip: { x: 0, y: bx.y - 20, width: w, height: ch.y + ch.height - bx.y + 60 } });
    await ctx.close();
  }
  await b.close();
  console.log(errors.length ? errors.join('\n') : 'no errors, no sideways scroll');
})();

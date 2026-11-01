const { chromium } = require('playwright');
// Checks the built short key (`npx vite preview --port 4195`): one line on a computer, beside each heading on a phone.
(async () => {
  const b = await chromium.launch();
  const errors = [];
  for (const [w, touch] of [[1200, false], [390, true], [320, true]]) for (const theme of ['light', 'dark']) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 2, colorScheme: theme });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(String(e)));
    for (const hash of ['RG4-7SS', 'CF10-1EP']) {
      await p.goto(`http://localhost:4195/#${hash}`);
      await p.reload();
      await p.waitForSelector('.avg-sec svg');
      const keys = await p.$$eval('.avg-sec .avg-key', (k) => k.map((x) => (x.classList.contains('avg-key-inline') ? 'inline' : 'line')));
      const sw = await p.evaluate(() => document.documentElement.scrollWidth);
      if (sw > w) errors.push(`sideways scroll ${hash} ${w}`);
      console.log(w, theme, hash, keys.join(' '));
      if (hash === 'RG4-7SS') {
        const bx = await (await p.$('.avg-sec')).boundingBox();
        const ch = await (await p.$('.avg-charts')).boundingBox();
        await p.screenshot({ path: `/home/user/refueller/design/previews/key/built-${w}-${theme}.png`, fullPage: true, clip: { x: 0, y: bx.y - 20, width: w, height: ch.y + ch.height - bx.y + 40 } });
      }
    }
    await ctx.close();
  }
  await b.close();
  console.log(errors.length ? errors.join('\n') : 'no errors, no sideways scroll');
})();

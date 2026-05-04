const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const outDir = path.resolve('output/web-game/plan-parts');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

async function shot(page, name) {
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true });
  const state = await page.evaluate(() => window.render_game_to_text?.() ?? '{}');
  fs.writeFileSync(path.join(outDir, `${name}.json`), state);
}

async function advance(page, ms) {
  await page.evaluate(async (duration) => {
    if (typeof window.advanceTime === 'function') await window.advanceTime(duration);
    else await new Promise((resolve) => setTimeout(resolve, duration));
  }, ms);
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 480, height: 854 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.goto('http://localhost:3001', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__sparkleWashTest && !!window.render_game_to_text, null, { timeout: 10000 });
  await page.evaluate(() => window.__sparkleWashTest.resetProgress());
  await advance(page, 2500);
  await shot(page, 'arrival-or-cleaning');

  await page.mouse.click(240, 390);
  await advance(page, 400);
  await shot(page, 'cleaning-start');

  for (let i = 0; i < 4; i++) {
    await page.mouse.move(200, 235);
    await page.mouse.down();
    await page.mouse.move(280, 235, { steps: 8 });
    await page.mouse.up();
    await advance(page, 120);
  }
  await shot(page, 'after-hood-clean');

  for (let i = 0; i < 9; i++) {
    const y = 230 + i * 48;
    await page.mouse.move(190, y);
    await page.mouse.down();
    await page.mouse.move(290, y, { steps: 10 });
    await page.mouse.up();
    await advance(page, 90);
  }
  await advance(page, 2600);
  await shot(page, 'after-wide-clean');

  fs.writeFileSync(path.join(outDir, 'console-errors.json'), JSON.stringify(errors, null, 2));
  await browser.close();
})().catch((err) => { console.error(err); process.exit(1); });

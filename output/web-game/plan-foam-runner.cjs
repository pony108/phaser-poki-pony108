const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const outDir = path.resolve('output/web-game/plan-foam');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

async function advance(page, ms) {
  await page.evaluate(async (duration) => {
    if (typeof window.advanceTime === 'function') await window.advanceTime(duration);
    else await new Promise((resolve) => setTimeout(resolve, duration));
  }, ms);
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true });
  const state = await page.evaluate(() => window.render_game_to_text?.() ?? '{}');
  fs.writeFileSync(path.join(outDir, `${name}.json`), state);
}

async function dragLine(page, x1, y1, x2, y2, passes = 1) {
  for (let i = 0; i < passes; i++) {
    await page.mouse.move(x1, y1);
    await page.mouse.down();
    await page.mouse.move(x2, y2, { steps: 10 });
    await page.mouse.up();
    await advance(page, 100);
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 480, height: 854 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.goto('http://localhost:3001', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__sparkleWashTest && !!window.render_game_to_text, null, { timeout: 10000 });
  await page.evaluate(() => { window.__sparkleWashTest.resetProgress(); window.__sparkleWashTest.startLevel(6); });
  await advance(page, 2600);
  await page.mouse.click(240, 390);
  await advance(page, 350);
  await shot(page, 'level6-start');

  await page.mouse.click(340, 784); // JET
  await advance(page, 150);
  await dragLine(page, 190, 280, 290, 280, 2);
  await shot(page, 'jet-before-foam');

  await page.mouse.click(240, 784); // FOAM
  await advance(page, 150);
  await dragLine(page, 170, 260, 310, 260, 2);
  await dragLine(page, 170, 330, 310, 330, 2);
  await dragLine(page, 170, 400, 310, 400, 2);
  await shot(page, 'foam-prepped');

  await page.mouse.click(340, 784); // JET
  await advance(page, 150);
  await dragLine(page, 180, 300, 300, 300, 3);
  await dragLine(page, 180, 360, 300, 360, 3);
  await shot(page, 'jet-after-foam');

  fs.writeFileSync(path.join(outDir, 'console-errors.json'), JSON.stringify(errors, null, 2));
  await browser.close();
})().catch((err) => { console.error(err); process.exit(1); });

// Mobile QA for this session's additions: capture editor layout modes
// (corner/center/fullscreen), the slash-command menu, and the login page.
const { chromium } = require('playwright');
const BASE = 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    hasTouch: true,
    isMobile: true,
  });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`CONSOLE: ${m.text().slice(0, 200)}`); });
  page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message.slice(0, 200)}`));

  const results = [];
  function log(name, ok, detail = '') {
    results.push({ name, ok });
    console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
  }
  async function overflow() {
    return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  }

  // Capture editor: open, check each layout mode renders without overflow
  await page.goto(`${BASE}/inbox`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.locator('text=New page').first().click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'qa-screenshots/mobile-capture-corner.png' });
  log('Capture editor (corner, default): no overflow', !(await overflow()));

  const layoutButtons = page.locator('button[title="Centralizado"], button[title="Tela cheia"], button[title="Canto"]');
  const btnCount = await layoutButtons.count();
  log('Layout switcher buttons present on mobile', btnCount === 3, `found ${btnCount}`);

  if (btnCount === 3) {
    await page.locator('button[title="Centralizado"]').click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'qa-screenshots/mobile-capture-center.png' });
    log('Capture editor (centered): no overflow', !(await overflow()));

    await page.locator('button[title="Tela cheia"]').click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'qa-screenshots/mobile-capture-fullscreen.png' });
    log('Capture editor (fullscreen): no overflow', !(await overflow()));

    await page.locator('button[title="Canto"]').click();
    await page.waitForTimeout(800);
  }

  // Slash command on mobile (touch-typed via fill-then-key isn't realistic for
  // IME, but Playwright's type() dispatches real key events same as desktop)
  try {
    const editorBody = page.locator('.ProseMirror').last();
    await editorBody.click();
    await page.keyboard.type('/');
    await page.waitForTimeout(500);
    const menuVisible = await page.locator('text=Título 1').first().isVisible().catch(() => false);
    log('Slash command menu appears on mobile viewport', menuVisible);
    if (menuVisible) {
      await page.screenshot({ path: 'qa-screenshots/mobile-slash-menu.png' });
    }
    await page.keyboard.press('Escape');
  } catch (e) {
    log('Slash command on mobile', false, e.message.slice(0, 150));
  }

  // Login page
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'qa-screenshots/mobile-login.png' });
  log('Login page: no overflow', !(await overflow()));

  await browser.close();

  console.log('\n=== SUMMARY ===');
  const failed = results.filter(r => !r.ok);
  console.log(`${results.length - failed.length}/${results.length} passed`);
  if (errors.length) {
    console.log('\n=== CONSOLE/PAGE ERRORS ===');
    console.log(errors.join('\n'));
  } else {
    console.log('No console/page errors.');
  }
})();

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:3000';
const DIR = path.join(__dirname, 'qa-screenshots');
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR);

const pages = [
  { path: '/', name: '01-dashboard' },
  { path: '/inbox', name: '02-inbox' },
  { path: '/visao', name: '03-visao' },
  { path: '/pilares', name: '04-pilares' },
  { path: '/projetos', name: '05-projetos' },
  { path: '/tarefas', name: '06-tarefas' },
  { path: '/conteudo', name: '07-conteudo' },
  { path: '/indicadores', name: '08-indicadores' },
  { path: '/financeiro', name: '09-financeiro' },
  { path: '/diario', name: '10-diario' },
];

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();

  const allErrors = {};

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const url = page.url();
      allErrors[url] = allErrors[url] || [];
      allErrors[url].push(`CONSOLE: ${msg.text().slice(0, 300)}`);
    }
  });
  page.on('pageerror', (err) => {
    const url = page.url();
    allErrors[url] = allErrors[url] || [];
    allErrors[url].push(`PAGEERROR: ${err.message.slice(0, 300)}`);
  });

  for (const p of pages) {
    try {
      await page.goto(`${BASE}${p.path}`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(700);
      await page.screenshot({ path: path.join(DIR, `${p.name}-mobile.png`) });

      // check for horizontal overflow (classic mobile bug)
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        bodyScrollWidth: document.body.scrollWidth,
      }));
      if (overflow.scrollWidth > overflow.clientWidth + 2) {
        allErrors[p.path] = allErrors[p.path] || [];
        allErrors[p.path].push(`HORIZONTAL OVERFLOW: scrollWidth=${overflow.scrollWidth} > clientWidth=${overflow.clientWidth} (body scrollWidth=${overflow.bodyScrollWidth})`);
      }

      console.log(`✅ ${p.name} mobile captured (scrollWidth=${overflow.scrollWidth}, clientWidth=${overflow.clientWidth})`);
    } catch (e) {
      allErrors[p.path] = allErrors[p.path] || [];
      allErrors[p.path].push(`NAV ERROR: ${e.message}`);
      console.log(`❌ ${p.name}: ${e.message}`);
    }
  }

  // Test mobile menu (hamburger) on dashboard
  try {
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const hamburger = page.locator('button').first();
    await hamburger.click({ timeout: 3000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(DIR, '11-mobile-menu-open.png') });
    console.log('✅ mobile menu screenshot captured');
  } catch (e) {
    console.log(`❌ mobile menu: ${e.message}`);
  }

  await browser.close();

  const errorFile = path.join(DIR, 'errors.json');
  fs.writeFileSync(errorFile, JSON.stringify(allErrors, null, 2));
  console.log('\n=== ERRORS FOUND ===');
  console.log(JSON.stringify(allErrors, null, 2));
})();

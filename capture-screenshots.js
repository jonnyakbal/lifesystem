const { chromium } = require('playwright');
const path = require('path');

const BASE = 'http://localhost:3000';
const DIR = path.join(__dirname, 'screenshots');

const pages = [
  { path: '/', name: '01-dashboard' },
  { path: '/inbox', name: '02-inbox' },
  { path: '/tarefas', name: '03-tarefas' },
  { path: '/projetos', name: '04-projetos' },
  { path: '/conteudo', name: '05-conteudo' },
  { path: '/financeiro', name: '06-financeiro' },
  { path: '/diario', name: '07-diario' },
  { path: '/pilares', name: '08-pilares' },
  { path: '/indicadores', name: '09-indicadores' },
  { path: '/visao', name: '10-visao' },
];

(async () => {
  const browser = await chromium.launch();
  
  // Desktop screenshots
  console.log('=== DESKTOP (1440x900) ===');
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const dPage = await desktop.newPage();
  
  for (const p of pages) {
    try {
      await dPage.goto(`${BASE}${p.path}`, { waitUntil: 'networkidle', timeout: 15000 });
      await dPage.waitForTimeout(800); // Wait for animations
      const file = path.join(DIR, `${p.name}-desktop.png`);
      await dPage.screenshot({ path: file, fullPage: false });
      console.log(`  ✅ ${p.name}-desktop.png`);
    } catch (e) {
      console.log(`  ❌ ${p.name}: ${e.message}`);
    }
  }
  await desktop.close();

  // Mobile screenshots
  console.log('\n=== MOBILE (375x812) ===');
  const mobile = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const mPage = await mobile.newPage();
  
  for (const p of pages) {
    try {
      await mPage.goto(`${BASE}${p.path}`, { waitUntil: 'networkidle', timeout: 15000 });
      await mPage.waitForTimeout(800);
      const file = path.join(DIR, `${p.name}-mobile.png`);
      await mPage.screenshot({ path: file, fullPage: false });
      console.log(`  ✅ ${p.name}-mobile.png`);
    } catch (e) {
      console.log(`  ❌ ${p.name}: ${e.message}`);
    }
  }
  await mobile.close();

  // Bonus: full-page scrollable screenshots for key pages
  console.log('\n=== FULL PAGE SCROLLS ===');
  const full = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const fPage = await full.newPage();
  
  for (const p of pages.slice(0, 5)) {
    try {
      await fPage.goto(`${BASE}${p.path}`, { waitUntil: 'networkidle', timeout: 15000 });
      await fPage.waitForTimeout(800);
      const file = path.join(DIR, `${p.name}-full.png`);
      await fPage.screenshot({ path: file, fullPage: true });
      console.log(`  ✅ ${p.name}-full.png`);
    } catch (e) {
      console.log(`  ❌ ${p.name}: ${e.message}`);
    }
  }
  await full.close();

  await browser.close();
  console.log('\nDone! Screenshots saved to /screenshots/');
})();

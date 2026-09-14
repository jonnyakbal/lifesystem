import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import sharp from 'sharp';

const routes = ['/', '/inbox', '/hoje', '/planejar', '/visao', '/projetos', '/tarefas', '/conteudo', '/indicadores', '/editais', '/financeiro', '/diario', '/diario-bordo', '/hermes', '/notas', '/revisao'];
const output = 'screenshots/astral-review';
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch();
const report = [];
try {
  for (const mode of ['desktop-dark', 'mobile-light']) {
    const context = await browser.newContext({ viewport: mode === 'desktop-dark' ? { width: 1440, height: 1000 } : { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await context.addInitScript(theme => localStorage.setItem('lifesystem-theme', theme), mode.endsWith('light') ? 'light' : 'dark');
    const page = await context.newPage();
    for (const route of routes) {
      const errors = [];
      const listener = error => errors.push(error.message);
      page.on('pageerror', listener);
      await page.goto(`http://localhost:3000${route}`, { waitUntil: 'networkidle' });
      await page.locator('main').waitFor();
      await page.waitForTimeout(600);
      const name = route === '/' ? 'home' : route.slice(1);
      await page.screenshot({ path: `${output}/${mode}-${name}.png` });
      const info = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, heading: document.querySelector('main h1')?.textContent, text: document.querySelector('main')?.textContent?.length || 0 }));
      report.push({ route, mode, ...info, errors });
      console.log(mode, route, JSON.stringify({ ...info, errors }));
      page.off('pageerror', listener);
    }
    const thumbs = await Promise.all(routes.map(async (route, i) => ({ input: await sharp(`${output}/${mode}-${route === '/' ? 'home' : route.slice(1)}.png`).resize(360, 250, { fit: 'contain', background: '#ccc' }).toBuffer(), left: (i % 4) * 360, top: Math.floor(i / 4) * 250 })));
    await sharp({ create: { width: 1440, height: 1000, channels: 3, background: '#ccc' } }).composite(thumbs).png().toFile(`${output}/${mode}-overview.png`);
    await context.close();
  }
} finally { await browser.close(); }
await fs.writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));

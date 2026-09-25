import { test, expect } from '@playwright/test';

const PAGES = [
  { name: 'home', path: '/' },
  { name: 'hoje', path: '/hoje' },
  { name: 'inbox', path: '/inbox' },
  { name: 'fontes', path: '/content-hub' },
  { name: 'notas', path: '/notas' },
  { name: 'planejar', path: '/planejar' },
  { name: 'visao', path: '/visao' },
  { name: 'projetos', path: '/projetos' },
  { name: 'tarefas', path: '/tarefas' },
  { name: 'conteudo', path: '/conteudo' },
  { name: 'indicadores', path: '/indicadores' },
  { name: 'editais', path: '/editais' },
  { name: 'financeiro', path: '/financeiro' },
  { name: 'diario', path: '/diario' },
  { name: 'diario-bordo', path: '/diario-bordo' },
  { name: 'hermes', path: '/hermes' },
  { name: 'pilares', path: '/pilares' },
  { name: 'revisao', path: '/revisao' },
];

test.describe('Full UI Audit', () => {
  for (const page of PAGES) {
    test(`${page.name} — desktop screenshot + console errors`, async ({ page: p }) => {
      const consoleErrors: string[] = [];
      p.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      p.on('pageerror', err => consoleErrors.push(err.message));

      await p.goto(page.path, { waitUntil: 'networkidle', timeout: 30000 });
      await p.waitForTimeout(1000);

      await p.screenshot({
        path: `test-results/ui-audit/${page.name}-desktop.png`,
        fullPage: false,
      });

      expect(consoleErrors, `Erros no console de ${page.name}`).toEqual([]);
    });

    test(`${page.name} — mobile screenshot`, async ({ page: p }) => {
      const pageErrors: string[] = [];
      p.on('pageerror', err => pageErrors.push(err.message));
      await p.setViewportSize({ width: 390, height: 844 });
      await p.goto(page.path, { waitUntil: 'networkidle', timeout: 30000 });
      await p.waitForTimeout(1000);

      await p.screenshot({
        path: `test-results/ui-audit/${page.name}-mobile.png`,
        fullPage: false,
      });
      expect(pageErrors, `Erros de execução em ${page.name} no celular`).toEqual([]);
    });
  }
});

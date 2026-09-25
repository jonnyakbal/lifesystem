import { test, expect } from '@playwright/test';

const routes = [
  '/', '/hoje', '/inbox', '/planejar', '/tarefas', '/projetos', '/conteudo',
  '/content-hub', '/editais', '/notas', '/indicadores', '/financeiro',
  '/diario', '/visao', '/pilares', '/revisao', '/diario-bordo', '/hermes',
];

for (const width of [390, 1440]) {
  test(`rotas principais carregam sem erro de execução em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      const errors: string[] = [];
      const listener = (error: Error) => errors.push(error.message);
      page.on('pageerror', listener);
      const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('main').first()).toBeVisible();
      expect(response?.status(), route).toBeLessThan(400);
      expect(errors, route).toEqual([]);
      page.off('pageerror', listener);
    }
  });
}

import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_STAGES } from '../src/lib/default-stages';

const createdAt = '2026-10-01T12:00:00Z';
const updatedAt = '2026-10-20T12:00:00Z';
const project = (id: string, status: string) => ({
  id, name: `Projeto sintético ${id}`, status, createdAt, updatedAt,
  description: '', tags: [], links: [],
});

async function mockWorkspace(page: Page, projects: ReturnType<typeof project>[], stages: unknown, unavailable = false) {
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/projects') return route.fulfill({ json: projects });
    if (path === '/api/stage-configs/projects') {
      return unavailable
        ? route.fulfill({ status: 503, json: { error: 'Configuração temporariamente indisponível.' } })
        : route.fulfill({ json: { scope: 'projects', stages } });
    }
    return route.fulfill({ json: [] });
  });
}

test('Visão renders terminal, custom and removed project stages without crashing', async ({ page }) => {
  await mockWorkspace(page, [project('finalizado', 'completed'), project('customizado', 'validation'), project('legado', 'legacy-stage')], [
    ...DEFAULT_STAGES.projects,
    { id: 'completed', label: 'Concluído', color: 'text-money', dot: 'bg-money', isTerminal: true },
    { id: 'validation', label: 'Em validação', color: 'text-blue-500', dot: 'bg-blue-500' },
  ]);
  await page.goto('/visao');
  await expect(page.getByRole('heading', { name: 'Plano de Voo', exact: true })).toBeVisible();
  for (const id of ['finalizado', 'customizado', 'legado']) {
    await expect(page.getByText(`Projeto sintético ${id}`, { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: `Ver projeto Projeto sintético ${id}` })).toHaveAttribute('href', `/projetos?open=${id}`);
  }
  await expect(page.getByText('Concluído', { exact: true })).toBeVisible();
  await expect(page.getByText('Em validação', { exact: true })).toBeVisible();
  await expect(page.getByText('legacy-stage', { exact: true })).toBeVisible();
  await expect(page.getByText('Algo deu errado', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Escrever Identidade' })).toBeEnabled();
});

test('Visão keeps project names and safe status labels when stage configuration is unavailable', async ({ page }) => {
  await mockWorkspace(page, [project('ativo', 'active'), project('removido', 'removed-stage'), project('sem-etapa', '')], null, true);
  await page.goto('/visao');
  for (const id of ['ativo', 'removido', 'sem-etapa']) {
    await expect(page.getByText(`Projeto sintético ${id}`, { exact: true })).toBeVisible();
  }
  await expect(page.getByText('Ativo', { exact: true })).toBeVisible();
  await expect(page.getByText('removed-stage', { exact: true })).toBeVisible();
  await expect(page.getByText('Sem etapa', { exact: true })).toBeVisible();
  await expect(page.getByText('Algo deu errado', { exact: true })).toHaveCount(0);
});

test('Visão uses configured labels and retains mobile access to the plan and pillars', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockWorkspace(page, [project('renomeado', 'active')], [
    ...DEFAULT_STAGES.projects.filter(stage => stage.id !== 'active'),
    { id: 'active', label: 'Em execução', color: 'text-primary', dot: 'bg-primary' },
  ]);
  await page.goto('/visao');
  await expect(page.getByText('Em execução', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Escrever Identidade' })).toBeEnabled();
  await page.getByRole('navigation', { name: 'Áreas da visão' }).getByRole('link', { name: 'Pilares', exact: true }).click();
  await expect(page).toHaveURL(/\/visao\?tab=pilares$/);
  await expect(page.getByText('Algo deu errado', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

import { expect, test } from '@playwright/test';

const day = (offset: number) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toLocaleDateString('en-CA'); };

test('Editais: lista em linhas com contagem regressiva e prazo sem alarme depois de inscrever', async ({ page }) => {
  await page.route('**/api/stage-configs/editais', route => route.fulfill({ json: { stages: [
    { id: 'radar', label: 'Radar', dot: 'bg-slate-400', color: '' }, { id: 'em_analise', label: 'Em análise', dot: 'bg-amber-400', color: '' },
    { id: 'inscrito', label: 'Inscrito', dot: 'bg-blue-400', color: '' }, { id: 'resultado', label: 'Resultado', dot: 'bg-emerald-400', color: '', isTerminal: true },
  ] } }));
  await page.route('**/api/editais', route => route.fulfill({ json: [
    { id: 'e1', title: 'Edital sintético perto', orgao: 'Órgão teste', prazoInscricao: day(5), stage: 'radar', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' },
    { id: 'e2', title: 'Edital sintético inscrito', prazoInscricao: day(-2), stage: 'inscrito', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' },
    { id: 'e3', title: 'Edital sintético perdido', prazoInscricao: day(-2), stage: 'radar', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' },
  ] }));
  await page.goto('/editais');
  await expect(page.getByRole('heading', { name: 'Editais', level: 1 })).toBeVisible();
  const list = page.getByRole('list', { name: 'Lista de editais' });
  const near = list.getByRole('listitem').filter({ hasText: 'Edital sintético perto' });
  await expect(near.getByText('em 5 dias', { exact: true })).toBeVisible();
  // Depois de inscrito, prazo vencido é o esperado: sem vermelho. Antes, é alarme.
  await expect(list.getByRole('listitem').filter({ hasText: 'inscrito' }).getByText('encerrado')).not.toHaveClass(/text-destructive/);
  await expect(list.getByRole('listitem').filter({ hasText: 'perdido' }).getByText('encerrado')).toHaveClass(/text-destructive/);
  await expect(page.getByText('fecham em 14 dias')).toBeVisible();
  await page.getByRole('button', { name: 'Mais ações de editais' }).click();
  await expect(page.getByRole('menuitem', { name: 'Cockpit da automação' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Editar etapas' })).toBeVisible();
  await page.keyboard.press('Escape');
  await list.getByRole('button', { name: 'Abrir edital Edital sintético perto' }).click();
  await expect(page.getByRole('textbox', { name: 'Título do edital' })).toHaveValue('Edital sintético perto');
});

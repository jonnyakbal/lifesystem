import { test, expect, type APIRequestContext } from '@playwright/test';
import type { Task } from '../src/types';

async function create(request: APIRequestContext, title: string, extra = {}) {
  const result = await request.post('/api/tasks', { data: { title, ...extra } });
  expect(result.ok()).toBe(true); return result.json() as Promise<Task>;
}
test('editor, lista e foco deixam os vínculos visíveis e preservam tarefa em falha de conclusão', async ({ page, request }) => {
  const base = await create(request, 'QA vínculo · principal');
  const child = await create(request, 'QA vínculo · executar', { parentId: base.id });
  try {
    await page.goto('/tarefas'); await page.getByPlaceholder('Buscar tarefas...').fill('QA vínculo');
    await page.getByRole('button', { name: 'Visualização: Lista', exact: true }).click();
    const row = page.getByTestId(`task-row-${child.id}`);
    await row.getByRole('button', { name: child.title, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Editar Tarefa' });
    await expect(dialog.getByLabel('Tarefa principal', { exact: true })).toHaveValue(base.id);
    await dialog.getByLabel('Esforço previsto · minutos').fill('90');
    await dialog.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(row.getByText('90 min previstos', { exact: true })).toBeVisible();
    await expect.poll(async () => (await (await request.get(`/api/tasks/${child.id}`)).json()).estimatedMinutes).toBe(90);
    const parentRow = page.getByTestId(`task-row-${base.id}`);
    await expect(parentRow.getByRole('button', { name: '0/1 subtarefas', exact: true })).toBeVisible();
    await parentRow.getByRole('button', { name: `Concluir ${base.title}`, exact: true }).click();
    await expect(page.getByText('Conclua ou desvincule as subtarefas antes de concluir a tarefa principal.', { exact: true })).toBeVisible();
    expect((await (await request.get(`/api/tasks/${base.id}`)).json()).status).toBe('todo');
    await page.getByRole('button', { name: 'Visualização: Foco', exact: true }).click();
    await page.getByRole('button', { name: `Focar ${child.title}`, exact: true }).click();
    await expect(page.getByRole('region', { name: 'Tarefa em foco' }).getByText('90 min previstos')).toBeVisible();
  } finally { await request.delete(`/api/tasks/${child.id}`); await request.delete(`/api/tasks/${base.id}`); }
});
test('jornada de Carga é editável e calendário mantém previsão separada de horas livres', async ({ page, request }) => {
  const task = await create(request, 'QA esforço futuro', { dueDate: '2027-01-04', estimatedMinutes: 90 });
  const original = await (await request.get('/api/planning-preferences')).json();
  try {
    await page.goto('/tarefas'); await page.getByPlaceholder('Buscar tarefas...').fill(task.title);
    await page.getByRole('button', { name: 'Visualização: Carga', exact: true }).click();
    await page.getByLabel('Semana da carga', { exact: true }).fill('2027-01-04');
    await expect(page.getByText('Esforço previsto', { exact: true }).locator('..').locator('strong')).toHaveText('1,5h');
    await expect(page.getByRole('button', { name: 'Configurar capacidade', exact: true })).toBeVisible();
    expect((await (await request.get(`/api/tasks/${task.id}`)).json()).planning).toBeUndefined();
  } finally { await request.put('/api/planning-preferences', { data: original }); await request.delete(`/api/tasks/${task.id}`); }
});

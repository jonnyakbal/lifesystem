import { expect, test } from '@playwright/test';
import { parseQuickAdd } from '../src/lib/task-quick-add';

const projects = [{ id: 'p-arco', name: 'ARCO LABS' }, { id: 'p-atelie', name: 'Ateliê Studio' }];
const now = new Date(2026, 9, 24, 10); // sábado, 24/10/2026

test('criação rápida reconhece projeto, prioridade, prazo e tags', () => {
  const result = parseQuickAdd('Gravar teaser #arco !alta @sex #evento', projects, now);
  expect(result.title).toBe('Gravar teaser');
  expect(result.projectId).toBe('p-arco');
  expect(result.priority).toBe('urgent');
  expect(result.dueDate).toBe('2026-10-30');
  expect(result.tags).toEqual(['evento']);
});

test('criação rápida entende hoje, amanhã e datas sem confundir texto comum', () => {
  expect(parseQuickAdd('Pagar conta @hoje', projects, now).dueDate).toBe('2026-10-24');
  expect(parseQuickAdd('Ligar @amanhã !importante', projects, now)).toMatchObject({ dueDate: '2026-10-25', priority: 'important', title: 'Ligar' });
  expect(parseQuickAdd('Edital @05/01', projects, now).dueDate).toBe('2027-01-05');
  const plain = parseQuickAdd('Email para @fulano sobre 50% !?', projects, now);
  expect(plain.title).toBe('Email para @fulano sobre 50% !?');
  expect(plain.dueDate).toBeUndefined();
  expect(plain.priority).toBeUndefined();
  expect(parseQuickAdd('Data inválida @31/02', projects, now).dueDate).toBeUndefined();
});

test('nova tarefa pela tecla N usa os atalhos e cria com os campos certos', async ({ page, request }) => {
  const title = 'QA rápida via tecla';
  try {
    await page.goto('/tarefas');
    await page.getByRole('button', { name: 'Visualização: Lista', exact: true }).waitFor();
    await page.keyboard.press('n');
    const dialog = page.getByRole('dialog', { name: 'Nova Tarefa' });
    await dialog.getByLabel('Título da tarefa', { exact: true }).fill(`${title} !urgente @amanhã #qa`);
    await expect(dialog.getByLabel('Atalhos reconhecidos')).toContainText('Urgente');
    await dialog.getByLabel('Título da tarefa', { exact: true }).press('Enter');
    await expect(dialog).toHaveCount(0);
    await expect.poll(async () => (await (await request.get('/api/tasks')).json()).find((item: { title: string }) => item.title === title)).toMatchObject({ priority: 'urgent', tags: ['qa'] });
  } finally {
    const all = await (await request.get('/api/tasks')).json();
    for (const item of all.filter((item: { title: string }) => item.title === title)) await request.delete(`/api/tasks/${item.id}`);
  }
});

test('painel salva sozinho a edição e fecha sem botão Salvar', async ({ page, request }) => {
  const task = await (await request.post('/api/tasks', { data: { title: 'QA salvamento automático', status: 'todo', priority: 'normal' } })).json();
  try {
    await page.goto('/tarefas');
    await page.getByRole('button', { name: task.title, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Editar Tarefa' });
    await dialog.getByLabel('Descrição da tarefa').fill('Nota salva sozinha');
    await expect.poll(async () => (await (await request.get(`/api/tasks/${task.id}`)).json()).description, { timeout: 8000 }).toBe('Nota salva sozinha');
    await expect(dialog.getByRole('status')).toHaveText('Salvo');
    await dialog.getByLabel('Novo passo').fill('Passo criado no painel');
    await dialog.getByLabel('Novo passo').press('Enter');
    await dialog.getByRole('button', { name: 'Fechar', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect.poll(async () => (await (await request.get(`/api/tasks/${task.id}`)).json()).checklist?.[0]?.text).toBe('Passo criado no painel');
  } finally { await request.delete(`/api/tasks/${task.id}`); }
});

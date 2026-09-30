import { test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { storage } from '../src/lib/storage';
import { getFinancialCategories, saveFinancialCategory, getFinancialDisplayEntries, getFinancialDisplayBudgets } from '../src/lib/financial-categories';
import type { FinancialCategory } from '../src/lib/financial-categories';

test('renomear categoria preserva histórico e não muda valores, status ou datas', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ls-financial-category-'));
  const prior = process.env.LIFESYSTEM_DATA_DIR; process.env.LIFESYSTEM_DATA_DIR = dir;
  try {
    const entry = await storage.create('financial', { type: 'income', category: 'Serviços', amount: 125, status: 'pending', date: '2030-01-01', dueDate: '2030-02-01' });
    const category = (await getFinancialCategories()).find(item => item.type === 'income' && item.name === 'Serviços')!;
    const updated = await saveFinancialCategory({ id: category.id, expectedRevision: category.revision, name: 'Serviços criativos', color: '#00aabb', type: 'income' });
    expect(updated.aliases).toContain('Serviços');
    await storage.create('budgets', { type: 'income', category: 'Serviços', monthlyLimit: 100 });
    expect((await getFinancialDisplayEntries())[0].category).toBe('Serviços criativos');
    expect((await getFinancialDisplayBudgets())[0].category).toBe('Serviços criativos');
    const moved = await saveFinancialCategory({ id: updated.id, expectedRevision: 1, name: updated.name, color: updated.color, type: 'expense_variable', archived: true });
    expect(moved.archived).toBe(true);
    await expect(saveFinancialCategory({ expectedRevision: 0, name: 'Serviços', color: '#000000', type: 'income' })).rejects.toThrow('histórico');
    expect(await storage.getById('financial', entry.id)).toEqual(entry);
    expect((await getFinancialCategories()).filter(item => item.type === 'income' && item.name === 'Serviços')).toHaveLength(0);
    expect((await getFinancialCategories()).filter(item => item.name === 'Serviços criativos')).toHaveLength(1);
    await expect(saveFinancialCategory({ id: category.id, expectedRevision: 0, name: 'Outra versão', color: '#000000', type: 'income' })).rejects.toThrow('versão');
  } finally { if (prior === undefined) delete process.env.LIFESYSTEM_DATA_DIR; else process.env.LIFESYSTEM_DATA_DIR = prior; await rm(dir, { recursive: true, force: true }); }
});

test('cadastros financeiros permitem abrir edição por nome', async ({ page }) => {
  let category: FinancialCategory = { id: 'synthetic-services', name: 'Serviços', type: 'income', color: '#3b82f6', revision: 0, aliases: ['Serviços'], historicalTypes: ['income'], archived: false };
  await page.route('**/api/financial-categories', async route => {
    if (route.request().method() === 'POST') {
      const input = route.request().postDataJSON() as { name: string; color: string; archived: boolean; expectedRevision: number };
      if (input.expectedRevision !== category.revision) return route.fulfill({ status: 409, json: { error: 'Conflito de versão' } });
      category = { ...category, name: input.name, color: input.color, archived: input.archived, revision: category.revision + 1, aliases: [...category.aliases, input.name] };
      return route.fulfill({ json: category });
    }
    return route.fulfill({ json: [category] });
  });
  await page.goto('/financeiro');
  await page.getByRole('button', { name: 'Cadastros', exact: true }).click();
  await page.getByRole('button', { name: 'Editar categoria Serviços', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Editar categoria');
  await expect(page.getByRole('textbox', { name: 'Nome da categoria', exact: true })).toHaveValue('Serviços');
  await page.getByRole('textbox', { name: 'Nome da categoria', exact: true }).fill('Serviços de teste');
  await page.getByRole('button', { name: 'Salvar categoria', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Editar categoria Serviços de teste', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Arquivar para novos lançamentos' }).check();
  await page.getByRole('button', { name: 'Salvar categoria', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByText('Categorias arquivadas', {exact: true}).click();
  await page.getByRole('button', {name: 'Serviços de teste · editar ou reativar'}).click();
  await expect(page.getByRole('checkbox', { name: 'Arquivar para novos lançamentos' })).toBeChecked();
  await page.screenshot({path: '../lifesystem-category-dialog-local.png'});
});

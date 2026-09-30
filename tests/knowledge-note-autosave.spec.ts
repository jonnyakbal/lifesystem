import { expect, test, type Page } from '@playwright/test';

async function delayedFirstCreation(page: Page) {
  const createdBodies: Record<string, unknown>[] = [];
  const patches: { id: string; body: Record<string, unknown> }[] = [];
  const notes: Record<string, unknown>[] = [];
  let releaseFirst: () => void = () => {};
  const firstResponse = new Promise<void>(resolve => { releaseFirst = resolve; });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/wiki-collections', route => route.fulfill({ json: [] }));
  await page.route('**/api/captures', async route => {
    if (route.request().method() !== 'POST') return route.fulfill({ json: notes });
    const body = route.request().postDataJSON() as Record<string, unknown>;
    createdBodies.push(body);
    const id = `autosave-note-${createdBodies.length}`;
    if (createdBodies.length === 1) await firstResponse;
    const capture = { ...body, id, createdAt: '2026-09-30T12:00:00Z' };
    notes.push(capture);
    return route.fulfill({ status: 201, json: capture });
  });
  await page.route('**/api/captures/*', route => {
    const id = new URL(route.request().url()).pathname.split('/').at(-1)!;
    const body = route.request().postDataJSON() as Record<string, unknown>;
    patches.push({ id, body });
    const existing = notes.find(note => note.id === id);
    if (existing) Object.assign(existing, body);
    return route.fulfill({ json: { ...existing, ...body, id } });
  });
  await page.goto('/notas');
  return { createdBodies, patches, releaseFirst };
}

test('autosave atrasado de uma nota não substitui a próxima nota aberta', async ({ page }) => {
  const { createdBodies, patches, releaseFirst } = await delayedFirstCreation(page);
  try {
    await page.getByRole('button', { name: 'Nova nota', exact: true }).first().click();
    await page.getByRole('textbox', { name: 'Título da nota' }).fill('Nota A em criação');
    await expect.poll(() => createdBodies.length).toBe(1);
    await page.getByRole('button', { name: 'Fechar nota', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Título da nota' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Nova nota', exact: true }).first().click();
    await page.getByRole('textbox', { name: 'Título da nota' }).fill('Nota B independente');
    releaseFirst();
    await expect.poll(() => createdBodies.length).toBe(2);
    await expect(page.getByText('Salvo', { exact: true })).toBeVisible();
    expect(createdBodies.map(body => body.content)).toEqual(['<h2>Nota A em criação</h2>\n', '<h2>Nota B independente</h2>\n']);
    expect(patches.filter(patch => patch.id === 'autosave-note-1' && String(patch.body.content).includes('Nota B'))).toEqual([]);
  } finally { releaseFirst(); }
});

test('autosave pendente cria uma única nota e conserva a última edição', async ({ page }) => {
  const { createdBodies, patches, releaseFirst } = await delayedFirstCreation(page);
  try {
    await page.getByRole('button', { name: 'Nova nota', exact: true }).first().click();
    await page.getByRole('textbox', { name: 'Título da nota' }).fill('Rascunho inicial');
    await expect.poll(() => createdBodies.length).toBe(1);
    await page.getByRole('textbox', { name: 'Título da nota' }).fill('Rascunho revisado');
    await page.getByRole('dialog').locator('[contenteditable="true"]').first().fill('Corpo escrito durante a gravação.');
    // Keep the first response pending beyond the second 900 ms debounce.
    await page.waitForTimeout(1200);
    expect(createdBodies).toHaveLength(1);
    releaseFirst();
    await expect.poll(() => patches.at(-1)?.body.content).toBe('<h2>Rascunho revisado</h2>\n<p>Corpo escrito durante a gravação.</p>');
    await expect(page.getByText('Salvo', { exact: true })).toBeVisible();
    expect(createdBodies).toHaveLength(1);
    expect(patches.map(patch => patch.id)).toEqual(['autosave-note-1']);
  } finally { releaseFirst(); }
});

test('reabrir a mesma nota conserva a edição mais recente após drenar a sessão anterior', async ({ page }) => {
  const note: Record<string, unknown> = { id: 'autosave-existing', content: '<h2>Nota existente</h2>\n<p>Texto inicial</p>', status: 'noted', type: 'text', createdAt: '2026-09-30T12:00:00Z' };
  const savedBodies: Record<string, unknown>[] = [];
  let startedPatches = 0;
  let releaseFirst: () => void = () => {};
  const firstResponse = new Promise<void>(resolve => { releaseFirst = resolve; });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/wiki-collections', route => route.fulfill({ json: [] }));
  await page.route('**/api/captures', route => route.fulfill({ json: [note] }));
  await page.route('**/api/captures/autosave-existing', async route => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    startedPatches += 1;
    if (startedPatches === 1) await firstResponse;
    savedBodies.push(body);
    Object.assign(note, body);
    return route.fulfill({ json: note });
  });
  try {
    await page.goto('/notas');
    await page.getByRole('button', { name: 'Abrir nota Nota existente', exact: true }).click();
    await page.getByRole('textbox', { name: 'Título da nota' }).fill('Versão 1');
    await expect.poll(() => startedPatches).toBe(1);
    await page.getByRole('textbox', { name: 'Título da nota' }).fill('Versão 2');
    await page.getByRole('button', { name: 'Fechar nota', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Título da nota' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Abrir nota Nota existente', exact: true }).click();
    await page.getByRole('textbox', { name: 'Título da nota' }).fill('Versão 3');
    await expect(page.getByText('Salvando...', { exact: true })).toBeVisible();
    releaseFirst();
    await expect.poll(() => savedBodies.length).toBe(3);
    await expect(page.getByText('Salvo', { exact: true })).toBeVisible();
    expect(savedBodies.map(body => body.content)).toEqual([
      '<h2>Versão 1</h2>\n<p>Texto inicial</p>',
      '<h2>Versão 2</h2>\n<p>Texto inicial</p>',
      '<h2>Versão 3</h2>\n<p>Texto inicial</p>',
    ]);
    expect(note.content).toBe('<h2>Versão 3</h2>\n<p>Texto inicial</p>');
  } finally { releaseFirst(); }
});

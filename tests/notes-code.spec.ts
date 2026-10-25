import { expect, test } from '@playwright/test';

test('Notas: destilar a essência e virar conteúdo seguem o modelo CODE', async ({ page, request }) => {
  const note = await (await request.post('/api/captures', { data: { content: 'Nota CODE sintética\nTexto longo para destilar.', type: 'text', status: 'noted' } })).json();
  let contentId = '';
  try {
    await page.goto('/notas');
    await page.getByRole('button', { name: 'Opções da nota Nota CODE sintética' }).first().click();
    await page.getByRole('menuitem', { name: /Destilar a essência/ }).click();
    await page.getByLabel('Essência da nota').fill('Uma linha que guarda o essencial.');
    await page.getByRole('button', { name: 'Salvar essência', exact: true }).click();
    await expect.poll(async () => (await (await request.get('/api/captures')).json()).find((item: { id: string }) => item.id === note.id)).toMatchObject({ codeStage: 'distilled', essence: 'Uma linha que guarda o essencial.' });
    await page.getByRole('button', { name: /^Destilada/ }).click();
    await expect(page.getByText('Uma linha que guarda o essencial.')).toBeVisible();
    await page.getByRole('button', { name: 'Opções da nota Nota CODE sintética' }).first().click();
    await page.getByRole('menuitem', { name: 'Virar conteúdo' }).click();
    await expect.poll(async () => (await (await request.get('/api/captures')).json()).find((item: { id: string }) => item.id === note.id)?.codeStage).toBe('expressed');
    const content = (await (await request.get('/api/content')).json()).find((item: { title: string }) => item.title === 'Nota CODE sintética');
    expect(content?.body).toBe('Uma linha que guarda o essencial.');
    contentId = content?.id || '';
  } finally {
    await request.delete(`/api/captures/${note.id}`);
    if (contentId) await request.delete(`/api/content/${contentId}`);
  }
});

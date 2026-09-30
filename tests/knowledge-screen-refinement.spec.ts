import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('notas distinguem uma busca vazia e permitem abrir pelo teclado', async ({ page }) => {
  await page.route('**/api/captures', route => route.fulfill({ json: [{ id: 'note-synthetic', content: '<h2>Observatório</h2>\n<p>Ideias para o próximo ciclo.</p>', status: 'noted', type: 'text', category: 'ideias', createdAt: '2026-09-30T12:00:00Z' }] }));
  await page.route('**/api/wiki-collections', route => route.fulfill({ json: [] }));
  await page.goto('/notas');
  await page.getByRole('textbox', { name: 'Buscar notas' }).fill('nenhum-resultado');
  await expect(page.getByText('Nenhuma nota encontrada', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Limpar filtros', exact: true }).click();
  const note = page.getByRole('button', { name: 'Abrir nota Observatório', exact: true });
  await note.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('textbox', { name: 'Título da nota' })).toHaveValue('Observatório');
});

test('nota com apenas título é salva e a remoção de capa aparece imediatamente', async ({ page }) => {
  let created: Record<string, unknown> | undefined;
  let redundantSaves = 0;
  const notes = [{ id: 'note-cover', content: '<h2>Com capa</h2>\n<p>Um registro.</p>', status: 'noted', type: 'text', category: 'ideias', coverUrl: '/synthetic-cover.png', createdAt: '2026-09-30T12:00:00Z' }];
  await page.route('**/synthetic-cover.png', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#63d9f2"/></svg>' }));
  await page.route('**/api/captures', async route => {
    if (route.request().method() === 'POST') {
      created = route.request().postDataJSON();
      await route.fulfill({ status: 201, json: { ...created, id: 'note-title-only', createdAt: '2026-09-30T12:00:00Z' } });
    } else await route.fulfill({ json: notes });
  });
  await page.route('**/api/captures/note-cover', route => route.fulfill({ json: { ...notes[0], ...route.request().postDataJSON() } }));
  await page.route('**/api/captures/note-title-only', route => { redundantSaves += 1; return route.fulfill({ json: { ...created, id: 'note-title-only' } }); });
  await page.route('**/api/wiki-collections', route => route.fulfill({ json: [] }));
  await page.goto('/notas');
  await page.getByRole('button', { name: 'Nova nota', exact: true }).first().click();
  await page.getByRole('textbox', { name: 'Título da nota' }).fill('Uma ideia antes de esquecer');
  await expect.poll(() => created?.content).toBe('<h2>Uma ideia antes de esquecer</h2>\n');
  await page.getByRole('button', { name: 'Fechar nota', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Título da nota' })).toHaveCount(0);
  expect(redundantSaves).toBe(0);
  await page.getByRole('button', { name: 'Abrir nota Com capa', exact: true }).click();
  await page.getByRole('button', { name: 'Remover capa', exact: true }).click();
  await expect(page.getByText('Adicionar capa', { exact: true })).toBeVisible();
  await expect(page.getByText('Salvo', { exact: true })).toBeVisible();
});

test('diário de bordo busca registros e filtra categoria sem perder a edição', async ({ page }) => {
  await page.route('**/api/log-entries', route => route.fulfill({ json: [
    { id: 'log-one', title: 'Mapa do próximo ciclo', category: 'roadmap', date: '2026-09-30', body: '<p>Priorizar conexões.</p>' },
    { id: 'log-two', title: 'Conexões em produção', category: 'deploy', date: '2026-09-29', body: '<p>Publicação verificada.</p>' },
  ] }));
  await page.goto('/diario-bordo');
  await page.getByRole('textbox', { name: 'Buscar no diário de bordo' }).fill('conexões');
  await expect(page.getByRole('button', { name: 'Abrir entrada Mapa do próximo ciclo', exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Roadmap', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Abrir entrada Conexões em produção', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Abrir entrada Mapa do próximo ciclo' }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Título da entrada' })).toHaveValue('Mapa do próximo ciclo');
});

test('abrir uma nota conserva o título completo e seus caracteres', async ({ page }) => {
  const title = 'Decisões sobre a biblioteca de conhecimento, nossos próximos projetos & todas as conexões que queremos cultivar';
  await page.route('**/api/captures', route => route.fulfill({ json: [{ id: 'note-full-title', content: `<h2>${title.replace('&', '&amp;')}</h2><p>O corpo da nota permanece separado.</p>`, status: 'noted', type: 'text', createdAt: '2026-09-30T12:00:00Z' }] }));
  await page.route('**/api/wiki-collections', route => route.fulfill({ json: [] }));
  await page.goto('/notas?open=note-full-title');
  await expect(page.getByRole('textbox', { name: 'Título da nota' })).toHaveValue(title);
});

test('edital de etapa antiga continua disponível e pode ser editado', async ({ page }) => {
  await page.route('**/api/editais', route => route.fulfill({ json: [{ id: 'edital-legacy', title: 'Horizontes culturais', stage: 'legacy-stage', orgao: 'Instituto Horizonte', createdAt: '2026-09-30T12:00:00Z' }] }));
  await page.route('**/api/stage-configs/editais', route => route.fulfill({ json: { stages: [{ id: 'radar', label: 'Radar', dot: 'bg-cyan-500', color: 'text-cyan-500', sortOrder: 0 }] } }));
  await page.route('**/api/pillars', route => route.fulfill({ json: [] }));
  await page.goto('/editais');
  await page.getByRole('textbox', { name: 'Filtrar editais' }).fill('Horizontes');
  await page.getByRole('button', { name: 'Abrir edital Horizontes culturais', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Editar Edital');
  await expect(page.getByRole('textbox', { name: 'Título do edital' })).toHaveValue('Horizontes culturais');
});

test('busca de editais usa fontes salvas sem precisar abrir o cockpit antes', async ({ page }) => {
  let discoveryCalls = 0;
  await page.route('**/api/editais', route => route.fulfill({ json: [] }));
  await page.route('**/api/stage-configs/editais', route => route.fulfill({ json: { stages: [{ id: 'radar', label: 'Radar', dot: 'bg-cyan-500', color: 'text-cyan-500', sortOrder: 0 }] } }));
  await page.route('**/api/pillars', route => route.fulfill({ json: [] }));
  await page.route('**/api/edital-settings', route => route.fulfill({ json: { perfil: '', preRequisitos: '', fontes: ['https://example.com/editais'], palavrasChave: [], notaMinima: 6 } }));
  await page.route('**/api/editais/descobrir', route => { discoveryCalls += 1; return route.fulfill({ json: { candidatos: [], erros: [] } }); });
  await page.goto('/editais');
  await page.getByRole('button', { name: 'Buscar editais', exact: true }).click();
  await expect.poll(() => discoveryCalls).toBe(1);
});

test('referência já guardada abre a nota vinculada no leitor', async ({ page }) => {
  await page.route('**/api/content-hub/sources', route => route.fulfill({ json: [{ id: 'source-synthetic', name: 'Observatório', isActive: false, url: 'https://example.com/feed', fetchStatus: 'success', itemCount: 1 }] }));
  await page.route('**/api/content-hub/items', route => route.fulfill({ json: [{ id: 'ref-synthetic', sourceId: 'source-synthetic', title: 'Pequenas constelações', url: 'https://example.com/article', status: 'unread', importance: 'normal', linkedCaptureId: 'capture-synthetic', content: 'Um texto de referência.', contentExtracted: true, fetchedAt: '2026-09-30T12:00:00Z' }] }));
  await page.route('**/api/content-hub/items/ref-synthetic', route => route.fulfill({ json: {} }));
  await page.goto('/content-hub');
  await page.getByRole('button', { name: 'Ler Pequenas constelações', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('link', { name: 'Abrir nota', exact: true })).toHaveAttribute('href', '/notas?open=capture-synthetic');
});

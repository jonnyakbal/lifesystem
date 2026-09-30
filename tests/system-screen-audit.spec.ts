import { expect, test } from '@playwright/test';
import { DEFAULT_STAGES } from '../src/lib/default-stages';

const createdAt = '2026-09-30T12:00:00Z';
const project = { id: 'project-qa', name: 'Observatório', description: 'Um lugar para conectar ideias e transformá-las em experiências.', status: 'active', tags: ['Design', 'Pesquisa'], links: [], needs: '', tasksCount: 3, tasksDone: 1, createdAt, updatedAt: createdAt };
const pillars = [
  { id: 'body-qa', name: 'Corpo', description: 'Energia para uma vida com intenção', icon: '◌', color: 'primary', sortOrder: 1, currentStatus: 'Em movimento', target: 'Cuidar do ritmo', createdAt },
  { id: 'mind-qa', name: 'Aprender', description: 'Ideias que abrem caminhos', icon: '◈', color: 'qty', sortOrder: 2, currentStatus: '', target: '', createdAt },
];
const tasks = [
  { id: 'task-qa', title: 'Construir uma experiência mais simples', status: 'doing', priority: 'important', dueDate: '2026-09-30', projectId: project.id, pillarId: pillars[1].id, tags: ['Design'], description: 'Conectar os próximos passos.', createdAt, updatedAt: createdAt },
  { id: 'planned-qa', title: 'Reservar tempo para criar', status: 'todo', priority: 'normal', dueDate: '2026-09-30', projectId: project.id, tags: [], planning: { date: '2026-09-30', startAt: '2026-09-30T10:00:00-03:00', endAt: '2026-09-30T11:00:00-03:00', timeZone: 'America/Sao_Paulo', syncToGoogle: false, syncState: 'local' }, createdAt, updatedAt: createdAt },
  { id: 'undated-qa', title: 'Uma ideia que ainda precisa de espaço', status: 'todo', priority: 'normal', tags: [], createdAt, updatedAt: createdAt },
];
const fixtures: Record<string, unknown> = {
  '/api/tasks': tasks, '/api/projects': [project], '/api/pillars': pillars,
  '/api/captures': [
    { id: 'capture-qa', title: 'Uma ideia antes de esquecer', content: 'Criar espaço para pequenos experimentos.', status: 'inbox', type: 'text', createdAt },
    { id: 'note-qa', content: '<h2>Pequenas constelações</h2>\n<p>Referências e conexões para o próximo ciclo.</p>', status: 'noted', type: 'text', category: 'ideias', createdAt },
  ],
  '/api/indicators': [{ id: 'goal-qa', name: 'Leitura com intenção', pillarId: pillars[1].id, frequency: 'daily', targetValue: 30, currentValue: 12, unit: 'min', type: 'quantity', tags: [], createdAt }],
  '/api/journal': [{ id: 'journal-qa', entryDate: '2026-09-30', content: '<p>Um pequeno passo trouxe clareza ao dia.</p>', gratitude: '<p>Tempo para criar.</p>', mood: 'good', pillarChecks: { 'body-qa': 4 }, createdAt }],
  '/api/vision': [{ id: 'vision-qa', section: 'identity', title: 'O que me move', content: 'Construir com intenção e cultivar boas conexões.', createdAt }],
  '/api/content': [{ id: 'content-qa', title: 'Como uma ideia se torna uma experiência', body: '<p>Referências, decisões e histórias que vale a pena compartilhar.</p>', stage: 'draft', channel: 'blog', tags: ['Processo'], projectId: project.id, createdAt }],
  '/api/financial': [
    { id: 'paid-qa', type: 'income', amount: 500, date: '2026-09-20', paidDate: '2026-09-20', status: 'paid', category: 'Serviços', description: 'Receita sintética', createdAt },
    { id: 'forecast-qa', type: 'expense_fixed', amount: 180, date: '2026-09-30', dueDate: '2026-10-05', status: 'pending', category: 'Software', description: 'Previsão sintética', createdAt },
  ],
  '/api/editais': [{ id: 'edital-qa', title: 'Horizontes culturais', orgao: 'Instituto Horizonte', stage: 'radar', descricao: 'Uma oportunidade para projetos criativos.', prazoInscricao: '2026-10-20', createdAt }],
  '/api/log-entries': [{ id: 'log-qa', title: 'Decisões do próximo ciclo', category: 'roadmap', date: '2026-09-30', body: '<p>Priorizar conexões e reduzir ruído.</p>', createdAt }],
  '/api/content-hub/sources': [{ id: 'source-qa', name: 'Caderno de referências', url: 'https://example.com/feed', isActive: true, fetchStatus: 'success', itemCount: 1, lastFetchedAt: '2026-09-30T18:00:00Z' }],
  '/api/content-hub/items': [{ id: 'reference-qa', sourceId: 'source-qa', title: 'Pequenas constelações', url: 'https://example.com/article', content: '<p>Ideias que abrem caminhos.</p>', excerpt: 'Conectar referências com o que queremos criar.', status: 'unread', importance: 'high', fetchedAt: createdAt, linkedCaptureId: 'note-qa' }],
  '/api/google-calendar/status': { configured: true, connected: true },
  '/api/google-calendar/events': [{ id: 'calendar-qa', title: 'Uma conversa para abrir caminhos', start: '2026-09-30T14:00:00-03:00', end: '2026-09-30T15:00:00-03:00', allDay: false, htmlLink: 'https://example.com/calendar' }],
  '/api/hermes/status': { mcpConfigured: true, mcpMode: 'scoped', mcpKeyCount: 1, lastCallAt: createdAt, lastCallClientId: 'sirius-qa', lastSuccessAt: createdAt, recentFailures: 0, auditAvailable: true, heartbeat: { clientId: 'sirius-qa', status: 'online', lastSeenAt: createdAt }, nousConfigured: false },
  '/api/hermes/logs': [{ id: 'log-qa', tool: 'get_professional_overview', clientId: 'sirius-qa', success: true, createdAt }],
};

test('todas as telas com conteúdo sintético em desktop, mobile e tema claro', async ({ page }) => {
  test.setTimeout(240000);
  await page.clock.setFixedTime(new Date('2026-09-30T15:00:00-03:00'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== 'GET') return route.fulfill({ json: {} });
    if (fixtures[path]) return route.fulfill({ json: fixtures[path] });
    if (path.startsWith('/api/stage-configs/')) return route.fulfill({ json: { stages: DEFAULT_STAGES[path.split('/').pop() as keyof typeof DEFAULT_STAGES] || DEFAULT_STAGES.tasks } });
    if (path === '/api/professional') return route.fulfill({ json: { brands: [], projects: { items: [] }, diagnostics: {}, suggestions: [], counts: { projects: 0, works: 0, opportunities: 0, awaitingReview: 0 }, items: [] } });
    return route.continue();
  });
  const routes = ['/', '/hoje', '/inbox', '/tarefas', '/planejar', '/projetos', '/conteudo', '/content-hub', '/notas', '/indicadores', '/financeiro', '/diario', '/visao', '/pilares', '/editais', '/diario-bordo', '/revisao', '/hermes', '/profissional', '/login', '/privacidade', '/termos'];
  for (const variant of [{ width: 1440, theme: 'dark' }, { width: 390, theme: 'dark' }, { width: 1440, theme: 'light' }]) {
    await page.setViewportSize({ width: variant.width, height: 900 });
    await page.addInitScript(theme => localStorage.setItem('lifesystem-theme', theme), variant.theme);
    for (const route of routes) {
      const before = errors.length;
      await page.goto(route, { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { level: 1 }).first(), route).toBeVisible();
      // Let entrance transitions finish before assessing the actual composition.
      await page.waitForTimeout(1200);
      await page.addStyleTag({ content: 'nextjs-portal { display: none; }' });
      await expect(page.locator('[data-sonner-toast][data-type="error"]'), `${route}: falhas apresentadas na interface`).toHaveCount(0);
      const width = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(width, `${route} em ${variant.width}px`).toBeLessThanOrEqual(variant.width);
      await page.screenshot({ path: `../lifesystem-sweep-${route === '/' ? 'home' : route.slice(1)}-${variant.width}-${variant.theme}.png`, fullPage: false, animations: 'disabled' });
      expect(errors.slice(before), `${route}: erros de execução/console`).toEqual([]);
    }
  }
  await page.goto('/');
  await page.getByRole('button', { name: 'Abrir configurações', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Configurações');
  await page.screenshot({ path: '../lifesystem-sweep-settings-local.png' });
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.screenshot({ path: '../lifesystem-sweep-command-local.png' });
  await page.keyboard.press('Escape');
});

test('exportação interrompe em erro de leitura e importação não afirma sucesso em HTTP 500', async ({ page }) => {
  await page.route('**/api/financial', route => route.fulfill({ status: 500, json: { error: 'Falha sintética de leitura' } }));
  await page.goto('/inbox');
  await page.getByRole('button', { name: 'Abrir configurações', exact: true }).click();
  let downloads = 0;
  page.on('download', () => { downloads++; });
  await page.getByRole('button', { name: 'Exportar JSON', exact: true }).click();
  await expect(page.getByText('Não foi possível exportar os dados.', { exact: false })).toBeVisible();
  expect(downloads).toBe(0);
  await page.route('**/api/tasks', route => route.fulfill({ status: 500, json: { error: 'Falha sintética de gravação' } }));
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importar JSON', exact: true }).click();
  await (await chooser).setFiles({ name: 'synthetic.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ data: { tasks: [{ title: 'Tarefa sintética', status: 'todo', priority: 'normal' }] } })) });
  await expect(page.getByText(/Importação interrompida.*0 registros/)).toBeVisible();
  await expect(page.getByText(/^Importado:/)).toHaveCount(0);
});

test('importação detecta conflitos de diário e visão antes de gravar qualquer registro', async ({ page }) => {
  let writes = 0;
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'POST') { writes++; return route.fulfill({ json: {} }); }
    return route.fulfill({ json: path === '/api/vision' ? [{ id: 'existing', section: 'identity', content: 'Texto atual preservado' }] : path === '/api/journal' ? [{ id: 'existing-journal', entryDate: '2026-09-30', content: 'Dia atual preservado' }] : [] });
  });
  await page.goto('/inbox');
  await page.getByRole('button', { name: 'Abrir configurações', exact: true }).click();
  for (const payload of [{ tasks: [{ title: 'Não criar parcialmente' }], vision: [{ section: 'identity', content: 'Não substituir', title: 'Visão' }] }, { journal: [{ entryDate: '2026-09-30', content: 'Não substituir diário', pillarChecks: {} }] }]) {
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Importar JSON', exact: true }).click();
    await (await chooser).setFiles({ name: 'synthetic-conflict.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ data: payload })) });
    await expect(page.getByText(/Já existe um registro/).last()).toBeVisible();
    expect(writes).toBe(0);
  }
});

test('comandos globais chegam às fontes e à área profissional e criar nota abre Notas', async ({ page }) => {
  await page.goto('/inbox');
  await page.getByRole('button', { name: 'Buscar e abrir comandos' }).click();
  await expect(page.getByRole('dialog', { name: 'Paleta de comandos' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ir para Fontes' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ir para Profissional' })).toBeVisible();
  await page.getByRole('button', { name: 'Criar nova nota' }).click();
  await expect(page).toHaveURL(/\/notas/);
});

test('importação recusa referências que receberiam IDs órfãos e arquivos repetidos', async ({ page }) => {
  let writes = 0;
  await page.route('**/api/**', route => {
    if (route.request().method() === 'POST') { writes++; return route.fulfill({ json: {} }); }
    return route.fulfill({ json: [] });
  });
  await page.goto('/inbox');
  await page.getByRole('button', { name: 'Abrir configurações', exact: true }).click();
  for (const payload of [
    { content: [{ title: 'Conteúdo vinculado', linkedProjectIds: ['old-project'] }] },
    { tasks: [{ title: 'Subtarefa', parentId: 'old-task' }] },
    { captures: [{ content: 'Nota vinculada', status: 'noted', category: 'old-collection' }] },
    { journal: [{ entryDate: '2026-09-01' }, { entryDate: '2026-09-01' }] },
  ]) {
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Importar JSON', exact: true }).click();
    await (await chooser).setFiles({ name: 'synthetic-links.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ data: payload })) });
    await expect(page.getByText(/Importação interrompida: 0 registros/).last()).toBeVisible();
    expect(writes).toBe(0);
    await page.reload();
    await page.getByRole('button', { name: 'Abrir configurações', exact: true }).click();
  }
});

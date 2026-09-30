import { expect, test } from '@playwright/test';

const stages = [
  { id: 'queue', label: 'Fila', color: 'text-primary', dot: 'bg-primary' },
  { id: 'finished', label: 'Finalizada', color: 'text-money', dot: 'bg-money', isTerminal: true },
];
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-30T15:00:00-03:00'));
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({ json: path.startsWith('/api/stage-configs/') ? { stages } : [] });
  });
});

test('visão geral separa previsão e pagamento pela mesma regra mensal do Financeiro', async ({ page }) => {
  await page.route('**/api/financial', route => route.fulfill({ json: [
    { id: 'future', type: 'expense_fixed', amount: 900, date: '2026-09-30', dueDate: '2026-10-05', status: 'pending', category: 'Casa' },
    { id: 'paid', type: 'expense_variable', amount: 75, date: '2026-08-30', paidDate: '2026-09-15', status: 'paid', category: 'Teste' },
    { id: 'open', type: 'income', amount: 220, date: '2026-09-01', status: 'pending', category: 'Teste' },
  ] }));
  await page.goto('/');
  const finance = page.getByRole('region', { name: 'Resumo financeiro do mês' });
  await expect(finance).toContainText('Resultado realizado');
  await expect(finance).toContainText('R$ -75');
  await expect(finance).toContainText('R$ 220');
  await expect(finance).not.toContainText('900');
  await expect(finance).not.toContainText('Saldo atual');
});

test('visão geral mantém as seções disponíveis quando uma consulta falha', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/financial', route => route.fulfill({ status: 500, json: { error: 'Falha sintética' } }));
  await page.route('**/api/tasks', route => route.fulfill({ json: [{ id: 'action', title: 'Próximo passo sintético', dueDate: '2026-09-30', status: 'queue', priority: 'normal', createdAt: '2026-09-30T12:00:00Z' }] }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Seu dia em órbita' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Resumo financeiro do mês' })).toContainText('Resumo indisponível');
  await expect(page.getByText('Próximo passo sintético').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('falha nas etapas de projetos não bloqueia tarefas nem inventa contagens de projetos', async ({ page }) => {
  await page.route('**/api/stage-configs/projects', route => route.fulfill({ status: 500, json: { error: 'Falha sintética de etapas' } }));
  await page.route('**/api/tasks', route => route.fulfill({ json: [{ id: 'action', title: 'Tarefa disponível', dueDate: '2026-09-30', status: 'queue', priority: 'normal', createdAt: '2026-09-30T12:00:00Z' }] }));
  await page.route('**/api/projects', route => route.fulfill({ json: [{ id: 'project', name: 'Projeto sem etapas', status: 'active' }] }));
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Próximos passos' })).toContainText('Tarefa disponível');
  await expect(page.getByRole('textbox', { name: 'Adicionar tarefa rápida' })).toBeEnabled();
  await expect(page.getByRole('region', { name: 'Projetos em movimento' })).toContainText('Resumo indisponível');
});

test('visão geral respeita etapas terminais personalizadas e apenas capturas da fila', async ({ page }) => {
  await page.route('**/api/tasks', route => route.fulfill({ json: [{ id: 'done', title: 'Já concluída', dueDate: '2026-09-01', status: 'finished', priority: 'normal', createdAt: '2026-09-01T12:00:00Z' }] }));
  await page.route('**/api/captures', route => route.fulfill({ json: [
    { id: 'note', title: 'Nota já organizada', content: 'Histórico', status: 'noted', type: 'text', createdAt: '2026-09-30T12:00:00Z' },
    { id: 'queue', title: 'Ideia para decidir', content: 'Captura', status: 'inbox', type: 'text', createdAt: '2026-09-30T11:00:00Z' },
  ] }));
  await page.goto('/');
  await expect(page.getByText('Ideia para decidir', { exact: true })).toBeVisible();
  await expect(page.getByText('Nota já organizada', { exact: true })).toHaveCount(0);
  await expect(page.getByText(/Atenção:.*atrasada/)).toHaveCount(0);
});

test('caixa de entrada busca título e mostra ausência de resultados sem dizer que a fila está vazia', async ({ page }) => {
  await page.route('**/api/captures', route => route.fulfill({ json: [{ id: 'capture', title: 'Constelação', content: 'Conteúdo diferente', status: 'inbox', type: 'text', createdAt: '2026-09-30T12:00:00Z' }] }));
  await page.goto('/inbox');
  await page.getByPlaceholder('Buscar na fila...').fill('constelação');
  await expect(page.getByRole('button', { name: 'Converter Constelação' })).toBeVisible();
  await page.getByPlaceholder('Buscar na fila...').fill('ausente');
  await expect(page.getByText('Nenhuma captura encontrada', { exact: true })).toBeVisible();
  await expect(page.getByText('INBOX vazia', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Limpar busca' }).click();
  const convert = page.getByRole('button', { name: 'Converter Constelação' });
  await convert.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('caixa de entrada impede gravações repetidas enquanto a captura é salva', async ({ page }) => {
  let requests = 0;
  let finish!: () => void;
  const pending = new Promise<void>(resolve => { finish = resolve; });
  await page.route('**/api/captures', async route => {
    if (route.request().method() !== 'POST') return route.fulfill({ json: [] });
    requests++;
    await pending;
    return route.fulfill({ status: 201, json: { id: 'saved', ...route.request().postDataJSON(), createdAt: '2026-09-30T12:00:00Z' } });
  });
  await page.goto('/inbox');
  const input = page.getByPlaceholder('Jogar uma ideia rápida aqui...');
  await input.fill('Uma captura apenas');
  await input.evaluate(element => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  });
  await expect.poll(() => requests).toBeGreaterThan(0);
  await expect(input).toBeDisabled();
  finish();
  await expect(input).toHaveValue('');
  expect(requests).toBe(1);
});

test('Hermes apresenta status indisponível quando a consulta falha', async ({ page }) => {
  await page.route('**/api/hermes/status', route => route.fulfill({ status: 500, json: { error: 'Falha sintética de status' } }));
  await page.goto('/hermes');
  await expect(page.getByRole('alert').filter({ hasText: 'Não foi possível consultar a conexão' })).toBeVisible();
  await expect(page.getByText('Não configurada', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Área profissional' })).toHaveAttribute('href', '/profissional');
});

test('revisão encaminha tarefas com horário para Planejar e ignora etapas concluídas', async ({ page }) => {
  await page.route('**/api/tasks', route => route.fulfill({ json: [
    { id: 'planned', title: 'Bloco sintético', status: 'queue', priority: 'normal', dueDate: '2026-09-28', planning: { date: '2026-09-28', startAt: '2026-09-28T10:00:00-03:00', endAt: '2026-09-28T11:00:00-03:00', timeZone: 'America/Sao_Paulo', syncState: 'local', syncToGoogle: false } },
    { id: 'finished', title: 'Não está atrasada', status: 'finished', priority: 'normal', dueDate: '2026-09-01' },
  ] }));
  await page.goto('/revisao');
  await page.getByRole('button', { name: 'Próximo', exact: true }).click();
  await page.getByRole('button', { name: 'Próximo', exact: true }).click();
  await expect(page.getByText('Bloco sintético', { exact: true })).toBeVisible();
  await expect(page.getByText('Não está atrasada', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Replanejar Bloco sintético' })).toHaveAttribute('href', '/planejar');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);
});

test('busca de conteúdo continua legível no mobile e registros antigos usam a data de criação', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/content', route => route.fulfill({ json: [{ id: 'legacy', title: 'Conteúdo histórico', body: 'Uma referência preservada', stage: 'draft', channel: 'blog', tags: [], createdAt: '2026-09-25T12:00:00Z' }] }));
  await page.goto('/conteudo');
  const search = page.getByPlaceholder('Buscar conteúdo...');
  await expect(search).toBeVisible();
  expect((await search.boundingBox())!.width).toBeGreaterThan(300);
  await expect(page.getByText('Invalid Date', { exact: true })).toHaveCount(0);
  await search.fill('histórico');
  await expect(page.getByRole('button', { name: 'Conteúdo histórico', exact: true })).toBeVisible();
});

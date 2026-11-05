import { expect, test } from '@playwright/test';

const ESTADOS = ['ok', 'atencao', 'alerta', 'desconhecido'];

test('cockpit: sinais reais com estado válido; sem fonte vira desconhecido, nunca ok', async ({ request }) => {
  const entry = await (await request.post('/api/log-entries', { data: { title: 'Revisão de segurança sintética', body: '<p>.</p>', category: 'seguranca', date: new Date().toLocaleDateString('en-CA') } })).json();
  try {
    const sinais = await (await request.get('/api/cockpit')).json();
    for (const nome of ['ci', 'hermes', 'mcpLatencia', 'backup', 'dados', 'seguranca', 'diario']) {
      expect(ESTADOS, nome).toContain(sinais[nome].estado);
      if (sinais[nome].estado === 'desconhecido') expect(sinais[nome].valor, nome).toBeNull();
    }
    expect(sinais.seguranca).toMatchObject({ estado: 'ok', valor: 0 });
    expect(sinais.diario).toMatchObject({ estado: 'ok', valor: 0 });
  } finally { await request.delete(`/api/log-entries/${entry.id}`); }
});

test('cockpit: veredito, lâmpadas, medidores, gravador e mapa de calor no Diário de bordo', async ({ page }) => {
  await page.route('**/api/cockpit', route => route.fulfill({ json: {
    verificadoEm: new Date().toISOString(),
    ci: { estado: 'alerta', resumo: 'CI falhou em abc1234', em: new Date().toISOString(), valor: null, url: 'https://github.com/' },
    hermes: { estado: 'ok', resumo: 'Hermes online', em: new Date().toISOString(), valor: 3 },
    mcpLatencia: { estado: 'ok', resumo: '120 ms', em: null, valor: 120 },
    backup: { estado: 'desconhecido', resumo: 'Nenhum backup com manifesto encontrado.', em: null, valor: null },
    dados: { estado: 'ok', resumo: '1.2 MB', em: null, valor: 1.2 },
    seguranca: { estado: 'atencao', resumo: 'Última revisão de segurança há 40 d', em: null, valor: 40 },
    diario: { estado: 'ok', resumo: 'Última entrada há 1 d', em: null, valor: 1 },
  } }));
  await page.goto('/diario-bordo');
  const cockpit = page.getByRole('region', { name: 'Cockpit' });
  await expect(cockpit.getByText('● AÇÃO NECESSÁRIA')).toBeVisible();
  await expect(cockpit.getByText('2 sinais pedem você')).toBeVisible();
  await expect(cockpit.getByText('CI falhou em abc1234')).toBeVisible();
  await expect(cockpit.getByRole('list', { name: 'Lâmpadas' }).getByRole('listitem')).toHaveCount(5);
  await expect(cockpit.getByRole('list', { name: 'Lâmpadas' }).getByText('sem sinal')).toBeVisible();
  await expect(cockpit.getByRole('img', { name: 'Idade do backup: sem sinal' })).toBeVisible();
  await expect(cockpit.getByRole('img', { name: 'Latência MCP: 120 ms' })).toBeVisible();
  await expect(cockpit.getByLabel('Gravador de voo')).toBeVisible();
  await expect(cockpit.getByLabel('Mapa de calor')).toBeVisible();
});

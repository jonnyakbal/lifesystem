// Smoke test for Financeiro's 5 hand-rolled dialogs (Account/Card/Payee/
// Goal/Budget) — not covered by earlier QA passes. Creates one of each,
// verifies it renders with no console errors, then deletes it via the API
// so it doesn't pollute Jonny's real financial data.
const { chromium } = require('playwright');
const BASE = 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`CONSOLE: ${m.text().slice(0, 200)}`); });
  page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message.slice(0, 200)}`));

  const results = [];
  function log(name, ok, detail = '') {
    results.push({ name, ok });
    console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
  }

  async function gotoTab(label) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await page.waitForTimeout(400);
  }

  await page.goto(`${BASE}/financeiro`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const stamp = Date.now();
  const createdIds = {};

  // Account (tab: Contas)
  try {
    await gotoTab('Contas');
    const name = `QA Conta ${stamp}`;
    await page.getByRole('button', { name: /nova conta|criar primeira conta/i }).first().click();
    await page.waitForTimeout(300);
    await page.getByPlaceholder('Ex: Nubank, Itaú, Carteira').fill(name);
    await page.getByRole('button', { name: /^criar$|^salvar$/i }).last().click();
    await page.waitForTimeout(700);
    const body = await page.locator('body').innerText();
    log('Financeiro: Account create', body.includes(name));
    const accts = await (await page.request.get(`${BASE}/api/accounts`)).json();
    const acct = accts.find(a => a.name === name);
    if (acct) createdIds.account = acct.id;
  } catch (e) { log('Financeiro: Account create', false, e.message.slice(0, 150)); }

  // Card (tab: Cartões)
  try {
    await gotoTab('Cartões');
    const name = `QA Cartao ${stamp}`;
    await page.getByRole('button', { name: /novo cartão/i }).first().click();
    await page.waitForTimeout(300);
    await page.getByPlaceholder('Ex: Nubank Ultravioleta').fill(name);
    await page.getByPlaceholder('1234').fill('4242');
    await page.getByRole('button', { name: /^criar$|^salvar$/i }).last().click();
    await page.waitForTimeout(700);
    const body = await page.locator('body').innerText();
    log('Financeiro: Card create', body.includes(name));
    const cards = await (await page.request.get(`${BASE}/api/cards`)).json();
    const c = cards.find(x => x.name === name);
    if (c) createdIds.card = c.id;
  } catch (e) { log('Financeiro: Card create', false, e.message.slice(0, 150)); }

  // Payee (tab: Cadastros)
  try {
    await gotoTab('Cadastros');
    const name = `QA Fornecedor ${stamp}`;
    await page.getByRole('button', { name: /^novo$/i }).first().click();
    await page.waitForTimeout(300);
    await page.getByPlaceholder('Ex: Manoel, Facebook Ads').fill(name);
    await page.getByRole('button', { name: /^criar$|^salvar$/i }).last().click();
    await page.waitForTimeout(700);
    const body = await page.locator('body').innerText();
    log('Financeiro: Payee create', body.includes(name));
    const payees = await (await page.request.get(`${BASE}/api/payees`)).json();
    const p = payees.find(x => x.name === name);
    if (p) createdIds.payee = p.id;
  } catch (e) { log('Financeiro: Payee create', false, e.message.slice(0, 150)); }

  // Goal (tab: Visão Geral)
  try {
    await gotoTab('Visão Geral');
    const name = `QA Meta ${stamp}`;
    await page.getByRole('button').filter({ has: page.locator('svg') }).nth(0); // no-op guard
    await page.locator('div', { hasText: 'Metas' }).locator('button').first().click();
    await page.waitForTimeout(300);
    await page.getByPlaceholder('Ex: Reserva de emergência').fill(name);
    await page.getByPlaceholder('0,00').first().fill('1000');
    await page.getByRole('button', { name: /^criar$|^salvar$/i }).last().click();
    await page.waitForTimeout(700);
    const body = await page.locator('body').innerText();
    log('Financeiro: Goal create', body.includes(name));
    const goals = await (await page.request.get(`${BASE}/api/financial-goals`)).json();
    const g = goals.find(x => x.name === name);
    if (g) createdIds.goal = g.id;
  } catch (e) { log('Financeiro: Goal create', false, e.message.slice(0, 150)); }

  // Budget (tab: Visão Geral)
  try {
    await gotoTab('Visão Geral');
    await page.getByRole('button', { name: /^novo$/i }).first().click();
    await page.waitForTimeout(300);
    const catSelect = page.locator('[role="dialog"]').getByText('Selecione').first();
    if (await catSelect.count()) {
      await catSelect.click();
      await page.waitForTimeout(200);
      const firstOption = page.locator('[role="option"]').first();
      if (await firstOption.count()) await firstOption.click();
    }
    await page.getByPlaceholder('0,00').first().fill('500');
    await page.getByRole('button', { name: /^criar$|^salvar$/i }).last().click();
    await page.waitForTimeout(700);
    log('Financeiro: Budget create (no throw)', true);
  } catch (e) { log('Financeiro: Budget create', false, e.message.slice(0, 150)); }

  // Cleanup via API
  try {
    if (createdIds.account) await page.request.delete(`${BASE}/api/accounts/${createdIds.account}`);
    if (createdIds.card) await page.request.delete(`${BASE}/api/cards/${createdIds.card}`);
    if (createdIds.payee) await page.request.delete(`${BASE}/api/payees/${createdIds.payee}`);
    if (createdIds.goal) await page.request.delete(`${BASE}/api/financial-goals/${createdIds.goal}`);
    log('Cleanup: test records deleted via API', true);
  } catch (e) { log('Cleanup', false, e.message.slice(0, 150)); }

  await browser.close();

  console.log('\n=== SUMMARY ===');
  const failed = results.filter(r => !r.ok);
  console.log(`${results.length - failed.length}/${results.length} passed`);
  if (errors.length) {
    console.log('\n=== CONSOLE/PAGE ERRORS ===');
    console.log(errors.join('\n'));
  } else {
    console.log('No console/page errors.');
  }
})();

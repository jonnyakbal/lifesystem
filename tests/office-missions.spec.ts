import { test, expect, type Page } from "@playwright/test";

const HASH_H = "a".repeat(64);
const HASH_P = "b".repeat(64);
const future = () => new Date(Date.now() + 3_600_000).toISOString();

async function login(page: Page) {
  await page.request.post("/api/login", {
    data: { user: "office-test", password: "office-ui-test-only" },
  });
  await page.context().addCookies((await page.request.storageState()).cookies);
}

type Calls = { url: string; method: string; body: unknown }[];

async function mockBoard(page: Page, opts: { healthFails?: boolean; external?: boolean } = {}) {
  const calls: Calls = [];
  const now = new Date().toISOString();
  const jobs = [
    { id: "j1", clientId: "c1", agentId: "sirius", text: "Organize a semana do ArcoPass", response: null, status: "running", createdAt: now, updatedAt: now },
    { id: "j2", clientId: "c2", agentId: "vega", text: "Revise o orçamento de outubro", response: null, status: "queued", createdAt: now, updatedAt: now },
    { id: "j3", clientId: "c3", agentId: "cosmo", text: "Pauta do vídeo", response: "Pronto.", status: "completed", createdAt: now, updatedAt: now },
  ];
  let healthApproved = false;
  await page.route("**/api/hermes/office/chat**", (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() !== "GET") return route.fulfill({ status: 500, json: { error: "unexpected" } });
    const agent = url.searchParams.get("agentId");
    return route.fulfill({ json: { jobs: agent === "all" ? jobs : jobs.filter((j) => j.agentId === agent) } });
  });
  await page.route("**/api/health**", (route) => {
    const request = route.request();
    calls.push({ url: request.url(), method: request.method(), body: request.postDataJSON?.() ?? null });
    if (request.method() === "POST") {
      healthApproved = true;
      return route.fulfill({ json: { ok: true } });
    }
    if (opts.healthFails) return route.fulfill({ status: 503, json: { error: "down" } });
    return route.fulfill({
      json: {
        items: [{
          id: "11111111-1111-4111-8111-111111111111", revision: 2, hash: HASH_H, actor: "orion",
          input: { operation: "record", observation: { type: "sleep", observedAt: now, timezone: "America/Sao_Paulo" } },
          createdAt: now, expiresAt: future(), ...(healthApproved ? { approvedAt: now } : {}),
        }],
      },
    });
  });
  await page.route("**/api/professional**", (route) => {
    const request = route.request();
    calls.push({ url: request.url(), method: request.method(), body: request.postDataJSON?.() ?? null });
    if (request.method() === "POST") return route.fulfill({ json: { ok: true } });
    return route.fulfill({
      json: {
        items: [{
          id: "prop-1", revision: 1, hash: HASH_P, kind: "work", expectedRevision: 0,
          data: { title: "Escopo de prospecção", projectId: "p1" },
          approvalType: opts.external ? "external_action" : "work_scope",
          author: "sirius", createdAt: now, expiresAt: future(), approval: null,
        }],
        nextCursor: null,
      },
    });
  });
  return calls;
}

test("mission board shows real missions and decisions from every agent without writing", async ({ page }) => {
  await login(page);
  const calls = await mockBoard(page);
  await page.goto("/escritorio");
  const missionsButton = page.getByRole("button", { name: /^Missões: 2 em andamento, 2 aguardando decisão$/ });
  await expect(missionsButton).toBeVisible();
  await expect(page.getByRole("button", { name: "Focalizar Órion" })).toContainText("!");
  await expect(page.getByRole("button", { name: "Focalizar Sirius" })).toContainText("Em missão");
  await expect(page.getByRole("button", { name: "Focalizar Vega" })).toContainText("Missão na fila");

  await missionsButton.click();
  const board = page.getByRole("region", { name: "Central de missões" });
  await expect(board.getByText("Novo relato de saúde")).toBeVisible();
  await expect(board.getByText("Escopo de prospecção")).toBeVisible();
  await expect(board.getByText("Organize a semana do ArcoPass")).toBeVisible();
  await expect(board.getByText("Pauta do vídeo")).toBeVisible();
  expect(calls.filter((c) => c.method !== "GET")).toEqual([]);

  await board.getByRole("button", { name: /Abrir conversa de Sirius/ }).click();
  await expect(page.getByRole("region", { name: "Conversa com Sirius" })).toBeVisible();
  await expect(board).toBeHidden();
});

test("approving a health decision sends exactly the reviewed proposal once", async ({ page }) => {
  await login(page);
  const calls = await mockBoard(page);
  await page.goto("/escritorio");
  await page.getByRole("button", { name: /^Missões/ }).click();
  const board = page.getByRole("region", { name: "Central de missões" });
  await board.locator("li", { hasText: "Novo relato de saúde" }).getByRole("button", { name: "Revisar e decidir" }).click();
  const dialog = page.getByRole("dialog", { name: "Revisar proposta: Novo relato de saúde" });
  await expect(dialog).toContainText('"operation": "record"');
  await expect(dialog).toContainText("versão 2");
  await dialog.getByRole("button", { name: "Voltar" }).click();
  expect(calls.filter((c) => c.method === "POST")).toEqual([]);

  await board.locator("li", { hasText: "Novo relato de saúde" }).getByRole("button", { name: "Revisar e decidir" }).click();
  await page.getByRole("button", { name: "Aprovar estes campos" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  const posts = calls.filter((c) => c.method === "POST");
  expect(posts).toHaveLength(1);
  expect(posts[0].url).toContain("/api/health/approval");
  expect(posts[0].body).toEqual({ proposalId: "11111111-1111-4111-8111-111111111111", revision: 2, hash: HASH_H });
  await expect(page.getByRole("status").filter({ hasText: "Aprovado: Novo relato de saúde" }).first()).toBeVisible();
  await expect(board.getByText("1 aprovada(s) aguardando o agente aplicar.")).toBeVisible();
});

test("professional approval mirrors the Profissional page and external actions stay blocked", async ({ page }) => {
  await login(page);
  const calls = await mockBoard(page);
  await page.goto("/escritorio");
  await page.getByRole("button", { name: /^Missões/ }).click();
  const board = page.getByRole("region", { name: "Central de missões" });
  await board.locator("li", { hasText: "Escopo de prospecção" }).getByRole("button", { name: "Revisar e decidir" }).click();
  await page.getByRole("button", { name: "Aprovar estes campos" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  const posts = calls.filter((c) => c.method === "POST");
  expect(posts.map((c) => new URL(c.url).pathname)).toEqual(["/api/professional/approval", "/api/professional"]);
  expect(posts[0].body).toEqual({ proposalId: "prop-1", revision: 1, hash: HASH_P });
  expect(posts[1].body).toEqual({ action: "apply", id: "prop-1", idempotencyKey: "owner-apply-prop-1" });
});

test("an external action cannot be approved from the station", async ({ page }) => {
  await login(page);
  const calls = await mockBoard(page, { external: true });
  await page.goto("/escritorio");
  await page.getByRole("button", { name: /^Missões/ }).click();
  const board = page.getByRole("region", { name: "Central de missões" });
  await board.locator("li", { hasText: "Escopo de prospecção" }).getByRole("button", { name: "Revisar e decidir" }).click();
  await expect(page.getByText("Ação externa não tem executor")).toBeVisible();
  await expect(page.getByRole("button", { name: "Aprovar estes campos" })).toBeDisabled();
  expect(calls.filter((c) => c.method === "POST")).toEqual([]);
});

test("an unreadable source is reported and never shown as zero decisions", async ({ page }) => {
  await login(page);
  await mockBoard(page, { healthFails: true });
  await page.goto("/escritorio");
  await page.getByRole("button", { name: /^Missões/ }).click();
  const board = page.getByRole("region", { name: "Central de missões" });
  await expect(board.getByRole("alert")).toContainText("Propostas do Órion indisponíveis agora.");
  await expect(board.getByRole("heading", { name: "Aguardando sua decisão", exact: true })).toBeVisible();
  await expect(board.getByText("Nenhuma proposta esperando você.")).toHaveCount(0);
  await expect(board.getByText("Escopo de prospecção")).toBeVisible();
});

test("the all-agents mission read requires a session", async ({ page, playwright, baseURL }) => {
  const stranger = await playwright.request.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  expect((await stranger.get("/api/hermes/office/chat?agentId=all")).status()).toBe(401);
  await stranger.dispose();
  await login(page);
  const response = await page.request.get("/api/hermes/office/chat?agentId=all");
  expect(response.status()).toBe(200);
  expect(Array.isArray((await response.json()).jobs)).toBe(true);
});

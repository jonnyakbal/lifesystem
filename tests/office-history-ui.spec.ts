import { test, expect, type Page } from "@playwright/test";

const now = Date.now();
const at = (minutes: number) => new Date(now - minutes * 60_000).toISOString();
const job = (id: string, text: string, minutes: number) => ({
  id, clientId: `c-${id}`, agentId: "sirius", text, response: `Resposta ${text}`, status: "completed", createdAt: at(minutes), updatedAt: at(minutes),
});

async function login(page: Page) {
  await page.request.post("/api/login", { data: { user: "office-test", password: "office-ui-test-only" } });
  await page.context().addCookies((await page.request.storageState()).cookies);
}

test("older and archived conversations load on demand, newest first", async ({ page }) => {
  await login(page);
  const recent = Array.from({ length: 50 }, (_, i) => job(`r${i}`, `Recente ${i}`, 50 - i));
  const requests: URLSearchParams[] = [];
  await page.route("**/api/hermes/office/chat**", (route) => route.fulfill({ json: { jobs: recent } }));
  await page.route("**/api/hermes/office/chat/history**", (route) => {
    const q = new URL(route.request().url()).searchParams;
    requests.push(q);
    if (q.get("archived") === "true")
      return route.fulfill({ json: { jobs: [job("a1", "Arquivada nova", 90_000), job("a0", "Arquivada antiga", 95_000)], nextCursor: null, activeCount: 55, archivedCount: 2 } });
    if (q.get("before"))
      return route.fulfill({ json: { jobs: [job("o1", "Anterior 1", 60), job("o0", "Anterior 0", 70)], nextCursor: null, activeCount: 55, archivedCount: 2 } });
    return route.fulfill({ json: { jobs: recent.slice(-20).reverse(), nextCursor: "x", activeCount: 55, archivedCount: 2 } });
  });
  await page.goto("/escritorio");
  await page.getByRole("button", { name: "Focalizar Sirius", exact: true }).click();
  const log = page.getByRole("log", { name: "Histórico de Sirius" });
  await expect(log).toContainText("Recente 49");

  await log.getByRole("button", { name: "Carregar conversas anteriores" }).click();
  await expect(log.getByText("Anterior 0", { exact: true })).toBeVisible();
  const cursor = requests.find((q) => q.get("before") && q.get("archived") === "false")!.get("before")!;
  expect(JSON.parse(Buffer.from(cursor, "base64url").toString())).toEqual(expect.objectContaining({ a: "sirius", ar: false, id: "r0" }));
  const texts = await log.locator("article [class*='user'] p").allTextContents();
  expect(texts.indexOf("Anterior 0")).toBeLessThan(texts.indexOf("Anterior 1"));
  expect(texts.indexOf("Anterior 1")).toBeLessThan(texts.indexOf("Recente 0"));

  await page.getByRole("button", { name: "Ver arquivadas (2)" }).click();
  await expect(log).toContainText("Conversas arquivadas · somente leitura");
  await expect(log.getByText("Arquivada antiga", { exact: true })).toBeVisible();
  await expect(log.getByText("Recente 49", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Voltar à conversa" }).click();
  await expect(log.getByText("Recente 49", { exact: true })).toBeVisible();
});

test("archiving needs a preview and confirmation, and a retry reuses the same request", async ({ page }) => {
  await login(page);
  const posts: Record<string, unknown>[] = [];
  let revision = 4;
  await page.route("**/api/hermes/office/chat/history**", (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      posts.push(body);
      if (posts.length === 1) return route.fulfill({ status: 503, json: { error: "Não foi possível concluir." } });
      revision++;
      return route.fulfill({ json: { receipt: { archivedCount: 3, revision } } });
    }
    return route.fulfill({ json: { eligible: posts.length > 1 ? 0 : 3, activeCount: posts.length > 1 ? 840 : 843, archivedCount: posts.length > 1 ? 3 : 0, revision } });
  });
  await page.goto("/escritorio");
  await page.getByRole("button", { name: /^Missões/ }).click();
  const board = page.getByRole("region", { name: "Central de missões" });
  await expect(board.getByText("Histórico ativo: 843 de 1000")).toBeVisible();
  await expect(board.getByText(/Perto do limite/)).toBeVisible();

  await board.getByRole("button", { name: "Arquivar 3 conversa(s) concluída(s) com mais de 30 dias" }).click();
  await board.getByRole("button", { name: "Cancelar" }).click();
  expect(posts).toEqual([]);

  await board.getByRole("button", { name: /^Arquivar 3/ }).click();
  await board.getByRole("button", { name: "Confirmar: arquivar 3" }).click();
  await expect(board.getByRole("alert").filter({ hasText: "Não foi possível concluir." })).toBeVisible();
  await board.getByRole("button", { name: "Confirmar: arquivar 3" }).click();
  await expect(board.getByText("Nenhuma conversa concluída com mais de 30 dias para arquivar.")).toBeVisible();

  expect(posts).toHaveLength(2);
  expect(posts[0]).toEqual(expect.objectContaining({ op: "archive", agentId: null, expectedRevision: 4 }));
  expect(posts[1].requestId).toBe(posts[0].requestId);
  expect(posts[0].requestId).toMatch(/^[0-9a-f-]{36}$/);
  await expect(page.getByRole("status").filter({ hasText: "3 conversa(s) arquivada(s)" }).first()).toBeVisible();
});

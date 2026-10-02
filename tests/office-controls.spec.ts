import { test, expect, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.request.post("/api/login", {
    data: { user: "office-test", password: "office-ui-test-only" },
  });
  await page.context().addCookies((await page.request.storageState()).cookies);
}

const notice = (page: Page) =>
  page.getByRole("region", { name: "Escritório dos agentes" }).getByRole("status").first();

test("every station control answers visibly and overview keeps the current view", async ({ page }) => {
  await login(page);
  await page.goto("/escritorio");
  await page.getByRole("button", { name: "Tripulação", exact: true }).click();

  await page.getByRole("button", { name: "Visão geral", exact: true }).click();
  await expect(notice(page)).toHaveText("Câmera de volta à visão geral da estação.");
  // Overview no longer throws the station view back to the universe map.
  await expect(page.getByRole("button", { name: "Tripulação", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Explorar universo", exact: true }).click();
  await page.getByRole("button", { name: "Visão geral", exact: true }).click();
  await expect(notice(page)).toHaveText("Câmera de volta à visão geral do universo.");

  await page.getByRole("button", { name: "Pausar animações", exact: true }).click();
  await expect(notice(page)).toHaveText("Animações pausadas.");
  await page.getByRole("button", { name: "Passeio orbital", exact: true }).click();
  await expect(notice(page)).toHaveText("Retome as animações para iniciar o passeio orbital.");
  await expect(page.getByRole("button", { name: "Passeio orbital", exact: true })).toHaveAttribute("aria-pressed", "false");

  await page.getByRole("button", { name: "Retomar animações", exact: true }).click();
  await page.getByRole("button", { name: "Passeio orbital", exact: true }).click();
  await expect(notice(page)).toContainText("Passeio orbital iniciado");
  await expect(page.getByRole("button", { name: "Parar passeio", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Parar passeio", exact: true }).click();
  await expect(notice(page)).toHaveText("Passeio orbital encerrado.");
});

test("reduced motion explains why the orbital tour stays off", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await login(page);
  await page.goto("/escritorio");
  await page.getByRole("button", { name: "Passeio orbital", exact: true }).click();
  await expect(notice(page)).toHaveText("Passeio indisponível: seu sistema pede menos movimento.");
});

test("number keys pick crew members but never hijack typing", async ({ page }) => {
  await login(page);
  await page.goto("/escritorio");
  // The shortcut exists once the page is hydrated; a key pressed earlier is
  // simply not handled, so press again like a person would.
  await expect(async () => {
    await page.locator("body").press("3");
    await expect(page.getByRole("region", { name: "Conversa com Sirius" })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await expect(notice(page)).toContainText("Sirius em foco");
  await page.getByLabel("Mensagem para Sirius").fill("prazo 2");
  await expect(page.getByLabel("Mensagem para Sirius")).toHaveValue("prazo 2");
  await expect(page.getByRole("region", { name: "Conversa com Sirius" })).toBeVisible();
});

test("refreshing destinations confirms when data arrived and empty filters explain themselves", async ({ page }) => {
  await login(page);
  await page.goto("/escritorio");
  const directory = page.getByRole("navigation", { name: "Destinos estelares" });
  await directory.getByRole("button", { name: /Atualizar dados/ }).click();
  await expect(directory.getByText(/Dados atualizados às \d{2}:\d{2}:\d{2}/)).toBeVisible();
  await directory.getByRole("button", { name: "Pilares", exact: true }).click();
  await expect(directory.getByRole("status").filter({ hasText: /pilar|Pilares/i }).or(directory.getByRole("button", { name: /^Explorar / }).first())).toBeVisible();
});

test("polling never pulls the reader away from an older message", async ({ page }) => {
  await login(page);
  const long = Array.from({ length: 80 }, (_, i) => `Linha ${i + 1} de uma resposta longa.`).join("\n");
  const now = Date.now();
  const jobs = Array.from({ length: 6 }, (_, i) => ({
    id: `job-${i}`, clientId: `c-${i}`, agentId: "hermes", text: `Pedido ${i}`,
    status: "completed", response: long,
    createdAt: new Date(now - (10 - i) * 60_000).toISOString(),
    updatedAt: new Date(now - (10 - i) * 60_000).toISOString(),
  }));
  let polls = 0;
  await page.route("**/api/hermes/office/chat**", (route) => {
    polls++;
    return route.fulfill({ json: { jobs } });
  });
  await page.goto("/escritorio");
  await page.getByRole("button", { name: "Focalizar Hermes", exact: true }).click();
  const log = page.getByRole("log", { name: "Histórico de Hermes" });
  await expect(log).toContainText("Pedido 5");
  await log.evaluate((el) => el.scrollTo({ top: 200 }));
  await log.dispatchEvent("scroll");
  const before = polls;
  await expect.poll(() => polls, { timeout: 12_000 }).toBeGreaterThan(before + 1);
  expect(await log.evaluate((el) => el.scrollTop)).toBeLessThan(400);

  jobs.push({ ...jobs[5], id: "job-new", clientId: "c-new", text: "Pedido novo", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  const jump = page.getByRole("button", { name: "Novas mensagens ↓" });
  await expect(jump).toBeVisible({ timeout: 10_000 });
  expect(await log.evaluate((el) => el.scrollTop)).toBeLessThan(400);
  await jump.click();
  await expect(jump).toBeHidden();
  expect(await log.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight)).toBeLessThan(48);
});

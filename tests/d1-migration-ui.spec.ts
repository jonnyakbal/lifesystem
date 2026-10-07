import { test, expect } from "@playwright/test";

test("data page compares collections and only offers copying when D1 is configured", async ({ page, playwright }) => {
  const anon = await playwright.request.newContext({ baseURL: "http://localhost:3107", storageState: { cookies: [], origins: [] } });
  expect((await anon.get("/api/storage/d1-migration")).status()).toBe(401);

  await page.request.post("/api/login", { data: { user: "office-test", password: "office-ui-test-only" } });
  await page.context().addCookies((await page.request.storageState()).cookies);
  await page.goto("/dados");
  await expect(page.getByRole("heading", { level: 1, name: "Banco de dados" })).toBeVisible();
  const status = page.getByRole("region", { name: "Situação" });
  await expect(status).toContainText("Arquivos");
  await expect(status).toContainText("D1 configuradoNão");
  await expect(page.getByRole("button", { name: "Copiar para o D1" })).toBeDisabled();
  await expect(page.getByRole("region", { name: "Próximo passo" })).toContainText("LIFESYSTEM_STORAGE");
});

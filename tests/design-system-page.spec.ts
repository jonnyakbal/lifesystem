import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

test("design page documents the system with live components and fits a phone", async ({ page }) => {
  await page.request.post("/api/login", { data: { user: "office-test", password: "office-ui-test-only" } });
  await page.context().addCookies((await page.request.storageState()).cookies);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/design");
  await expect(page.getByRole("heading", { level: 1, name: "Design do LifeSystem" })).toBeVisible();
  for (const name of ["Princípios", "Cores", "Tipografia", "Linha de tarefa", "Decisões para aprovar"])
    await expect(page.getByRole("heading", { level: 2, name })).toBeAttached();

  // The task line keeps "open" and "complete" apart, and completion is reversible.
  const complete = page.getByRole("button", { name: "Concluir" }).nth(1);
  await complete.click();
  await expect(page.getByRole("button", { name: "Feita" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Arquivar exemplo" }).click();
  await page.getByRole("button", { name: "Desfazer" }).click();
  await expect(page.getByRole("button", { name: "Arquivar exemplo" })).toBeVisible();

  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(errors).toEqual([]);
});

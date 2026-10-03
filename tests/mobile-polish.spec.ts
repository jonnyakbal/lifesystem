import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test("phone layout: no sideways scroll and comfortable touch targets", async ({ page }) => {
  await page.request.post("/api/login", { data: { user: "office-test", password: "office-ui-test-only" } });
  await page.context().addCookies((await page.request.storageState()).cookies);
  for (const route of ["/hoje", "/planejar", "/profissional", "/escritorio", "/tarefas"]) {
    await page.goto(route);
    const bell = page.getByRole("button", { name: "Abrir notificações" });
    await expect(bell).toBeVisible();
    expect((await bell.boundingBox())!.height).toBeGreaterThanOrEqual(40);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  }
  await expect(page.getByRole("button", { name: "Abrir copiloto" })).toBeVisible();
  await page.goto("/escritorio");
  const overview = page.getByRole("button", { name: "Visão geral", exact: true });
  expect((await overview.boundingBox())!.height).toBeGreaterThanOrEqual(40);
});

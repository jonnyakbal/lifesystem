import { test, expect } from "@playwright/test";
test("scientific station remains explorable with reduced motion on desktop and mobile", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.request.post("/api/login", {
    data: { user: "office-test", password: "office-ui-test-only" },
  });
  await context.addCookies((await page.request.storageState()).cookies);
  await page.setViewportSize({ width: 1550, height: 1120 });
  await page.goto("/escritorio");
  await expect(page.locator("canvas")).toBeVisible({ timeout: 60000 });
  await page.getByRole("button", { name: "Visão geral", exact: true }).click();
  await page.waitForTimeout(700);
  await page
    .getByLabel("Escritório dos agentes", { exact: true })
    .screenshot({ path: "test-results/orbital-overview.png" });
  await page
    .getByRole("button", { name: "Reunir equipe", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Ampliar estação", exact: true })
    .click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: "test-results/orbital-expanded.png" });
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("canvas").scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
  await page.screenshot({
    path: "test-results/orbital-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page
    .getByRole("button", { name: "Voltar às estações", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Reunir equipe", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("orbital station offers crew interactions without sending commands to agents", async ({
  page,
  context,
}) => {
  const writes: string[] = [];
  page.on("request", (req) => {
    if (req.method() === "POST" && !req.url().endsWith("/api/login"))
      writes.push(req.url());
  });
  await page.request.post("/api/login", {
    data: { user: "office-test", password: "office-ui-test-only" },
  });
  await context.addCookies((await page.request.storageState()).cookies);
  await page.goto("/escritorio");
  await expect(page.locator("canvas")).toBeVisible({ timeout: 60000 });
  await page
    .getByRole("button", { name: "Reunir equipe", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Voltar às estações", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Animação de ambientação · não executa tarefas", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByLabel("Selecionar agente", { exact: true })
    .getByRole("button", { name: /Cosmo/ })
    .click();
  await page
    .getByRole("button", { name: "Cumprimentar Cosmo", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Cosmo" }),
  ).toContainText("ideia");
  await page
    .getByRole("button", { name: "Pausar animações", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Retomar animações", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Ampliar estação", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Sair da visão ampliada", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Estação Jonny ampliada" }),
  ).toHaveAttribute("aria-modal", "true");
  await expect(
    page.getByRole("button", { name: "Visão geral", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    page.getByRole("button", { name: "Mudar órbita", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Focalizar Astro", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Cumprimentar Astro", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Ampliar estação", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Ampliar estação", exact: true })
    .click();
  await page
    .locator("canvas")
    .evaluate((canvas) => canvas.dispatchEvent(new Event("webglcontextlost")));
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
    "hidden",
  );
  expect(writes).toEqual([]);
});
test("office renders 3D, authenticates presence and explains every agent", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const login = await page.request.post("/api/login", {
    data: { user: "office-test", password: "office-ui-test-only" },
  });
  expect(login.ok()).toBeTruthy();
  const cookies = await page.request.storageState();
  await context.addCookies(cookies.cookies);
  await page.setViewportSize({ width: 1500, height: 1050 });
  await page.goto("/escritorio");
  await expect(
    page.getByRole("heading", { name: /Um lugar para/ }),
  ).toBeVisible();
  await expect(page.getByLabel("Ficha de Hermes")).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible({ timeout: 60000 });
  expect(
    (await page.getByRole("heading", { name: /Um lugar para/ }).boundingBox())!
      .x,
  ).toBeGreaterThanOrEqual(248);
  // The roster is a labeled div; select by label to avoid duplicate scene buttons.
  await page
    .getByLabel("Selecionar agente", { exact: true })
    .getByRole("button", { name: /Sirius/ })
    .click();
  await expect(page.getByLabel("Ficha de Sirius")).toBeVisible();
  await expect(
    page.getByText("Integração pendente", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/office-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Lista", exact: true }).click();
  await expect(page.locator("canvas")).toHaveCount(0);
  for (const name of ["Vega", "Órion", "Astro", "Cosmo"]) {
    await page
      .getByLabel("Selecionar agente", { exact: true })
      .getByRole("button", { name: new RegExp(name) })
      .click();
    await expect(page.getByLabel(`Ficha de ${name}`)).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/office-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});

test("office receives actual API events and renders running then available without LLM calls", async ({
  page,
  context,
}) => {
  const login = await page.request.post("/api/login", {
    data: { user: "office-test", password: "office-ui-test-only" },
  });
  expect(login.ok()).toBeTruthy();
  await context.addCookies((await page.request.storageState()).cookies);
  const headers = {
    authorization: "Bearer office-test-token-only-12345678901234567890",
  };
  const registration = await page.request.post("/api/hermes/office/sessions", {
    headers,
    data: { bootId: crypto.randomUUID() },
  });
  expect(registration.ok()).toBeTruthy();
  const { id } = await registration.json();
  const publish = (sequence: number, runs: unknown[]) =>
    page.request.post("/api/hermes/office/events", {
      headers,
      data: [
        {
          schemaVersion: 1,
          sessionId: id,
          sequence,
          kind: "snapshot",
          emittedAt: new Date().toISOString(),
          payload: {
            monitored: ["vega", "sirius", "orion", "astro", "cosmo"],
            runs,
            catalogRevision: null,
            gap: false,
          },
        },
      ],
    });
  expect(
    (
      await publish(1, [
        {
          runId: "ui-run",
          agentId: "cosmo",
          channel: "whatsapp",
          status: "running",
          acceptedAt: new Date().toISOString(),
          startedAt: new Date().toISOString(),
        },
      ])
    ).ok(),
  ).toBeTruthy();
  await page.goto("/escritorio");
  await page.getByRole("button", { name: "Lista", exact: true }).click();
  await expect(
    page
      .getByLabel("Selecionar agente", { exact: true })
      .getByRole("button", { name: /Cosmo/ }),
  ).toContainText("Trabalhando");
  expect((await publish(2, [])).ok()).toBeTruthy();
  await expect(
    page
      .getByLabel("Selecionar agente", { exact: true })
      .getByRole("button", { name: /Cosmo/ }),
  ).toContainText("Disponível", { timeout: 12000 });
  await expect(
    page
      .getByLabel("Selecionar agente", { exact: true })
      .getByRole("button", { name: /Hermes/ }),
  ).toContainText("Atividade não monitorada");
});

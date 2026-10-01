import { test, expect, type Route } from "@playwright/test";

test("station chats pin the selected agent, show actual replies and never send on selection", async ({
  page,
  context,
}) => {
  await page.request.post("/api/login", {
    data: { user: "office-test", password: "office-ui-test-only" },
  });
  await context.addCookies((await page.request.storageState()).cookies);
  const jobs: Record<string, unknown>[] = [];
  await page.route("**/api/hermes/office/chat**", (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({
        json: {
          jobs: jobs.filter(
            (j) =>
              j.agentId ===
              new URL(route.request().url()).searchParams.get("agentId"),
          ),
        },
      });
    const body = route.request().postDataJSON();
    const job = {
      ...body,
      id: "conversation-test",
      status: "completed",
      response: "Consultei os projetos: avance a validação do ArcoPass.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    jobs.push(job);
    return route.fulfill({ json: { job } });
  });
  await page.goto("/escritorio");
  await page
    .getByRole("button", { name: "Focalizar Sirius", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Conversa com Sirius" }),
  ).toBeVisible();
  expect(jobs).toHaveLength(0);
  await page
    .getByLabel("Mensagem para Sirius")
    .fill("Consulte meus projetos e proponha prioridades.");
  await page
    .getByRole("button", { name: "Enviar para Sirius", exact: true })
    .click();
  await expect(
    page.getByText("Consultei os projetos: avance a validação do ArcoPass.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(jobs[0].agentId).toBe("sirius");
  expect(jobs).toHaveLength(1);
  await page
    .getByRole("button", { name: "Focalizar Vega", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Conversa com Vega" }),
  ).toBeVisible();
  await expect(
    page.getByText("Consultei os projetos: avance a validação do ArcoPass.", {
      exact: true,
    }),
  ).toHaveCount(0);
  expect(jobs).toHaveLength(1);
});

test("stellar navigation opens real projects and writes tasks only on explicit submission", async ({
  page,
  context,
}) => {
  await page.request.post("/api/login", {
    data: { user: "office-test", password: "office-ui-test-only" },
  });
  await context.addCookies((await page.request.storageState()).cookies);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const tasks = [
    {
      id: "flight-task",
      title: "Validar jornada de compra",
      status: "ready",
      projectId: "pass",
      priority: "important",
      tags: [],
      checklist: [],
    },
  ];
  const writes: { method: string; body: Record<string, unknown> }[] = [];
  await page.route("**/api/projects", (route) =>
    route.fulfill({
      json: [
        {
          id: "pass",
          name: "ArcoPass",
          description: "Uma jornada melhor para eventos",
          status: "active",
          tags: [],
          links: [],
          needs: "Validar o próximo avanço",
        },
      ],
    }),
  );
  await page.route("**/api/pillars", (route) =>
    route.fulfill({
      json: [
        {
          id: "health",
          name: "Corpo e saúde",
          description: "Cuidar da energia",
          currentStatus: "",
          target: "Constância",
          color: "#a8c68c",
        },
      ],
    }),
  );
  await page.route("**/api/stage-configs/tasks", (route) =>
    route.fulfill({
      json: {
        stages: [
          { id: "ready", label: "Preparar", color: "#aabbcc" },
          {
            id: "complete",
            label: "Entregue",
            color: "#99ccaa",
            isTerminal: true,
          },
        ],
      },
    }),
  );
  await page.route("**/api/tasks", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: tasks });
    const body = route.request().postDataJSON();
    writes.push({ method: "POST", body });
    const next = { ...body, id: "created-orbit-task" };
    tasks.push(next);
    await route.fulfill({ status: 201, json: next });
  });
  await page.route("**/api/tasks/flight-task", async (route) => {
    const body = route.request().postDataJSON();
    writes.push({ method: "PATCH", body });
    Object.assign(tasks[0], body);
    await route.fulfill({ json: tasks[0] });
  });
  await page.goto("/escritorio");
  await expect(
    page.getByRole("button", { name: "Escritório 3D", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("navigation", { name: "Destinos estelares" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Lista", exact: true }).click();
  await page
    .getByRole("button", { name: "Explorar universo", exact: true })
    .click();
  await expect(page.locator("canvas")).toBeVisible({ timeout: 60000 });
  await page
    .locator("canvas")
    .evaluate((el) => el.setAttribute("data-scene-check", "same-scene"));
  await page
    .getByRole("button", { name: "Focalizar Sirius", exact: true })
    .click();
  const command = page.getByRole("region", { name: "Comando de Sirius" });
  await expect(command).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Destinos estelares" }),
  ).toBeVisible();
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-scene-check",
    "same-scene",
  );
  await page
    .getByRole("navigation", { name: "Área de trabalho de Sirius" })
    .getByRole("button", { name: "ArcoPass" })
    .click();
  await expect(command).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Painel de ArcoPass" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tripulação", exact: true }).click();
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-scene-check",
    "same-scene",
  );
  await page
    .getByRole("button", { name: "Explorar ArcoPass", exact: true })
    .click();
  const panel = page.getByRole("region", { name: "Painel de ArcoPass" });
  await expect(panel).toContainText("Validar jornada de compra");
  expect(writes).toEqual([]);
  await panel
    .getByLabel("Etapa de Validar jornada de compra")
    .selectOption("complete");
  await expect
    .poll(() => writes[0])
    .toEqual({ method: "PATCH", body: { status: "complete" } });
  await panel
    .getByLabel("Nova tarefa")
    .fill("Revisar checkout com um organizador");
  await panel
    .getByRole("button", { name: "Criar tarefa", exact: true })
    .click();
  await expect(panel).toContainText("Revisar checkout com um organizador");
  expect(writes[1].body).toMatchObject({
    title: "Revisar checkout com um organizador",
    projectId: "pass",
    status: "ready",
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.waitForTimeout(1000);
  await page
    .getByLabel("Escritório dos agentes", { exact: true })
    .screenshot({ path: "test-results/stellar-project.png" });
  await page
    .getByRole("button", { name: "Fechar painel", exact: true })
    .click();
  await page.waitForTimeout(700);
  await page
    .getByLabel("Escritório dos agentes", { exact: true })
    .screenshot({ path: "test-results/stellar-overview.png" });
  await page
    .getByRole("button", { name: "Explorar Corpo e saúde", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Painel de Corpo e saúde" }),
  ).toContainText("Constância");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/stellar-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.setViewportSize({ width: 600, height: 390 });
  await page
    .getByRole("button", { name: "Ampliar estação", exact: true })
    .click();
  const expanded = page.getByRole("dialog", { name: "Estação Jonny ampliada" });
  const bounds = await expanded.boundingBox();
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(390);
  const input = expanded.getByLabel("Nova tarefa");
  await input.scrollIntoViewIfNeeded();
  await expect(input).toBeInViewport();
  await input.focus();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("region", { name: "Painel de Corpo e saúde" }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(expanded).toHaveCount(0);
});

test("stellar map reports unavailable data without fabricating empty projects", async ({
  page,
  context,
}) => {
  await page.request.post("/api/login", {
    data: { user: "office-test", password: "office-ui-test-only" },
  });
  await context.addCookies((await page.request.storageState()).cookies);
  await page.route("**/api/projects", (route) =>
    route.fulfill({ status: 503, json: { error: "Unavailable" } }),
  );
  await page.goto("/escritorio");
  await page
    .getByRole("button", { name: "Explorar universo", exact: true })
    .click();
  await expect(
    page
      .getByRole("navigation", { name: "Destinos estelares" })
      .getByRole("alert"),
  ).toContainText("Não foi possível carregar o mapa");
  await expect(
    page.getByRole("button", { name: "Tentar novamente", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Nenhum projeto cadastrado.", { exact: true }),
  ).toHaveCount(0);
});
test("stellar confirmed writes survive a slower refresh and failed writes are not retried", async ({
  page,
  context,
}) => {
  await page.request.post("/api/login", {
    data: { user: "office-test", password: "office-ui-test-only" },
  });
  await context.addCookies((await page.request.storageState()).cookies);
  const stages = {
    stages: [{ id: "ready", label: "Preparar", color: "#aabbcc" }],
  };
  let stageReads = 0,
    posts = 0;
  let delayedRead: Route | undefined, delayedWrite: Route | undefined;
  await page.route("**/api/projects", (route) =>
    route.fulfill({ json: [{ id: "pass", name: "ArcoPass" }] }),
  );
  await page.route("**/api/pillars", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/stage-configs/tasks", async (route) => {
    stageReads++;
    if (stageReads === 2) {
      delayedRead = route;
      return;
    }
    await route.fulfill({ json: stages });
  });
  await page.route("**/api/tasks", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: [] });
    posts++;
    if (posts === 1) {
      delayedWrite = route;
      return;
    }
    await route.fulfill({
      status: 503,
      json: { error: "Serviço temporariamente indisponível" },
    });
  });
  await page.goto("/escritorio");
  await page
    .getByRole("button", { name: "Explorar universo", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Explorar ArcoPass", exact: true })
    .click();
  const panel = page.getByRole("region", { name: "Painel de ArcoPass" });
  await panel.getByLabel("Nova tarefa").fill("Recibo preservado");
  await panel
    .getByRole("button", { name: "Criar tarefa", exact: true })
    .click();
  await expect.poll(() => posts).toBe(1);
  await page.getByRole("button", { name: "Atualizar dados" }).click();
  await expect.poll(() => !!delayedRead).toBe(true);
  await delayedWrite!.fulfill({
    status: 201,
    json: {
      id: "receipt",
      title: "Recibo preservado",
      projectId: "pass",
      status: "ready",
    },
  });
  await expect(
    panel.getByText("Recibo preservado", { exact: true }),
  ).toBeVisible();
  await delayedRead!.fulfill({ json: stages });
  await expect(
    page.getByRole("button", { name: "Atualizar dados" }),
  ).toBeEnabled();
  await expect(
    panel.getByText("Recibo preservado", { exact: true }),
  ).toBeVisible();
  await panel.getByLabel("Nova tarefa").fill("Não confirmar sem recibo");
  await panel
    .getByRole("button", { name: "Criar tarefa", exact: true })
    .click();
  await expect(panel.getByRole("alert")).toContainText(
    "temporariamente indisponível",
  );
  await expect(panel.getByRole("status")).toHaveCount(0);
  await expect(panel.getByLabel("Nova tarefa")).toHaveValue(
    "Não confirmar sem recibo",
  );
  expect(posts).toBe(2);
});

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
  await page.getByRole("button", { name: /Reunir equipe/ }).click();
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
  await page.getByRole("button", { name: /Aos postos/ }).click();
  await expect(
    page.getByRole("button", { name: /Reunir equipe/ }),
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
  await page.getByRole("button", { name: /Reunir equipe/ }).click();
  await expect(page.getByRole("button", { name: /Aos postos/ })).toBeVisible();
  await expect(
    page.getByText("Animação de ambiente", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Selecionar agente", { exact: true })
    .getByRole("button", { name: /Cosmo/ })
    .click();
  await expect(
    page.getByRole("region", { name: "Comando de Cosmo" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Área de trabalho de Cosmo" }),
  ).toContainText("Central de conteúdo");
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
  expect(
    await page
      .getByRole("dialog")
      .evaluate((dialog) => dialog.contains(document.activeElement)),
  ).toBeTruthy();
  await page
    .getByRole("button", { name: "Focalizar Astro", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Comando de Astro" }),
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
  await page
    .getByRole("button", { name: "Focalizar Hermes", exact: true })
    .click();
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

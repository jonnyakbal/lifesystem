import { test, expect, type Page } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ingestOffice, readOffice, registerPublisher } from "../src/lib/office/store";
import { projectOffice } from "../src/lib/office/view";
import catalog from "../src/lib/office/catalog.json";

let dir: string;
let previous: string | undefined;
test.beforeEach(async () => {
  previous = process.env.LIFESYSTEM_DATA_DIR;
  dir = await mkdtemp(join(tmpdir(), "office-provenance-"));
  process.env.LIFESYSTEM_DATA_DIR = dir;
});
test.afterEach(async () => {
  if (previous === undefined) delete process.env.LIFESYSTEM_DATA_DIR;
  else process.env.LIFESYSTEM_DATA_DIR = previous;
  await rm(dir, { recursive: true, force: true });
});

const time = () => new Date().toISOString();
const snapshot = (sessionId: string, sequence: number, catalogRevision: string | null) => ({
  schemaVersion: 1, sessionId, sequence, kind: "snapshot", emittedAt: time(),
  payload: { monitored: ["vega", "sirius", "orion", "astro", "cosmo"], runs: [], catalogRevision, gap: false },
});
const published = (sessionId: string, sequence: number, provenance: "local" | "deployed", revision = "rev-deployed-1") => ({
  schemaVersion: 1, sessionId, sequence, kind: "catalog.updated", emittedAt: time(),
  payload: { ...catalog, provenance, revision },
});

test("catalog provenance distinguishes local, received, awaiting and stale", async () => {
  expect(projectOffice(await readOffice("personal")).catalogState).toBe("local");

  const session = await registerPublisher("personal", "prov-boot");
  await ingestOffice("personal", [published(session.id, 1, "deployed"), snapshot(session.id, 2, "rev-deployed-1")]);
  const received = projectOffice(await readOffice("personal"));
  expect(received).toEqual(expect.objectContaining({ catalogState: "received", catalogRevision: "rev-deployed-1", catalogCurrent: true }));
  expect(received.catalogReceivedAt).toEqual(expect.any(String));

  // A snapshot naming another revision leaves the received catalog unconfirmed.
  await ingestOffice("personal", [snapshot(session.id, 3, "rev-other")]);
  expect(projectOffice(await readOffice("personal")).catalogState).toBe("awaiting");

  // Silence beyond 90 s is reported as such, not as a confirmed catalog.
  await ingestOffice("personal", [snapshot(session.id, 4, "rev-deployed-1")]);
  const later = Date.now() + 120_000;
  expect(projectOffice(await readOffice("personal"), later).catalogState).toBe("stale");
});

test("a catalog flagged local is never presented as received", async () => {
  const session = await registerPublisher("personal", "local-boot");
  await ingestOffice("personal", [published(session.id, 1, "local"), snapshot(session.id, 2, "rev-deployed-1")]);
  expect(projectOffice(await readOffice("personal")).catalogState).toBe("awaiting");
});

async function openSirius(page: Page, response: string) {
  await page.request.post("/api/login", { data: { user: "office-test", password: "office-ui-test-only" } });
  await page.context().addCookies((await page.request.storageState()).cookies);
  const now = new Date().toISOString();
  await page.route("**/api/hermes/office/chat**", (route) =>
    route.fulfill({ json: { jobs: [{ id: "long", clientId: "l", agentId: "sirius", text: "Plano", response, status: "completed", createdAt: now, updatedAt: now }] } }));
  await page.goto("/escritorio");
  await page.getByRole("button", { name: "Focalizar Sirius", exact: true }).click();
}

test("long replies collapse, expand and copy exactly the received text", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const response = Array.from({ length: 40 }, (_, i) => `- Passo ${i + 1}: <script>alert(${i})</script> validar`).join("\n");
  await openSirius(page, response);
  const reply = page.locator("article", { hasText: "Passo 1:" });
  await expect(reply.getByRole("button", { name: "Ler tudo" })).toHaveAttribute("aria-expanded", "false");
  const collapsed = await reply.locator("p", { hasText: "Passo 1:" }).evaluate((el) => el.clientHeight);
  await reply.getByRole("button", { name: "Ler tudo" }).click();
  await expect(reply.getByRole("button", { name: "Recolher" })).toHaveAttribute("aria-expanded", "true");
  expect(await reply.locator("p", { hasText: "Passo 1:" }).evaluate((el) => el.clientHeight)).toBeGreaterThan(collapsed * 2);
  // Markup in a reply stays text.
  await expect(reply.locator("script")).toHaveCount(0);
  await reply.getByRole("button", { name: "Copiar" }).click();
  await expect(reply.getByRole("button", { name: "Copiado ✓" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(response);
});

test("a refused clipboard says so instead of pretending to copy", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("denied")) }, configurable: true });
  });
  await openSirius(page, "Resposta curta.");
  const reply = page.locator("article", { hasText: "Resposta curta." });
  await expect(reply.getByRole("button", { name: "Ler tudo" })).toHaveCount(0);
  await reply.getByRole("button", { name: "Copiar" }).click();
  await expect(reply.getByRole("button", { name: "Não foi possível copiar" })).toBeVisible();
});

test("the agent sheet states the provenance it receives, without upgrading it", async ({ page }) => {
  // Other suites may have published a catalog to the shared server; pin the state under test.
  await page.route("**/api/hermes/office", async (route) => {
    const real = await route.fetch();
    const view = await real.json();
    return route.fulfill({ json: { ...view, catalogState: "local", catalogRevision: null, catalogReceivedAt: null, catalog: null, catalogCurrent: false } });
  });
  await openSirius(page, "Ok.");
  await expect(page.getByRole("complementary", { name: "Ficha de Sirius" })).toContainText(
    "Referência local · nenhum catálogo recebido da instalação.",
  );
});

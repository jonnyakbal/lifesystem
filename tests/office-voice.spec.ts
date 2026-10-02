import { test, expect, type Page } from "@playwright/test";
import { speechChunks } from "../src/components/office/voice";

// The browser speech APIs are replaced by recorders: no audio leaves the test.
const fakeSpeech = `
  window.__spoken = [];
  window.__heard = "Organize minha semana de projetos";
  class FakeRecognition {
    start() {
      setTimeout(() => {
        const result = Object.assign([{ transcript: window.__heard }], { isFinal: true });
        this.onresult && this.onresult({ resultIndex: 0, results: [result] });
        this.onend && this.onend();
      }, 150);
    }
    stop() {}
    abort() {}
  }
  // Native properties are read-only accessors; plain assignment is ignored.
  const define = (name, value) => Object.defineProperty(window, name, { value, configurable: true, writable: true });
  define("webkitSpeechRecognition", FakeRecognition);
  define("SpeechRecognition", FakeRecognition);
  define("speechSynthesis", {
    getVoices: () => [],
    cancel: () => {},
    speak: (u) => { window.__spoken.push(u.text); setTimeout(() => { u.onstart && u.onstart(); u.onend && u.onend(); }, 10); },
  });
  define("SpeechSynthesisUtterance", function (text) { this.text = text; });
`;

async function open(page: Page, jobs: Record<string, unknown>[], posts: unknown[]) {
  await page.request.post("/api/login", { data: { user: "office-test", password: "office-ui-test-only" } });
  await page.context().addCookies((await page.request.storageState()).cookies);
  await page.route("**/api/hermes/office/chat**", (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: { jobs } });
    const body = route.request().postDataJSON();
    posts.push(body);
    const now = new Date().toISOString();
    const job = { ...body, id: `job-${posts.length}`, status: "queued", response: null, createdAt: now, updatedAt: now };
    jobs.push(job);
    return route.fulfill({ json: { job } });
  });
  await page.goto("/escritorio");
  await page.getByRole("button", { name: "Focalizar Sirius", exact: true }).click();
}

test("speaking fills the message without sending anything", async ({ page }) => {
  await page.addInitScript(fakeSpeech);
  const posts: unknown[] = [];
  await open(page, [], posts);
  await expect(page.getByText("no Chrome, o áudio vai para o Google")).toBeVisible();
  await page.getByRole("button", { name: "🎙 Falar com Sirius" }).click();
  await expect(page.getByLabel("Mensagem para Sirius")).toHaveValue("Organize minha semana de projetos");
  expect(posts).toEqual([]);
});

test("send-on-finish sends exactly the spoken words once", async ({ page }) => {
  await page.addInitScript(fakeSpeech);
  const posts: { text: string; agentId: string }[] = [];
  await open(page, [], posts);
  await page.getByLabel("Enviar ao terminar de falar").check();
  await page.getByRole("button", { name: "🎙 Falar com Sirius" }).click();
  await expect.poll(() => posts.length).toBe(1);
  expect(posts[0]).toEqual(expect.objectContaining({ agentId: "sirius", text: "Organize minha semana de projetos" }));
  await page.waitForTimeout(500);
  expect(posts).toHaveLength(1);
});

test("read-aloud speaks only replies that arrive after it is enabled", async ({ page }) => {
  await page.addInitScript(fakeSpeech);
  const now = new Date().toISOString();
  const jobs: Record<string, unknown>[] = [
    { id: "old", clientId: "o", agentId: "sirius", text: "Antigo", response: "Resposta antiga.", status: "completed", createdAt: now, updatedAt: now },
  ];
  await open(page, jobs, []);
  await page.getByLabel("Ouvir respostas").check();
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken)).toEqual([]);

  jobs.push({ id: "new", clientId: "n", agentId: "sirius", text: "Novo", response: "Primeira frase. Segunda frase!", status: "completed", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  await expect.poll(() => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken), { timeout: 10_000 })
    .toEqual(["Primeira frase.", "Segunda frase!"]);
  await page.waitForTimeout(4500);
  expect(await page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken)).toHaveLength(2);

  await page.locator("article", { hasText: "Resposta antiga." }).getByRole("button", { name: "▶ Ouvir" }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken.at(-1))).toBe("Resposta antiga.");
});

test("without speech recognition the station explains and keeps typing available", async ({ page }) => {
  const posts: unknown[] = [];
  await page.addInitScript(() => {
    for (const name of ["webkitSpeechRecognition", "SpeechRecognition"])
      Object.defineProperty(window, name, { value: undefined, configurable: true });
  });
  await open(page, [], posts);
  await expect(page.getByText("Seu navegador não oferece reconhecimento de voz; digite abaixo.")).toBeVisible();
  await expect(page.getByLabel("Mensagem para Sirius")).toBeEnabled();
});

test("speech chunks are short sentences and skip code blocks", () => {
  expect(speechChunks("Olá. Tudo bem? ```const a = 1;``` Fim!")).toEqual(["Olá.", "Tudo bem?", "(trecho de código omitido) Fim!"]);
  const long = speechChunks("palavra ".repeat(100));
  expect(long.length).toBeGreaterThan(1);
  expect(long.every((chunk) => chunk.length <= 220)).toBe(true);
});

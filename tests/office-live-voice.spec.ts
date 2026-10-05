import { test, expect } from "@playwright/test";
import { pickVoice, voiceScore } from "../src/components/office/voice";
import { spokenText, livePersona, liveRequestSchema } from "../src/lib/office/live";

const voices = [
  { name: "Microsoft Maria - Portuguese (Brazil)", lang: "pt-BR", localService: true },
  { name: "Microsoft Daniel Desktop", lang: "pt-BR", localService: true },
  { name: "Microsoft Francisca Online (Natural) - Portuguese (Brazil)", lang: "pt-BR", localService: false },
  { name: "Microsoft Antonio Online (Natural) - Portuguese (Brazil)", lang: "pt-BR", localService: false },
  { name: "Microsoft Thalita Online (Natural) - Portuguese (Brazil)", lang: "pt-BR", localService: false },
  { name: "Google US English", lang: "en-US", localService: false },
];

test("natural voices win, crew members get distinct ones, never a robotic fallback", () => {
  expect(voiceScore(voices[2])).toBeGreaterThan(voiceScore(voices[0]));
  expect(voiceScore(voices[5])).toBe(-1);
  expect(pickVoice(voices, "hermes")!.name).toContain("Antonio");
  expect(pickVoice(voices, "vega")!.name).toContain("Francisca");
  expect(pickVoice(voices, "astro")!.name).toContain("Thalita");
  for (const agent of ["hermes", "vega", "sirius", "orion", "astro", "cosmo"] as const)
    expect(pickVoice(voices, agent)!.name).toContain("Natural");
  expect(pickVoice([voices[0]], "sirius")!.name).toContain("Maria");
  expect(pickVoice([voices[5]], "sirius")).toBeUndefined();
});

test("live persona forbids claimed actions and speech drops markdown and links", () => {
  const persona = livePersona("vega");
  expect(persona).toContain("Vega");
  expect(persona).toContain("Nunca diga que registrou");
  expect(spokenText("**Oi!** veja https://x.y\n- item <think>x</think>")).toBe("Oi! veja item");
  expect(liveRequestSchema.safeParse({ agentId: "vega", text: "", history: [] }).success).toBe(false);
  expect(liveRequestSchema.safeParse({ agentId: "vega", text: "oi", extra: 1 }).success).toBe(false);
});

test("live route needs a session and says when no AI provider is configured", async ({ request, playwright }) => {
  const anon = await playwright.request.newContext({ baseURL: "http://localhost:3107", storageState: { cookies: [], origins: [] } });
  expect((await anon.post("/api/hermes/office/live", { data: { agentId: "vega", text: "oi" }, headers: { origin: "http://localhost:3107" } })).status()).toBe(401);
  await request.post("/api/login", { data: { user: "office-test", password: "office-ui-test-only" } });
  const r = await request.post("/api/hermes/office/live", { data: { agentId: "vega", text: "oi" }, headers: { origin: "http://localhost:3107" } });
  expect(r.status()).toBe(503);
});

test("hands-free loop: listen, answer fast, speak, listen again; touch interrupts", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    (w as { __recStarts: number }).__recStarts = 0;
    class FakeRec {
      lang = ""; continuous = false; interimResults = false;
      onresult: ((e: unknown) => void) | null = null; onerror = null; onend: (() => void) | null = null;
      start() {
        (w as { __recStarts: number }).__recStarts++;
        (w as { __rec: FakeRec }).__rec = this;
      }
      stop() { this.onend?.(); }
      abort() { this.onend?.(); }
    }
    const define = (name: string, value: unknown) => Object.defineProperty(window, name, { value, configurable: true, writable: true });
    define("webkitSpeechRecognition", FakeRec);
    define("SpeechRecognition", FakeRec);
    const spoken: string[] = [];
    (w as { __spoken: string[] }).__spoken = spoken;
    let current: { onend?: () => void; onstart?: () => void } | null = null;
    define("speechSynthesis", {
      getVoices: () => [{ name: "Microsoft Francisca Online (Natural)", lang: "pt-BR", localService: false }],
      speak(u: { text: string; onstart?: () => void; onend?: () => void }) { spoken.push(u.text); u.onstart?.(); current = u; },
      cancel() { current = null; },
      addEventListener() {},
    });
    (w as { __finishSpeech: () => void }).__finishSpeech = () => { const c = current; current = null; c?.onend?.(); };
    define("SpeechSynthesisUtterance", class { text: string; constructor(t: string) { this.text = t; } });
  });
  const asked: unknown[] = [];
  await page.route("**/api/hermes/office/live", async (route) => {
    asked.push(route.request().postDataJSON());
    await route.fulfill({ json: { text: "Oi! Seu caixa da semana parece tranquilo.", via: { provider: "cloudflare", model: "@cf/meta/llama", falhas: [] } } });
  });
  await page.request.post("/api/login", { data: { user: "office-test", password: "office-ui-test-only" } });
  await page.context().addCookies((await page.request.storageState()).cookies);
  await page.goto("/escritorio");
  await page.getByRole("button", { name: "Focalizar Vega", exact: true }).click();
  await page.getByRole("button", { name: "⚡ Conversa ao vivo com Vega" }).click();
  const live = page.getByRole("region", { name: "Conversa ao vivo com Vega" });
  await expect(live.getByText("Ouvindo… toque para enviar")).toBeVisible();

  await page.evaluate(() => {
    const rec = (window as unknown as { __rec: { onresult: (e: unknown) => void; onend: () => void } }).__rec;
    rec.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: "como está meu caixa" }], { isFinal: true })] });
    rec.onend();
  });
  await expect(live.getByText("Oi! Seu caixa da semana parece tranquilo.")).toBeVisible();
  await expect(live.getByText("Falando… toque para interromper")).toBeVisible();
  expect(asked[0]).toMatchObject({ agentId: "vega", text: "como está meu caixa", history: [] });
  await expect(live).toContainText("cloudflare");

  const before = await page.evaluate(() => (window as unknown as { __recStarts: number }).__recStarts);
  await page.evaluate(() => (window as unknown as { __finishSpeech: () => void }).__finishSpeech());
  await expect(live.getByText("Ouvindo… toque para enviar")).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __recStarts: number }).__recStarts)).toBe(before + 1);

  await live.getByRole("button", { name: "Mandar a última fala ao Hermes" }).click();
  await expect(page.getByLabel("Mensagem para Vega")).toHaveValue("como está meu caixa");
  await live.getByRole("button", { name: "Encerrar (Esc)" }).click();
  await expect(page.getByRole("button", { name: "⚡ Conversa ao vivo com Vega" })).toBeVisible();
  const starts = await page.evaluate(() => (window as unknown as { __recStarts: number }).__recStarts);
  await page.evaluate(() => (window as unknown as { __finishSpeech: () => void }).__finishSpeech());
  expect(await page.evaluate(() => (window as unknown as { __recStarts: number }).__recStarts)).toBe(starts);
});

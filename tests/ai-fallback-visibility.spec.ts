import { test, expect } from "@playwright/test";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

// Fallback used to be silent: a failing Cloudflare call fell through to the
// next provider with no trace. These checks run src/lib/ai.ts against local
// fake endpoints (no real provider, no real key).
let server: Server;
const touched = ["CLOUDFLARE_API_BASE", "CLOUDFLARE_ACCOUNT_ID", "AI_CLOUDFLARE_API_KEY", "AI_BASE_URL", "AI_API_KEY", "AI_MODELS", "AI_GROQ_API_KEY", "AI_OPENROUTER_API_KEY", "AI_MISTRAL_API_KEY", "AI_PROVIDER_ORDER"];
const saved = Object.fromEntries(touched.map((k) => [k, process.env[k]]));
let base = "";
const seen: { path: string; auth: string; tools: boolean }[] = [];

test.beforeAll(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const parsed = JSON.parse(body || "{}");
      seen.push({ path: req.url || "", auth: req.headers.authorization || "", tools: Boolean(parsed.tools) });
      res.setHeader("content-type", "application/json");
      if (req.url?.includes("/accounts/")) {
        res.statusCode = 403;
        res.end(JSON.stringify({ errors: [{ message: "Authentication error" }] }));
        return;
      }
      res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: "ok" } }] }));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  Object.assign(process.env, {
    CLOUDFLARE_API_BASE: base,
    CLOUDFLARE_ACCOUNT_ID: "acc-synthetic",
    AI_CLOUDFLARE_API_KEY: "cf-synthetic",
    AI_BASE_URL: `${base}/legacy/chat/completions`,
    AI_API_KEY: "legacy-synthetic",
    AI_MODELS: "legacy-model",
    AI_GROQ_API_KEY: "", AI_OPENROUTER_API_KEY: "", AI_MISTRAL_API_KEY: "",
    AI_PROVIDER_ORDER: "cloudflare,legacy",
  });
});
// Same worker runs other files: never leak the fake endpoints to them.
test.afterAll(() => {
  server.close();
  for (const k of touched) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

test("copilot completion reports who answered and every failure before it", async () => {
  const { chatCompletion } = await import("../src/lib/ai");
  const result = await chatCompletion([{ role: "user", content: "oi" }]);
  expect(result.provider).toBe("legacy");
  expect(result.failures.map((f) => f.provider)).toEqual(["cloudflare", "cloudflare"]);
  expect(result.failures[0].error).toContain("Authentication error");
  expect(seen[0].path).toBe("/accounts/acc-synthetic/ai/v1/chat/completions");
  expect(seen[0].auth).toBe("Bearer cf-synthetic");
});

test("diagnosis lists order, missing keys and per-model results without key values", async () => {
  const { diagnoseProviders } = await import("../src/lib/ai");
  const report = await diagnoseProviders();
  expect(report.order).toEqual(["cloudflare", "legacy"]);
  const cf = report.providers.find((p) => p.provider === "cloudflare")!;
  expect(cf.position).toBe(1);
  expect(cf.models.every((m) => !m.ok && m.error?.includes("Authentication error"))).toBe(true);
  const legacy = report.providers.find((p) => p.provider === "legacy")!;
  expect(legacy.models[0]).toMatchObject({ model: "legacy-model", ok: true, toolsOk: true });
  expect(report.providers.find((p) => p.provider === "groq")).toMatchObject({ configured: false, reason: "AI_GROQ_API_KEY ausente" });
  expect(JSON.stringify(report)).not.toMatch(/synthetic/);
});

test("tool calls reach strict OpenAI clients in the exact OpenAI shape", async () => {
  const { normalizeAssistantMessage } = await import("../src/lib/ai");
  const fixed = normalizeAssistantMessage({ role: "assistant", content: null, tool_calls: [{ function: { name: "buscar", arguments: { q: "oi" } } }] });
  expect(fixed.tool_calls![0]).toMatchObject({ type: "function", function: { name: "buscar", arguments: '{"q":"oi"}' } });
  expect(fixed.tool_calls![0].id).toMatch(/^call_/);
  expect(() => normalizeAssistantMessage({ content: null, tool_calls: [{ function: { name: "x", arguments: "{quebrado" } }] })).toThrow(/argumentos inválidos/);
  expect(() => normalizeAssistantMessage({ content: "", tool_calls: [] })).toThrow(/vazia/);
  expect(normalizeAssistantMessage({ role: "assistant", content: "olá" })).toEqual({ role: "assistant", content: "olá" });
});

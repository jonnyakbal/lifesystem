import { test, expect } from "@playwright/test";
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { ingestOffice, readOffice, registerPublisher, transaction, archiveSegmentFile } from "../src/lib/office/store";
import { commandTransaction, submitChat } from "../src/lib/office/chat-store";
import { archiveChats, archivePreview, readHistory, sha } from "../src/lib/office/chat-history";
import type { ChatJob } from "../src/lib/office/schema";

let dir: string;
let previous: string | undefined;
test.beforeEach(async () => {
  previous = process.env.LIFESYSTEM_DATA_DIR;
  dir = await mkdtemp(join(tmpdir(), "office-history-"));
  process.env.LIFESYSTEM_DATA_DIR = dir;
});
test.afterEach(async () => {
  if (previous === undefined) delete process.env.LIFESYSTEM_DATA_DIR;
  else process.env.LIFESYSTEM_DATA_DIR = previous;
  await rm(dir, { recursive: true, force: true });
});

const I = "personal";
const iso = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();
function job(partial: Partial<ChatJob> & { createdAt: string }): ChatJob {
  return { id: randomUUID(), clientId: randomUUID(), agentId: "sirius", text: "Pedido sintético", response: "Feito.", status: "completed", updatedAt: partial.createdAt, ...partial };
}
async function seed(jobs: ChatJob[]) {
  await transaction(I, (data) => { data.chats = [...(data.chats || []), ...jobs]; });
}
async function connect() {
  const s = await registerPublisher(I, `boot-${randomUUID().slice(0, 8)}`);
  await ingestOffice(I, [{ schemaVersion: 1, sessionId: s.id, sequence: 1, kind: "snapshot", emittedAt: new Date().toISOString(), payload: { monitored: ["sirius"], runs: [], catalogRevision: null, gap: false } }]);
  return s;
}

test("pages are stable by (createdAt, id), newest first, and new sends never shift them", async () => {
  const same = iso(60 * 24 * 40);
  await seed(Array.from({ length: 60 }, (_, i) => job({ createdAt: i < 10 ? same : iso(60 * 24 * 40 - i) })));
  const first = await readHistory(I, { agentId: "sirius", archived: false, limit: 50 });
  expect(first.jobs).toHaveLength(50);
  expect(first.activeCount).toBe(60);
  await seed([job({ createdAt: iso(0) })]);
  const second = await readHistory(I, { agentId: "sirius", archived: false, limit: 50, before: first.nextCursor! });
  expect(second.jobs).toHaveLength(10);
  expect(second.nextCursor).toBeNull();
  const ids = [...first.jobs, ...second.jobs].map((j) => j.id);
  expect(new Set(ids).size).toBe(60);
  expect(first.jobs.every((j) => !("claimSession" in j))).toBe(true);
});

test("cursors are bound to their agent and history kind", async () => {
  await seed(Array.from({ length: 3 }, (_, i) => job({ createdAt: iso(100 + i) })));
  const page = await readHistory(I, { agentId: "sirius", archived: false, limit: 1 });
  await expect(readHistory(I, { agentId: "vega", archived: false, before: page.nextCursor! })).rejects.toThrow("Cursor de outro histórico.");
  await expect(readHistory(I, { agentId: "sirius", archived: true, before: page.nextCursor! })).rejects.toThrow("Cursor de outro histórico.");
  await expect(readHistory(I, { agentId: "sirius", archived: false, before: "lixo" })).rejects.toThrow("Cursor inválido.");
});

test("archiving moves only finished jobs, needs the previewed revision and is idempotent per request", async () => {
  const old = iso(60 * 24 * 60);
  await seed([
    job({ createdAt: old }),
    job({ createdAt: old, status: "failed", response: null }),
    job({ createdAt: old, status: "interrupted", response: "incerto" }),
    job({ createdAt: old, status: "queued", response: null }),
    job({ createdAt: old, status: "running", response: null, claimSession: randomUUID() }),
    job({ createdAt: iso(5) }),
  ]);
  const before = iso(60 * 24 * 30);
  const preview = await archivePreview(I, { agentId: null, before });
  expect(preview).toEqual(expect.objectContaining({ eligible: 2, activeCount: 6, revision: 0 }));
  await expect(archiveChats(I, { requestId: randomUUID(), agentId: null, before, expectedRevision: 7 })).rejects.toThrow("O histórico mudou");

  const requestId = randomUUID();
  const receipt = await archiveChats(I, { requestId, agentId: null, before, expectedRevision: 0 });
  expect(receipt).toEqual(expect.objectContaining({ archivedCount: 2, revision: 1 }));
  expect(await archiveChats(I, { requestId, agentId: null, before, expectedRevision: 0 })).toEqual(receipt);
  await expect(archiveChats(I, { requestId, agentId: "sirius", before, expectedRevision: 1 })).rejects.toThrow("outros parâmetros");

  const data = await readOffice(I);
  expect(data.chats!.map((j) => j.status).sort()).toEqual(["completed", "interrupted", "queued", "running"]);
  expect(data.archive!.index).toHaveLength(2);
  const archived = await readHistory(I, { agentId: "sirius", archived: true });
  expect(archived.jobs.map((j) => j.status).sort()).toEqual(["completed", "failed"]);
  expect(archived.archivedCount).toBe(2);
});

test("a retry after a crash rewrites the same unreferenced segment", async () => {
  await seed([job({ createdAt: iso(60 * 24 * 60) })]);
  const requestId = randomUUID();
  const segment = sha(`${I}:${requestId}`).slice(0, 24);
  // Simulates a segment prepared before a failed main write: an orphan.
  writeFileSync(archiveSegmentFile(I, segment), JSON.stringify({ id: segment, jobs: [] }));
  expect((await readOffice(I)).archive).toBeUndefined();
  await archiveChats(I, { requestId, agentId: null, before: iso(60 * 24 * 30), expectedRevision: 0 });
  expect((await readHistory(I, { agentId: "sirius", archived: true })).jobs).toHaveLength(1);
  expect(readdirSync(dir).filter((f) => f.includes(".archive-"))).toHaveLength(1);
  expect(readdirSync(dir).filter((f) => f.endsWith(".tmp"))).toEqual([]);
});

test("an uncertain send retried after archiving returns the original job; other text conflicts", async () => {
  await connect();
  const clientId = randomUUID();
  const original = job({ clientId, createdAt: iso(60 * 24 * 60), text: "Planeje minha semana" });
  await seed([original]);
  await archiveChats(I, { requestId: randomUUID(), agentId: null, before: iso(60 * 24 * 30), expectedRevision: 0 });
  const replay = await submitChat(I, { clientId, agentId: "sirius", text: "Planeje minha semana" });
  expect(replay.id).toBe(original.id);
  expect((await readOffice(I)).chats).toEqual([]);
  await expect(submitChat(I, { clientId, agentId: "sirius", text: "Outro pedido" })).rejects.toThrow("Identificador já usado");
});

test("archiving frees the 1000 active slots but never the daily quota", async () => {
  await connect();
  await seed(Array.from({ length: 1000 }, (_, i) => job({ createdAt: iso(60 * 24 * 60 + i) })));
  await expect(submitChat(I, { clientId: randomUUID(), agentId: "sirius", text: "novo" })).rejects.toThrow("Histórico cheio");
  await archiveChats(I, { requestId: randomUUID(), agentId: null, before: iso(60 * 24 * 30), expectedRevision: 0 });
  await archiveChats(I, { requestId: randomUUID(), agentId: null, before: iso(60 * 24 * 30), expectedRevision: 1 });
  expect((await readOffice(I)).chats).toHaveLength(0);
  await submitChat(I, { clientId: randomUUID(), agentId: "sirius", text: "agora cabe" });

  await transaction(I, (data) => { data.chats = []; data.archive = undefined; });
  await seed(Array.from({ length: 100 }, () => job({ createdAt: iso(10) })));
  const recent = iso(0);
  await archiveChats(I, { requestId: randomUUID(), agentId: null, before: recent, expectedRevision: 0 });
  await expect(submitChat(I, { clientId: randomUUID(), agentId: "sirius", text: "mais um" })).rejects.toThrow("Limite de cem");
});

test("an identical late receipt for an archived job is accepted without reopening it", async () => {
  const s = await connect();
  const sent = await submitChat(I, { clientId: randomUUID(), agentId: "sirius", text: "Resumo" });
  await commandTransaction(I, { sessionId: s.id, op: "claim" });
  await commandTransaction(I, { sessionId: s.id, op: "result", id: sent.id, status: "completed", response: "Pronto." });
  await archiveChats(I, { requestId: randomUUID(), agentId: null, before: iso(-1), expectedRevision: 0 });

  const replay = await commandTransaction(I, { sessionId: s.id, op: "result", id: sent.id, status: "completed", response: "Pronto." });
  expect(replay.job).toEqual(expect.objectContaining({ id: sent.id, status: "completed" }));
  expect(replay.job).not.toHaveProperty("claimSession");
  await expect(commandTransaction(I, { sessionId: s.id, op: "result", id: sent.id, status: "completed", response: "Outro" })).rejects.toThrow("Atendimento já encerrado.");
  await expect(commandTransaction(I, { sessionId: s.id, op: "result", id: sent.id, status: "completed", response: "Pronto.", receiptSession: randomUUID() })).rejects.toThrow("Recibo de atendimento inválido.");
  expect((await commandTransaction(I, { sessionId: s.id, op: "claim" })).job).toBeNull();
  expect(existsSync(dir)).toBe(true);
});

test("history and maintenance refuse anonymous and publisher-only callers", async ({ playwright, baseURL }) => {
  const stranger = await playwright.request.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  expect((await stranger.get("/api/hermes/office/chat/history?agentId=sirius")).status()).toBe(401);
  const publisher = { authorization: "Bearer office-test-token-only-12345678901234567890" };
  expect((await stranger.get("/api/hermes/office/chat/history?agentId=sirius", { headers: publisher })).status()).toBe(401);
  expect((await stranger.post("/api/hermes/office/chat/history", { headers: publisher, data: { op: "archive" } })).status()).toBe(401);
  await stranger.dispose();
});

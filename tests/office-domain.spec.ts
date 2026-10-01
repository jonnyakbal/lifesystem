import { test, expect } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  registerPublisher,
  ingestOffice,
  readOffice,
} from "../src/lib/office/store";
import { projectOffice } from "../src/lib/office/view";
import catalog from "../src/lib/office/catalog.json";
import {
  submitChat,
  readChats,
  commandTransaction,
} from "../src/lib/office/chat-store";
import { randomUUID } from "node:crypto";

let dir: string;
test.beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "agent-office-"));
  process.env.LIFESYSTEM_DATA_DIR = dir;
});
test.afterEach(async () => {
  delete process.env.LIFESYSTEM_DATA_DIR;
  await rm(dir, { recursive: true, force: true });
});
const time = () => new Date().toISOString();
test("chat keeps agent identity and deduplicates browser retries without requeueing claims", async () => {
  const s = await registerPublisher("personal", "chat-boot");
  await ingestOffice("personal", [snap(s.id, 1)]);
  const clientId = randomUUID();
  const input = {
    clientId,
    agentId: "sirius",
    text: "Leia meus projetos e proponha prioridades.",
  };
  const jobs = await Promise.all(
    Array.from({ length: 4 }, () => submitChat("personal", input)),
  );
  expect(new Set(jobs.map((j) => j.id)).size).toBe(1);
  const claimed = await commandTransaction("personal", {
    sessionId: s.id,
    op: "claim",
  });
  expect(claimed.job?.agentId).toBe("sirius");
  expect(
    (await commandTransaction("personal", { sessionId: s.id, op: "claim" })).job
      ?.id,
  ).toBe(jobs[0].id);
  await commandTransaction("personal", {
    sessionId: s.id,
    op: "result",
    id: jobs[0].id,
    status: "completed",
    response: "Consultei três projetos.",
  });
  expect(
    (await commandTransaction("personal", { sessionId: s.id, op: "claim" }))
      .job,
  ).toBeNull();
  expect((await submitChat("personal", input)).status).toBe("completed");
  await expect(
    submitChat("personal", { ...input, text: "outro pedido" }),
  ).rejects.toThrow();
  expect((await readChats("personal", "vega")).length).toBe(0);
  expect((await readChats("personal", "sirius"))[0].response).toBe(
    "Consultei três projetos.",
  );
});
test("chat refuses stale workers and never reexecutes an uncertain claim after restart", async () => {
  const s = await registerPublisher("personal", "chat-old");
  await ingestOffice("personal", [snap(s.id, 1)]);
  const job = await submitChat("personal", {
    clientId: randomUUID(),
    agentId: "cosmo",
    text: "Prepare uma pauta.",
  });
  await commandTransaction("personal", { sessionId: s.id, op: "claim" });
  const fresh = await registerPublisher("personal", "chat-new");
  await expect(
    commandTransaction("personal", {
      sessionId: s.id,
      op: "result",
      id: job.id,
      status: "completed",
      response: "inventado",
    }),
  ).rejects.toThrow();
  expect(
    (await commandTransaction("personal", { sessionId: fresh.id, op: "claim" }))
      .job,
  ).toBeNull();
  expect((await readChats("personal", "cosmo"))[0].status).toBe("interrupted");
});
test("chat recovers a persisted terminal receipt after worker restart without requeueing", async () => {
  const old = await registerPublisher("personal", "receipt-old");
  await ingestOffice("personal", [snap(old.id, 1)]);
  const job = await submitChat("personal", { clientId: randomUUID(), agentId: "sirius", text: "Leia projetos." });
  await commandTransaction("personal", { sessionId: old.id, op: "claim" });
  const next = await registerPublisher("personal", "receipt-new");
  await commandTransaction("personal", { sessionId: next.id, receiptSession: old.id, op: "result", id: job.id, status: "completed", response: "Resposta persistida antes do reinício." });
  expect((await readChats("personal", "sirius"))[0].status).toBe("completed");
  expect((await commandTransaction("personal", { sessionId: next.id, op: "claim" })).job).toBeNull();
});
const snap = (sessionId: string, sequence: number, runs: unknown[] = []) => ({
  schemaVersion: 1,
  sessionId,
  sequence,
  kind: "snapshot",
  emittedAt: time(),
  payload: {
    monitored: ["vega", "sirius", "orion", "astro", "cosmo"],
    runs,
    catalogRevision: null,
    gap: false,
  },
});
const run = {
  runId: "opaque-run-1",
  agentId: "sirius",
  channel: "whatsapp",
  status: "running",
  acceptedAt: "2026-09-30T12:00:00.000Z",
  startedAt: "2026-09-30T12:00:01.000Z",
};

test("deduplicates and ignores old snapshots while preserving exact run state", async () => {
  const s = await registerPublisher("personal", "boot-one");
  await ingestOffice("personal", [snap(s.id, 2, [run])]);
  await ingestOffice("personal", [snap(s.id, 1), snap(s.id, 2, [run])]);
  const data = await readOffice("personal");
  expect(data.snapshot?.payload.runs).toHaveLength(1);
  const view = projectOffice(data);
  expect(view.agents.find((a) => a.id === "sirius")?.state).toBe("working");
  expect(view.agents.find((a) => a.id === "hermes")?.state).toBe("unmonitored");
  expect(
    projectOffice(data, Date.now() + 100000).agents.find(
      (a) => a.id === "sirius",
    )?.state,
  ).toBe("stale");
});
test("registration is idempotent and retired boots cannot restore live state", async () => {
  const one = await registerPublisher("personal", "boot-one");
  expect((await registerPublisher("personal", "boot-one")).id).toBe(one.id);
  await ingestOffice("personal", [snap(one.id, 1, [run])]);
  const two = await registerPublisher("personal", "boot-two");
  await expect(registerPublisher("personal", "boot-one")).rejects.toThrow(
    "aposentada",
  );
  await ingestOffice("personal", [snap(one.id, 100, [run])]);
  expect((await readOffice("personal")).snapshot).toBeNull();
  await ingestOffice("personal", [snap(two.id, 1)]);
  expect(
    projectOffice(await readOffice("personal")).agents.find(
      (a) => a.id === "sirius",
    )?.state,
  ).toBe("idle");
});
test("concurrent publishers persist one session per boot without lost history", async () => {
  const sessions = await Promise.all(
    Array.from({ length: 6 }, () => registerPublisher("personal", "same-boot")),
  );
  expect(new Set(sessions.map((s) => s.id)).size).toBe(1);
  await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      ingestOffice("personal", [
        {
          schemaVersion: 1,
          sessionId: sessions[0].id,
          sequence: i + 1,
          kind: "run.finished",
          emittedAt: time(),
          payload: {
            ...run,
            runId: `run-${i}`,
            status: "completed",
            finishedAt: time(),
          },
        },
      ]),
    ),
  );
  expect((await readOffice("personal")).events).toHaveLength(12);
});
test("rejects extra private data, invalid profile, installation crossing and impossible parallel execution", async () => {
  const s = await registerPublisher("personal", "boot");
  await expect(ingestOffice("other", [snap(s.id, 1)])).rejects.toThrow();
  await expect(
    ingestOffice("personal", [{ ...snap(s.id, 1), prompt: "private" }]),
  ).rejects.toThrow();
  await expect(
    ingestOffice("personal", [
      snap(s.id, 2, [{ ...run, agentId: "outsider" }]),
    ]),
  ).rejects.toThrow();
  await expect(
    ingestOffice("personal", [
      snap(s.id, 3, [run, { ...run, runId: "second", agentId: "vega" }]),
    ]),
  ).rejects.toThrow();
});
test("catalog revision must match the active snapshot and old catalog cannot overwrite it", async () => {
  const s = await registerPublisher("personal", "catalog-boot");
  await ingestOffice("personal", [
    {
      schemaVersion: 1,
      sessionId: s.id,
      sequence: 2,
      kind: "catalog.updated",
      emittedAt: time(),
      payload: catalog,
    },
    {
      ...snap(s.id, 3),
      payload: { ...snap(s.id, 3).payload, catalogRevision: catalog.revision },
    },
  ]);
  expect(projectOffice(await readOffice("personal")).catalogCurrent).toBe(true);
  await ingestOffice("personal", [
    {
      schemaVersion: 1,
      sessionId: s.id,
      sequence: 1,
      kind: "catalog.updated",
      emittedAt: time(),
      payload: { ...catalog, revision: "old" },
    },
  ]);
  expect((await readOffice("personal")).catalog?.payload.revision).toBe(
    catalog.revision,
  );
  await registerPublisher("personal", "new-boot");
  expect(projectOffice(await readOffice("personal")).catalogCurrent).toBe(
    false,
  );
});
test("duplicate terminal receipts across boots do not duplicate history", async () => {
  const one = await registerPublisher("personal", "one");
  const emittedAt = time();
  const receipt = {
    schemaVersion: 1,
    sessionId: one.id,
    sequence: 1,
    kind: "run.finished",
    emittedAt,
    payload: { ...run, status: "undelivered", finishedAt: emittedAt },
  };
  await ingestOffice("personal", [receipt]);
  const two = await registerPublisher("personal", "two");
  await ingestOffice("personal", [{ ...receipt, sessionId: two.id }]);
  expect((await readOffice("personal")).events).toHaveLength(1);
});
test("retention bounds receipt history to 1000 and rejects expired historical replay", async () => {
  const s = await registerPublisher("personal", "retention");
  for (let batch = 0; batch < 21; batch++)
    await ingestOffice(
      "personal",
      Array.from({ length: 50 }, (_, i) => ({
        schemaVersion: 1,
        sessionId: s.id,
        sequence: batch * 50 + i + 1,
        kind: "run.finished",
        emittedAt: time(),
        payload: {
          ...run,
          runId: `run-${batch}-${i}`,
          status: "completed",
          finishedAt: time(),
        },
      })),
    );
  expect((await readOffice("personal")).events).toHaveLength(1000);
  await ingestOffice("personal", [
    {
      schemaVersion: 1,
      sessionId: s.id,
      sequence: 1051,
      kind: "run.finished",
      emittedAt: "2020-01-01T00:00:00.000Z",
      payload: {
        ...run,
        status: "completed",
        finishedAt: "2020-01-01T00:00:00.000Z",
      },
    },
  ]);
  expect(
    (await readOffice("personal")).events.every(
      (e) => e.emittedAt.startsWith("2020") === false,
    ),
  ).toBe(true);
});
test("long network outage does not discard a recent terminal receipt behind snapshot sequence", async () => {
  const s = await registerPublisher("personal", "long-outage");
  await ingestOffice("personal", [
    snap(s.id, 3000),
    {
      schemaVersion: 1,
      sessionId: s.id,
      sequence: 1,
      kind: "run.finished",
      emittedAt: time(),
      payload: { ...run, status: "completed", finishedAt: time() },
    },
  ]);
  expect((await readOffice("personal")).events).toHaveLength(1);
});

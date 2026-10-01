import { mkdir, readFile, writeFile, rename, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import lockfile from "proper-lockfile";
import { z } from "zod";
import {
  emptyOffice,
  eventSchema,
  type OfficeData,
  type ReceivedEvent,
} from "./schema";
const WEEK = 7 * 86400000;
function file(installation: string) {
  return join(
    resolve(process.env.LIFESYSTEM_DATA_DIR || "data"),
    "office-" +
      createHash("sha256").update(installation).digest("hex").slice(0, 24) +
      ".json",
  );
}
async function load(path: string): Promise<OfficeData> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return emptyOffice();
    throw e;
  }
}
async function transaction<T>(
  installation: string,
  change: (data: OfficeData) => T,
): Promise<T> {
  const path = file(installation);
  await mkdir(resolve(path, ".."), { recursive: true });
  let compromised = false;
  const release = await lockfile.lock(path, {
    realpath: false,
    stale: 30000,
    update: 10000,
    retries: { retries: 40, minTimeout: 25, maxTimeout: 250 },
    onCompromised: () => {
      compromised = true;
    },
  });
  const temp = path + "." + randomUUID() + ".tmp";
  try {
    const data = await load(path);
    const result = change(data);
    if (compromised) throw new Error("Trava perdida");
    await writeFile(temp, JSON.stringify(data), { mode: 0o600 });
    if (compromised) throw new Error("Trava perdida");
    await rename(temp, path);
    return result;
  } finally {
    await rm(temp, { force: true }).catch(() => {});
    await release().catch(() => {});
  }
}
export async function registerPublisher(installation: string, bootId: string) {
  z.string()
    .min(1)
    .max(120)
    .regex(/^[a-zA-Z0-9_-]+$/)
    .parse(bootId);
  return transaction(installation, (data) => {
    if (data.session?.bootId === bootId) return data.session;
    if (data.retired.includes(bootId)) throw new Error("Sessão aposentada");
    if (data.retired.length >= 2000)
      throw new Error("Limite de sessões; requer manutenção");
    if (data.session) data.retired.push(data.session.bootId);
    data.session = { id: randomUUID(), bootId };
    data.snapshot = null;
    data.seen = [];
    data.highest = 0;
    data.catalogSequence = 0;
    return data.session;
  });
}
export async function ingestOffice(installation: string, raw: unknown) {
  const events = z.array(eventSchema).min(1).max(50).parse(raw);
  return transaction(installation, (data) => {
    if (!data.session) throw new Error("Sessão não registrada");
    const now = Date.now();
    let accepted = 0;
    for (const event of events) {
      // Old sessions cannot refresh presence or overwrite catalog. The publisher drops old snapshots.
      if (event.sessionId !== data.session.id) continue;
      // Snapshot coalescing can consume thousands of sequence numbers during an outage.
      // Historical receipts are bounded by age/identity, never by distance from a snapshot.
      if (data.seen.includes(event.sequence)) continue;
      const received = {
        ...event,
        receivedAt: new Date(now).toISOString(),
      } as ReceivedEvent;
      data.highest = Math.max(data.highest, event.sequence);
      data.seen.push(event.sequence);
      accepted++;
      if (received.kind === "snapshot") {
        if (!data.snapshot || received.sequence > data.snapshot.sequence)
          data.snapshot = received;
      } else if (received.kind === "catalog.updated") {
        if (received.sequence > data.catalogSequence) {
          data.catalog = received;
          data.catalogSequence = received.sequence;
        }
      } else if (
        !data.events.some(
          (prior) =>
            prior.kind === received.kind &&
            prior.emittedAt === received.emittedAt &&
            "runId" in prior.payload &&
            prior.payload.runId === received.payload.runId,
        )
      )
        data.events.push(received);
    }
    data.seen = data.seen.filter((n) => n > data.highest - 2000);
    data.events = data.events
      .filter(
        (e) =>
          Date.parse(e.receivedAt) > now - WEEK &&
          Date.parse(e.emittedAt) > now - WEEK,
      )
      .sort(
        (a, b) =>
          a.receivedAt.localeCompare(b.receivedAt) || a.sequence - b.sequence,
      )
      .slice(-1000);
    return { accepted };
  });
}
export async function readOffice(installation: string): Promise<OfficeData> {
  return load(file(installation));
}

import { createHash } from "node:crypto";
import { readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { z } from "zod";
import {
  agentIds,
  type AgentId,
  type ArchivedJobIndex,
  type ChatJob,
  type OfficeArchive,
  type OfficeData,
} from "./schema";
import { archiveSegmentFile, readOffice, transaction } from "./store";

// Office chat history (E3). Archiving moves finished jobs to an immutable
// segment file and keeps a small index entry per job, so idempotent retries,
// the 24h quota and identical late receipts keep working after maintenance.
// Queued, claimed, running and interrupted jobs are never archived.

const ARCHIVABLE = new Set<ChatJob["status"]>(["completed", "failed"]);
const MAX_PER_OPERATION = 500;

export const sha = (value: string) => createHash("sha256").update(value).digest("hex");
export const jobFingerprint = (agentId: string, text: string) => sha(`${agentId}\n${text}`);
export const responseFingerprint = (response: string | null) => (response === null ? null : sha(response));

export function archiveOf(data: OfficeData): OfficeArchive {
  return (data.archive ||= { revision: 0, segments: [], index: [], receipts: [] });
}

function publicJob(job: ChatJob) {
  const { claimSession: _claim, ...view } = job;
  void _claim;
  return view;
}

type Segment = { id: string; jobs: ChatJob[] };
function readSegment(installation: string, id: string): Segment {
  return JSON.parse(readFileSync(archiveSegmentFile(installation, id), "utf8")) as Segment;
}

/** The archived job, without its worker receipt reference. */
export function archivedJob(installation: string, entry: ArchivedJobIndex) {
  const job = readSegment(installation, entry.segment).jobs.find((j) => j.id === entry.id);
  if (!job) throw new Error("Atendimento arquivado não encontrado.");
  return publicJob(job);
}

const scope = z.object({
  agentId: z.enum(agentIds).nullable(),
  before: z.string().datetime(),
});
function eligible(data: OfficeData, agentId: AgentId | null, before: string) {
  return (data.chats || [])
    .filter((j) => ARCHIVABLE.has(j.status) && j.createdAt < before && (!agentId || j.agentId === agentId))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    .slice(0, MAX_PER_OPERATION);
}

export async function archivePreview(installation: string, raw: unknown) {
  const { agentId, before } = scope.parse(raw);
  const data = await readOffice(installation);
  const archive = data.archive;
  return {
    eligible: eligible(data, agentId, before).length,
    activeCount: (data.chats || []).length,
    archivedCount: archive?.index.length || 0,
    revision: archive?.revision || 0,
  };
}

const archiveInput = scope.extend({
  requestId: z.string().uuid(),
  expectedRevision: z.number().int().nonnegative(),
}).strict();

export async function archiveChats(installation: string, raw: unknown) {
  const input = archiveInput.parse(raw);
  return transaction(installation, (data) => {
    const archive = archiveOf(data);
    const prior = archive.receipts.find((r) => r.requestId === input.requestId);
    if (prior) {
      if (prior.agentId !== input.agentId || prior.before !== input.before)
        throw new Error("Identificador de manutenção já usado com outros parâmetros.");
      return prior;
    }
    if (archive.revision !== input.expectedRevision)
      throw new Error("O histórico mudou desde a prévia. Revise antes de arquivar.");
    const selected = eligible(data, input.agentId, input.before);
    if (!selected.length) throw new Error("Nenhuma conversa concluída para arquivar nesse período.");
    // Deterministic per request: a retry after a failed main write rewrites
    // the same unreferenced segment instead of leaving a second copy.
    const segment = sha(`${installation}:${input.requestId}`).slice(0, 24);
    const path = archiveSegmentFile(installation, segment);
    const temporary = `${path}.${process.pid}.tmp`;
    try {
      writeFileSync(temporary, JSON.stringify({ id: segment, jobs: selected } satisfies Segment), { mode: 0o600 });
      renameSync(temporary, path);
    } finally {
      rmSync(temporary, { force: true });
    }
    const ids = new Set(selected.map((j) => j.id));
    data.chats = (data.chats || []).filter((j) => !ids.has(j.id));
    for (const job of selected)
      archive.index.push({
        id: job.id,
        clientId: job.clientId,
        agentId: job.agentId,
        fingerprint: jobFingerprint(job.agentId, job.text),
        responseFingerprint: responseFingerprint(job.response),
        status: job.status as ArchivedJobIndex["status"],
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        segment,
        ...(job.claimSession ? { claimSession: job.claimSession } : {}),
      });
    archive.segments.push({ id: segment, count: selected.length, createdAt: new Date().toISOString() });
    archive.revision++;
    const receipt = {
      requestId: input.requestId,
      receiptId: sha(`receipt:${segment}`).slice(0, 24),
      agentId: input.agentId,
      before: input.before,
      archivedCount: selected.length,
      revision: archive.revision,
      at: new Date().toISOString(),
    };
    archive.receipts = [...archive.receipts, receipt].slice(-200);
    return receipt;
  });
}

const cursorSchema = z.object({ t: z.string(), id: z.string(), a: z.enum(agentIds), ar: z.boolean() }).strict();
function encodeCursor(job: { createdAt: string; id: string }, agentId: AgentId, archived: boolean) {
  return Buffer.from(JSON.stringify({ t: job.createdAt, id: job.id, a: agentId, ar: archived })).toString("base64url");
}
function decodeCursor(cursor: string, agentId: AgentId, archived: boolean) {
  let value: z.infer<typeof cursorSchema>;
  try {
    value = cursorSchema.parse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")));
  } catch {
    throw new Error("Cursor inválido.");
  }
  if (value.a !== agentId || value.ar !== archived) throw new Error("Cursor de outro histórico.");
  return value;
}
const newestFirst = (a: { createdAt: string; id: string }, b: { createdAt: string; id: string }) =>
  b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);
const olderThan = (job: { createdAt: string; id: string }, c: { t: string; id: string }) =>
  job.createdAt < c.t || (job.createdAt === c.t && job.id < c.id);

const historyInput = z.object({
  agentId: z.enum(agentIds),
  archived: z.boolean(),
  before: z.string().max(400).optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

/** Stable (createdAt, id) pages, newest first; no offsets that skip after new sends. */
export async function readHistory(installation: string, raw: unknown) {
  const input = historyInput.parse(raw);
  const cursor = input.before ? decodeCursor(input.before, input.agentId, input.archived) : null;
  const data = await readOffice(installation);
  const archive = data.archive;
  const activeCount = (data.chats || []).filter((j) => j.agentId === input.agentId).length;
  const archivedCount = (archive?.index || []).filter((j) => j.agentId === input.agentId).length;
  const source = input.archived
    ? (archive?.index || []).filter((j) => j.agentId === input.agentId)
    : (data.chats || []).filter((j) => j.agentId === input.agentId);
  const ordered = [...source].sort(newestFirst).filter((j) => !cursor || olderThan(j, cursor));
  const page = ordered.slice(0, input.limit);
  const jobs = input.archived
    ? (() => {
        const segments = new Map<string, Segment>();
        return (page as ArchivedJobIndex[]).map((entry) => {
          if (!segments.has(entry.segment)) segments.set(entry.segment, readSegment(installation, entry.segment));
          const job = segments.get(entry.segment)!.jobs.find((j) => j.id === entry.id);
          if (!job) throw new Error("Segmento de arquivo incompleto.");
          return publicJob(job);
        });
      })()
    : (page as ChatJob[]).map(publicJob);
  const last = page[page.length - 1];
  return {
    jobs,
    nextCursor: ordered.length > page.length && last ? encodeCursor(last, input.agentId, input.archived) : null,
    activeCount,
    archivedCount,
  };
}

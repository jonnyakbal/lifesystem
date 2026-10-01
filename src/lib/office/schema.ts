import { z } from "zod";
export const agentIds = [
  "hermes",
  "vega",
  "sirius",
  "orion",
  "astro",
  "cosmo",
] as const;
export type AgentId = (typeof agentIds)[number];
const id = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-zA-Z0-9:_-]+$/);
const brief = z.string().min(1).max(600);
const date = z.string().datetime();
export const sourceSchema = z
  .object({
    id,
    title: brief,
    kind: z.enum(["instruction", "skill", "briefing", "connector", "memory"]),
    reference: brief,
    summary: brief,
    revision: z.string().max(100).nullable(),
    verifiedAt: date.nullable(),
  })
  .strict();
export const actionSchema = z
  .object({
    title: brief,
    description: brief,
    dependency: brief,
    availability: z.enum(["verified", "configured", "pending", "unavailable"]),
    checkedAt: date.nullable(),
    approval: z.enum(["read", "explicit", "forbidden"]),
    enforcement: z.enum(["instructions", "server", "none"]),
    example: brief,
  })
  .strict();
export const profileSchema = z
  .object({
    id: z.enum(agentIds),
    name: brief,
    role: brief,
    summary: brief,
    principles: z
      .array(z.object({ text: brief, sourceId: id }).strict())
      .max(12),
    sources: z.array(sourceSchema).max(15),
    actions: z.array(actionSchema).max(12),
  })
  .strict();
export const catalogSchema = z
  .object({
    revision: id,
    provenance: z.enum(["local", "deployed"]),
    profiles: z.array(profileSchema).length(6),
  })
  .strict()
  .superRefine((c, ctx) => {
    if (new Set(c.profiles.map((p) => p.id)).size !== 6)
      ctx.addIssue({ code: "custom", message: "Perfis duplicados" });
    for (const p of c.profiles)
      for (const rule of p.principles)
        if (!p.sources.some((s) => s.id === rule.sourceId))
          ctx.addIssue({ code: "custom", message: "Princípio sem fonte" });
  });
export type Profile = z.infer<typeof profileSchema>;
export type Catalog = z.infer<typeof catalogSchema>;
export const runSchema = z
  .object({
    runId: id,
    agentId: z.enum(agentIds),
    channel: z.enum(["whatsapp", "telegram", "office"]),
    status: z.enum([
      "accepted",
      "running",
      "completed",
      "failed",
      "interrupted",
      "undelivered",
      "rejected",
    ]),
    acceptedAt: date,
    startedAt: date.optional(),
    finishedAt: date.optional(),
  })
  .strict();
export type OfficeRun = z.infer<typeof runSchema>;
const snapshotSchema = z
  .object({
    monitored: z.array(z.enum(agentIds)).max(6),
    runs: z.array(runSchema).max(4),
    catalogRevision: id.nullable(),
    gap: z.boolean(),
  })
  .strict()
  .superRefine((s, ctx) => {
    if (s.runs.filter((r) => r.status === "running").length > 1)
      ctx.addIssue({ code: "custom", message: "Execução serial esperada" });
    if (new Set(s.runs.map((r) => r.runId)).size !== s.runs.length)
      ctx.addIssue({ code: "custom", message: "Execução duplicada" });
    if (s.runs.some((r) => !["accepted", "running"].includes(r.status)))
      ctx.addIssue({
        code: "custom",
        message: "Snapshot deve conter somente fila e execução",
      });
  });
const base = {
  schemaVersion: z.literal(1),
  sessionId: id,
  sequence: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  emittedAt: date,
};
export const eventSchema = z
  .discriminatedUnion("kind", [
    z
      .object({ ...base, kind: z.literal("snapshot"), payload: snapshotSchema })
      .strict(),
    z
      .object({
        ...base,
        kind: z.literal("catalog.updated"),
        payload: catalogSchema,
      })
      .strict(),
    z
      .object({
        ...base,
        kind: z.enum(["run.accepted", "run.started", "run.finished"]),
        payload: runSchema,
      })
      .strict(),
  ])
  .superRefine((e, ctx) => {
    if (
      (e.kind === "run.accepted" && e.payload.status !== "accepted") ||
      (e.kind === "run.started" && e.payload.status !== "running") ||
      (e.kind === "run.finished" &&
        ["accepted", "running"].includes(e.payload.status))
    )
      ctx.addIssue({ code: "custom", message: "Transição incompatível" });
  });
export type OfficeEvent = z.infer<typeof eventSchema>;
export type ReceivedEvent = OfficeEvent & { receivedAt: string };
export type Snapshot = Extract<ReceivedEvent, { kind: "snapshot" }>;
export type StoredCatalog = Extract<ReceivedEvent, { kind: "catalog.updated" }>;
export interface OfficeData {
  chats?: ChatJob[];
  session: { id: string; bootId: string } | null;
  retired: string[];
  snapshot: Snapshot | null;
  catalog: StoredCatalog | null;
  events: ReceivedEvent[];
  seen: number[];
  highest: number;
  catalogSequence: number;
}
export interface ChatJob {
  id: string;
  clientId: string;
  agentId: AgentId;
  text: string;
  response: string | null;
  status:
    "queued" | "claimed" | "running" | "completed" | "failed" | "interrupted";
  createdAt: string;
  updatedAt: string;
  claimSession?: string;
}
export const emptyOffice = (): OfficeData => ({
  session: null,
  retired: [],
  snapshot: null,
  catalog: null,
  events: [],
  seen: [],
  highest: 0,
  catalogSequence: 0,
});

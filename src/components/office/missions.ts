"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentId, ChatJob } from "@/lib/office/schema";
import type { HealthProposal } from "@/lib/health/schemas";
import type { Proposal } from "@/lib/professional/schemas";

// The station's "game layer" reads only real records: office chat jobs are
// missions, Órion/Sirius proposals are decisions waiting for the owner.
// Each source fails independently and an unread source is never shown as zero.

export type Decision = {
  key: string;
  source: "health" | "professional";
  agentId: AgentId;
  id: string;
  revision: number;
  hash: string;
  title: string;
  kind: string;
  data: unknown;
  expiresAt: string;
  approved: boolean;
  // Approval is refused by the server for these; the UI says why up front.
  blocked?: string;
};

export type MissionBoard = {
  jobs: ChatJob[];
  decisions: Decision[];
  errors: Partial<Record<"chat" | "health" | "professional", string>>;
  loadedAt: number | null;
};

const healthLabels: Record<string, string> = {
  record: "Novo relato de saúde",
  correct: "Correção de relato",
  context: "Novo contexto de saúde",
  task_create: "Nova tarefa de saúde",
  task_plan: "Bloco de horário de saúde",
};

export const ACTIVE = new Set<ChatJob["status"]>(["queued", "claimed", "running"]);

async function json<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Erro ${response.status}`);
  return body as T;
}

function healthDecision(p: HealthProposal): Decision {
  return {
    key: `health:${p.id}`,
    source: "health",
    agentId: "orion",
    id: p.id,
    revision: p.revision,
    hash: p.hash,
    title: healthLabels[p.input.operation] || "Proposta de saúde",
    kind: p.input.operation,
    data: p.input,
    expiresAt: p.expiresAt,
    approved: Boolean(p.approvedAt),
  };
}

function professionalDecision(p: Proposal & { approval?: unknown }): Decision {
  return {
    key: `professional:${p.id}`,
    source: "professional",
    agentId: "sirius",
    id: p.id,
    revision: p.revision,
    hash: p.hash,
    title: String(p.data.title || p.data.name || "Proposta profissional"),
    kind: p.approvalType,
    data: p.data,
    expiresAt: p.expiresAt,
    approved: Boolean(p.approval),
    blocked:
      p.approvalType === "external_action"
        ? "Ação externa não tem executor; abra em Profissional para decidir."
        : undefined,
  };
}

export function useMissionBoard(enabled: boolean) {
  const [board, setBoard] = useState<MissionBoard>({ jobs: [], decisions: [], errors: {}, loadedAt: null });
  const busy = useRef(false);
  const load = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const [chat, health, professional] = await Promise.allSettled([
      json<{ jobs: ChatJob[] }>("/api/hermes/office/chat?agentId=all"),
      json<{ items: HealthProposal[] }>("/api/health?view=proposals"),
      json<{ items: (Proposal & { approval?: unknown })[] }>("/api/professional?view=proposal"),
    ]);
    busy.current = false;
    const now = Date.now();
    setBoard((prior) => {
      const errors: MissionBoard["errors"] = {};
      const decisions: Decision[] = [];
      if (health.status === "fulfilled") decisions.push(...health.value.items.map(healthDecision));
      else {
        errors.health = "Propostas do Órion indisponíveis agora.";
        decisions.push(...prior.decisions.filter((d) => d.source === "health"));
      }
      if (professional.status === "fulfilled")
        decisions.push(
          ...professional.value.items
            .filter((p) => !p.resultId && Date.parse(p.expiresAt) > now)
            .map(professionalDecision),
        );
      else {
        errors.professional = "Propostas do Sirius indisponíveis agora.";
        decisions.push(...prior.decisions.filter((d) => d.source === "professional"));
      }
      if (chat.status === "rejected") errors.chat = "Missões indisponíveis agora.";
      return {
        jobs: chat.status === "fulfilled" ? chat.value.jobs : prior.jobs,
        decisions,
        errors,
        loadedAt: now,
      };
    });
  }, []);
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      clearInterval(timer);
      if (document.hidden) return;
      void load();
      timer = setInterval(() => {
        if (!document.hidden) void load();
      }, 6000);
    };
    start();
    document.addEventListener("visibilitychange", start);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", start);
    };
  }, [enabled, load]);
  return { board, refresh: load };
}

/** Same calls and order as the Corpo and Profissional pages; nothing is auto-approved. */
export async function approveDecision(decision: Decision) {
  const body = JSON.stringify({ proposalId: decision.id, revision: decision.revision, hash: decision.hash });
  const post = async (url: string, payload: string) => {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Aprovação recusada.");
    return result;
  };
  if (decision.source === "health") return post("/api/health/approval", body);
  await post("/api/professional/approval", body);
  return post("/api/professional", JSON.stringify({ action: "apply", id: decision.id, idempotencyKey: `owner-apply-${decision.id}` }));
}

export type AgentActivity = { active: number; working: boolean; decisions: number };

export function activityByAgent(board: MissionBoard): Partial<Record<AgentId, AgentActivity>> {
  const result: Partial<Record<AgentId, AgentActivity>> = {};
  const entry = (id: AgentId) => (result[id] ||= { active: 0, working: false, decisions: 0 });
  for (const job of board.jobs) {
    if (!ACTIVE.has(job.status)) continue;
    const item = entry(job.agentId);
    item.active++;
    if (job.status !== "queued") item.working = true;
  }
  for (const decision of board.decisions) if (!decision.approved) entry(decision.agentId).decisions++;
  return result;
}

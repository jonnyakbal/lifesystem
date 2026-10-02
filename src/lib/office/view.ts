import {
  agentIds,
  type AgentId,
  type OfficeData,
  type OfficeRun,
} from "./schema";
export const stateLabels = {
  unknown: "Sem dados",
  unmonitored: "Atividade não monitorada",
  stale: "Estado desatualizado",
  idle: "Disponível",
  queued: "Na fila",
  working: "Trabalhando",
};
export type OfficeState = keyof typeof stateLabels;
export interface AgentPresence {
  id: AgentId;
  state: OfficeState;
  run: OfficeRun | null;
  queued: number;
}
export type CatalogState = "local" | "received" | "awaiting" | "stale";
export const catalogStateLabels: Record<CatalogState, string> = {
  local: "Referência local · nenhum catálogo recebido da instalação.",
  received: "Catálogo recebido da instalação conectada.",
  awaiting: "Catálogo recebido · aguardando confirmação de revisão.",
  stale: "Catálogo recebido · estado sem sinal recente.",
};
export function projectOffice(data: OfficeData, now = Date.now()) {
  const snap = data.snapshot;
  const fresh = !!snap && now - Date.parse(snap.receivedAt) <= 90000;
  const agents: AgentPresence[] = agentIds.map((id) => {
    const runs = snap?.payload.runs.filter((r) => r.agentId === id) || [];
    const running = runs.find((r) => r.status === "running");
    const state: OfficeState = !snap
      ? "unknown"
      : !fresh
        ? "stale"
        : !snap.payload.monitored.includes(id)
          ? "unmonitored"
          : running
            ? "working"
            : runs.length
              ? "queued"
              : "idle";
    return {
      id,
      state,
      run: running || runs[0] || null,
      queued: runs.filter((r) => r.status === "accepted").length,
    };
  });
  const catalogCurrent =
    !!snap &&
    data.catalog?.payload.revision === snap.payload.catalogRevision &&
    data.catalog.sessionId === snap.sessionId;
  // Provenance of what the sheets show. Each state is derived only from
  // received data; nothing here fabricates a verification time.
  const catalogState: CatalogState = !data.catalog
    ? "local"
    : !fresh
      ? "stale"
      : catalogCurrent && data.catalog.payload.provenance === "deployed"
        ? "received"
        : "awaiting";
  return {
    asOf: now,
    catalogState,
    catalogRevision: data.catalog?.payload.revision || null,
    catalogReceivedAt: data.catalog?.receivedAt || null,
    agents,
    fresh,
    lastSeenAt: snap?.receivedAt || null,
    gap: snap?.payload.gap || false,
    catalog: data.catalog?.payload || null,
    catalogCurrent,
    history: data.events
      .filter((e) => Date.parse(e.receivedAt) > now - 7 * 86400000)
      .slice(-30)
      .reverse()
      .map((e) => ({
        kind: e.kind,
        receivedAt: e.receivedAt,
        payload: e.payload,
      })),
  };
}
export type OfficeView = ReturnType<typeof projectOffice>;

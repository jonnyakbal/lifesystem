"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentId, ChatJob } from "@/lib/office/schema";
import { ACTIVE, approveDecision, type Decision, type MissionBoard } from "./missions";
import s from "./stellar.module.css";

const jobLabels: Record<ChatJob["status"], string> = {
  queued: "Na fila",
  claimed: "Recebida",
  running: "Em andamento",
  completed: "Concluída",
  failed: "Não concluída",
  interrupted: "Interrompida",
};

function since(iso: string, now: number) {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `há ${hours} h` : `há ${Math.round(hours / 24)} d`;
}

type Preview = { eligible: number; activeCount: number; archivedCount: number; revision: number };
const DAY = 86_400_000;

async function fetchPreview(): Promise<{ before: string; data: Preview } | Error> {
  const before = new Date(Date.now() - 30 * DAY).toISOString();
  try {
    const r = await fetch(`/api/hermes/office/chat/history?preview=1&before=${encodeURIComponent(before)}`, { cache: "no-store" });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return new Error(data.error || "Prévia indisponível.");
    return { before, data: data as Preview };
  } catch {
    return new Error("Prévia indisponível.");
  }
}

/** Explicit, previewed archiving of finished conversations older than 30 days. */
function HistoryMaintenance({ onDone }: { onDone: (text: string) => void }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [cutoff, setCutoff] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // One identity per previewed intent, so a retried click cannot archive twice.
  const requestId = useRef<string>("");
  const apply = useCallback((result: { before: string; data: Preview } | Error) => {
    if (result instanceof Error) return setError(result.message);
    requestId.current = crypto.randomUUID();
    setCutoff(result.before);
    setPreview(result.data);
    setError("");
  }, []);
  useEffect(() => {
    let stop = false;
    fetchPreview().then((result) => !stop && apply(result));
    return () => {
      stop = true;
    };
  }, [apply]);
  async function archive() {
    if (!preview) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/hermes/office/chat/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "archive", requestId: requestId.current, agentId: null, before: cutoff, expectedRevision: preview.revision }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "Arquivamento recusado.");
      setConfirming(false);
      onDone(`${data.receipt.archivedCount} conversa(s) arquivada(s). Elas continuam disponíveis em "Ver arquivadas".`);
      apply(await fetchPreview());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Arquivamento recusado.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h4>Manutenção do histórico</h4>
      {error && <p className={s.missionError} role="alert">{error}</p>}
      {preview && (
        <div className={s.maintenance}>
          <p className={preview.activeCount >= 800 ? s.missionError : s.missionEmpty}>
            Histórico ativo: {preview.activeCount} de 1000 · {preview.archivedCount} arquivada(s).
            {preview.activeCount >= 800 && " Perto do limite: arquive conversas antigas para continuar enviando."}
          </p>
          {preview.eligible > 0 ? (
            confirming ? (
              <div className={s.reviewActions}>
                <button disabled={busy} onClick={() => setConfirming(false)}>Cancelar</button>
                <button disabled={busy} onClick={() => void archive()}>
                  {busy ? "Arquivando…" : `Confirmar: arquivar ${preview.eligible}`}
                </button>
              </div>
            ) : (
              <button className={s.maintenanceButton} onClick={() => setConfirming(true)}>
                Arquivar {preview.eligible} conversa(s) concluída(s) com mais de 30 dias
              </button>
            )
          ) : (
            <p className={s.missionEmpty}>Nenhuma conversa concluída com mais de 30 dias para arquivar.</p>
          )}
          <small>Pedidos na fila, em andamento ou interrompidos nunca são arquivados. Nada é apagado.</small>
        </div>
      )}
    </>
  );
}

export function MissionsPanel({
  board,
  names,
  onClose,
  onOpenAgent,
  onDecided,
}: {
  board: MissionBoard;
  names: Record<string, string>;
  onClose: () => void;
  onOpenAgent: (id: AgentId) => void;
  onDecided: (text: string) => void;
}) {
  const [review, setReview] = useState<Decision | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  // Times are relative to the last load, keeping render pure.
  const now = board.loadedAt || 0;
  const active = board.jobs.filter((j) => ACTIVE.has(j.status)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const recent = board.jobs
    .filter((j) => !ACTIVE.has(j.status) && now - Date.parse(j.updatedAt) < 86_400_000)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 6);
  const waiting = board.decisions.filter((d) => !d.approved);
  const approved = board.decisions.filter((d) => d.approved);

  async function approve(decision: Decision) {
    setBusy(true);
    setFailure("");
    try {
      await approveDecision(decision);
      setReview(null);
      onDecided(`Aprovado: ${decision.title}. ${names[decision.agentId]} pode seguir.`);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Aprovação recusada.");
    } finally {
      setBusy(false);
    }
  }

  const mission = (j: ChatJob) => (
    <li key={j.id}>
      <button onClick={() => onOpenAgent(j.agentId)} aria-label={`Abrir conversa de ${names[j.agentId]}: ${j.text}`}>
        <span className={s.missionAgent}>{names[j.agentId]}</span>
        <span className={s.missionText}>{j.text}</span>
        <small data-state={j.status}>
          {jobLabels[j.status]} · {since(j.updatedAt, now)}
        </small>
      </button>
    </li>
  );

  return (
    <section
      className={s.missions}
      aria-label="Central de missões"
      onKeyDown={(event) => {
        if (event.key === "Escape" && !review) {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <header>
        <strong>Central de missões</strong>
        <button onClick={onClose} aria-label="Fechar central de missões">
          Fechar ×
        </button>
      </header>

      <h4>Aguardando sua decisão {board.errors.health || board.errors.professional ? "" : `· ${waiting.length}`}</h4>
      {(board.errors.health || board.errors.professional) && (
        <p className={s.missionError} role="alert">
          {[board.errors.health, board.errors.professional].filter(Boolean).join(" ")} A contagem pode estar incompleta.
        </p>
      )}
      {waiting.length ? (
        <ul>
          {waiting.map((d) => (
            <li key={d.key} className={s.decision}>
              <span className={s.missionAgent}>{names[d.agentId]}</span>
              <span className={s.missionText}>{d.title}</span>
              <small>Válida até {new Date(d.expiresAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</small>
              <button onClick={() => { setFailure(""); setReview(d); }}>Revisar e decidir</button>
            </li>
          ))}
        </ul>
      ) : (
        !board.errors.health && !board.errors.professional && board.loadedAt && <p className={s.missionEmpty}>Nenhuma proposta esperando você.</p>
      )}
      {approved.length > 0 && (
        <p className={s.missionEmpty}>
          {approved.length} aprovada(s) aguardando o agente aplicar.
        </p>
      )}

      <h4>Em andamento {board.errors.chat ? "" : `· ${active.length}`}</h4>
      {board.errors.chat && <p className={s.missionError} role="alert">{board.errors.chat}</p>}
      {active.length ? <ul>{active.map(mission)}</ul> : !board.errors.chat && board.loadedAt && (
        <p className={s.missionEmpty}>Nenhuma missão em curso. Escolha um tripulante e envie um pedido.</p>
      )}

      {recent.length > 0 && (
        <>
          <h4>Últimas 24 horas</h4>
          <ul>{recent.map(mission)}</ul>
        </>
      )}
      {!board.loadedAt && <p className={s.missionEmpty} role="status">Carregando missões…</p>}

      <HistoryMaintenance onDone={onDecided} />

      {review && (
        <div className={s.reviewBackdrop}>
          <div
            className={s.review}
            role="dialog"
            aria-modal="true"
            aria-label={`Revisar proposta: ${review.title}`}
            onKeyDown={(event) => {
              if (event.key === "Escape" && !busy) {
                event.stopPropagation();
                setReview(null);
              }
            }}
          >
            <strong>{review.title}</strong>
            <p>
              Proposta de {names[review.agentId]} · versão {review.revision} · hash {review.hash.slice(0, 12)}…
            </p>
            <p>A aprovação vale somente para estes campos e esta versão. Uma versão diferente exige nova decisão.</p>
            <pre>{JSON.stringify(review.data, null, 2)}</pre>
            {review.blocked && <p className={s.missionError}>{review.blocked}</p>}
            {failure && <p className={s.missionError} role="alert">{failure}</p>}
            <div className={s.reviewActions}>
              <button autoFocus disabled={busy} onClick={() => setReview(null)}>
                Voltar
              </button>
              <button disabled={busy || Boolean(review.blocked)} onClick={() => void approve(review)}>
                {busy ? "Registrando…" : "Aprovar estes campos"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

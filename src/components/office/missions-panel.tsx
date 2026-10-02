"use client";
import { useState } from "react";
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

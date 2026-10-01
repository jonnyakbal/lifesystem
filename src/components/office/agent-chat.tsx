"use client";
import { useEffect, useRef, useState } from "react";
import type { AgentId, ChatJob } from "@/lib/office/schema";
import styles from "./chat.module.css";
const labels = {
  queued: "Na fila",
  claimed: "Recebido pelo Hermes",
  running: "Trabalhando",
  completed: "Concluído",
  failed: "Não concluído",
  interrupted: "Interrompido",
};
export function AgentChat({
  agentId,
  name,
  initialDraft = "",
}: {
  agentId: AgentId;
  name: string;
  initialDraft?: string;
}) {
  const [jobs, setJobs] = useState<ChatJob[]>([]);
  const [draft, setDraft] = useState(initialDraft);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const pending = useRef<{
    clientId: string;
    agentId: AgentId;
    text: string;
  } | null>(null);
  const alive = useRef(true);
  const history = useRef<HTMLDivElement>(null);
  const [uncertain, setUncertain] = useState(false);
  useEffect(() => {
    alive.current = true;
    let stop = false;
    async function poll() {
      try {
        const r = await fetch(`/api/hermes/office/chat?agentId=${agentId}`, {
          cache: "no-store",
        });
        if (!r.ok)
          throw new Error(
            "Conversa indisponível. Verifique sua conexão ou login.",
          );
        const data = await r.json();
        if (!stop) {
          setJobs(current => {
            const byId = new Map<string, ChatJob>(current.map(j => [j.id, j]));
            for (const j of data.jobs as ChatJob[]) {
              const prior = byId.get(j.id);
              if (!prior || j.updatedAt >= prior.updatedAt) byId.set(j.id, j);
            }
            return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(-50);
          });
          if (
            pending.current &&
            data.jobs.some(
              (j: ChatJob) => j.clientId === pending.current?.clientId,
            )
          ) {
            pending.current = null;
            setUncertain(false);
            setError("");
            setDraft("");
          }
        }
      } catch (e) {
        if (!stop)
          setError(
            e instanceof Error ? e.message : "Não foi possível ler a conversa.",
          );
      }
    }
    void poll();
    const timer = setInterval(() => {
      if (!document.hidden) void poll();
    }, 4000);
    return () => {
      stop = true;
      alive.current = false;
      clearInterval(timer);
    };
  }, [agentId]);
  useEffect(() => {
    history.current?.scrollTo({
      top: history.current.scrollHeight,
      behavior: "instant",
    });
  }, [jobs]);
  async function send() {
    if (sending || !draft.trim()) return;
    const payload = pending.current || {
      clientId: crypto.randomUUID(),
      agentId,
      text: draft.trim(),
    };
    pending.current = payload;
    setSending(true);
    setError("");
    try {
      const r = await fetch("/api/hermes/office/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!r.ok) {
        pending.current = null;
        setUncertain(false);
        throw new Error(data.error || "Pedido não aceito.");
      }
      if (!alive.current) return;
      setJobs((current) => [
        ...current.filter((j) => j.id !== data.job.id),
        data.job,
      ]);
      pending.current = null;
      setUncertain(false);
      setDraft("");
    } catch (e) {
      if (alive.current) {
        setUncertain(!!pending.current);
        setError(
          pending.current
            ? "Não consegui confirmar o envio. Vou conferir a fila; use Conferir envio para verificar o mesmo pedido."
            : e instanceof Error
              ? e.message
              : "Não foi possível enviar.",
        );
      }
    } finally {
      if (alive.current) setSending(false);
    }
  }
  return (
    <section className={styles.chat} aria-label={`Conversa com ${name}`}>
      <header>
        <h3>Conversar com {name}</h3>
        <small>Conversa própria do escritório</small>
      </header>
      <div
        className={styles.history}
        ref={history}
        role="log"
        aria-label={`Histórico de ${name}`}
      >
        {!jobs.length && (
          <p className={styles.empty}>
            O que vamos avançar? Envie seu pedido aqui.
          </p>
        )}
        {jobs.map((j) => (
          <article key={j.id}>
            <div className={styles.user}>
              <small>
                Você ·{" "}
                {new Date(j.createdAt).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </small>
              <p>{j.text}</p>
            </div>
            <div className={styles.reply}>
              <small>
                {name} · {labels[j.status]}
              </small>
              {j.response ? (
                <p>{j.response}</p>
              ) : (
                <p className={styles.wait}>
                  {j.status === "running"
                    ? "Estou trabalhando no seu pedido…"
                    : "Seu pedido está na fila. Pode continuar explorando a estação."}
                </p>
              )}
            </div>
          </article>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <label htmlFor={`chat-${agentId}`}>Mensagem para {name}</label>
        <textarea
          id={`chat-${agentId}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={6000}
          rows={3}
          disabled={sending || uncertain}
          placeholder={`Fale com ${name}…`}
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          aria-label={uncertain ? "Conferir envio" : `Enviar para ${name}`}
        >
          {sending
            ? "Enviando…"
            : uncertain
              ? "Conferir envio"
              : `Enviar para ${name} ↗`}
        </button>
      </form>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <p className={styles.hint}>
        Envio executa um atendimento real. Pedidos que alteram dados seguem as
        regras de aprovação do agente.
      </p>
    </section>
  );
}

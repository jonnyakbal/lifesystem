"use client";
import { useEffect, useRef, useState } from "react";
import type { AgentId, ChatJob } from "@/lib/office/schema";
import styles from "./chat.module.css";
import { speak, speechOutputSupported, stopSpeaking, useBrowserCapability, useSpeechInput } from "./voice";

function readPreference(key: string) {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}
function writePreference(key: string, on: boolean) {
  try {
    window.localStorage.setItem(key, on ? "1" : "0");
  } catch {
    // Preference only; voice still works for this visit.
  }
}
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
  onSpeaking,
}: {
  agentId: AgentId;
  name: string;
  initialDraft?: string;
  onSpeaking?: (speaking: boolean) => void;
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
            let changed = false;
            for (const j of data.jobs as ChatJob[]) {
              const prior = byId.get(j.id);
              if (!prior || j.updatedAt > prior.updatedAt) {
                byId.set(j.id, j);
                changed = true;
              }
            }
            // An unchanged poll keeps the same array, so nothing re-renders or scrolls.
            if (!changed) return current;
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
  // Follow new messages only while the reader is already at the end or just
  // sent something; otherwise offer a jump button instead of stealing position.
  const atEnd = useRef(true);
  const justSent = useRef(false);
  const [unseen, setUnseen] = useState(false);
  function toEnd() {
    history.current?.scrollTo({ top: history.current.scrollHeight, behavior: "instant" });
    atEnd.current = true;
    setUnseen(false);
  }
  useEffect(() => {
    if (!jobs.length) return;
    if (atEnd.current || justSent.current) {
      justSent.current = false;
      toEnd();
    } else setUnseen(true);
  }, [jobs]);
  // Voice: speech in fills (or, if chosen, sends) the message; replies that
  // arrive after "Ouvir respostas" is switched on are read aloud once.
  // The chat only mounts after a click, so stored preferences are read directly.
  const [readAloud, setReadAloud] = useState(() => typeof window !== "undefined" && readPreference("office-voice-read"));
  const [autoSend, setAutoSend] = useState(() => typeof window !== "undefined" && readPreference("office-voice-autosend"));
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const canSpeak = useBrowserCapability(speechOutputSupported);
  const spoken = useRef<Set<string> | null>(null);
  const speakingRef = useRef(onSpeaking);
  useEffect(() => {
    speakingRef.current = onSpeaking;
  });
  useEffect(() => {
    return () => {
      stopSpeaking();
      speakingRef.current?.(false);
    };
  }, []);
  function play(job: ChatJob) {
    if (!job.response) return;
    speak(job.response, agentId, {
      onStart: () => {
        setSpeakingId(job.id);
        speakingRef.current?.(true);
      },
      onEnd: () => {
        setSpeakingId((current) => (current === job.id ? null : current));
        speakingRef.current?.(false);
      },
    });
  }
  function silence() {
    stopSpeaking();
    setSpeakingId(null);
    speakingRef.current?.(false);
  }
  useEffect(() => {
    const done = jobs.filter((j) => j.status === "completed" && j.response);
    if (!readAloud) {
      spoken.current = null;
      return;
    }
    // History present when reading starts is never replayed.
    if (!spoken.current) {
      spoken.current = new Set(done.map((j) => j.id));
      return;
    }
    const next = done.find((j) => !spoken.current!.has(j.id));
    if (!next) return;
    spoken.current.add(next.id);
    play(next);
    // play is recreated each render; jobs/readAloud are the real triggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, readAloud]);
  const mic = useSpeechInput((heard) => {
    if (autoSend && !pending.current) void send(heard);
    else setDraft((current) => (current.trim() ? `${current.trim()} ${heard}` : heard));
  });
  async function send(spoken?: string) {
    const text = (spoken ?? draft).trim();
    if (sending || !text) return;
    const payload = pending.current || {
      clientId: crypto.randomUUID(),
      agentId,
      text,
    };
    pending.current = payload;
    justSent.current = true;
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
        onScroll={(e) => {
          const el = e.currentTarget;
          atEnd.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
          if (atEnd.current) setUnseen(false);
        }}
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
                <>
                  <p>{j.response}</p>
                  {canSpeak && (
                    <button
                      type="button"
                      className={styles.listen}
                      aria-pressed={speakingId === j.id}
                      onClick={() => (speakingId === j.id ? silence() : play(j))}
                    >
                      {speakingId === j.id ? "■ Parar" : "▶ Ouvir"}
                    </button>
                  )}
                </>
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
      {unseen && (
        <button type="button" className={styles.jump} onClick={toEnd}>
          Novas mensagens ↓
        </button>
      )}
      <div className={styles.voice} aria-label={`Voz com ${name}`} role="group">
        {mic.supported ? (
          <button
            type="button"
            className={mic.listening ? styles.micOn : styles.mic}
            aria-pressed={mic.listening}
            disabled={sending || uncertain}
            onClick={() => (mic.listening ? mic.stop() : mic.start())}
          >
            {mic.listening ? "● Ouvindo… toque para parar" : `🎙 Falar com ${name}`}
          </button>
        ) : (
          <small>Seu navegador não oferece reconhecimento de voz; digite abaixo.</small>
        )}
        {canSpeak && (
          <label>
            <input
              type="checkbox"
              checked={readAloud}
              onChange={(e) => {
                setReadAloud(e.target.checked);
                writePreference("office-voice-read", e.target.checked);
                if (!e.target.checked) silence();
              }}
            />
            Ouvir respostas
          </label>
        )}
        {mic.supported && (
          <label>
            <input
              type="checkbox"
              checked={autoSend}
              onChange={(e) => {
                setAutoSend(e.target.checked);
                writePreference("office-voice-autosend", e.target.checked);
              }}
            />
            Enviar ao terminar de falar
          </label>
        )}
        {mic.listening && (
          <p className={styles.interim} aria-live="polite">
            {mic.interim || "Pode falar…"}
          </p>
        )}
        {mic.error && <p role="alert" className={styles.error}>{mic.error}</p>}
        {mic.supported && (
          <small className={styles.voiceNote}>
            A transcrição usa o serviço de voz do navegador (no Chrome, o áudio
            vai para o Google). A voz local pelo Hermes ainda não está ativa.
          </small>
        )}
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

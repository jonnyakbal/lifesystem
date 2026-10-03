"use client";
import { useEffect, useRef, useState } from "react";
import type { AgentId } from "@/lib/office/schema";
import styles from "./chat.module.css";
import { speak, stopSpeaking, useSpeechInput, voiceNameFor } from "./voice";

// Hands-free, fast voice talk (docs/contracts/office-voice-v1.md, "ao vivo").
// Speak -> fast LifeSystem AI answers in the member's persona -> it speaks ->
// the microphone reopens. Touching while it speaks interrupts and listens.
// Not the Hermes profile: no memory, tools or queued job; "Mandar ao Hermes"
// turns the last thing you said into a normal, explicit request.

type Turn = { role: "user" | "assistant"; content: string };
type Phase = "idle" | "listening" | "thinking" | "speaking";

export function LiveTalk({
  agentId,
  name,
  onSpeaking,
  onSendToHermes,
}: {
  agentId: AgentId;
  name: string;
  onSpeaking?: (speaking: boolean) => void;
  onSendToHermes: (text: string) => void;
}) {
  const [on, setOn] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [thinking, setThinking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState("");
  const [via, setVia] = useState("");
  const [voiceName, setVoiceName] = useState<string | null>(null);
  const onRef = useRef(on);
  const turnsRef = useRef(turns);
  const speakingCb = useRef(onSpeaking);
  useEffect(() => {
    onRef.current = on;
    turnsRef.current = turns;
    speakingCb.current = onSpeaking;
  });
  const askRef = useRef<(text: string) => void>(() => {});
  const mic = useSpeechInput((heard) => askRef.current(heard));
  const micRef = useRef(mic);
  useEffect(() => {
    micRef.current = mic;
  });

  async function ask(text: string) {
    const history = turnsRef.current.slice(-12);
    setTurns((t) => [...t, { role: "user", content: text }]);
    setThinking(true);
    setError("");
    const started = performance.now();
    try {
      const r = await fetch("/api/hermes/office/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, text, history }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "A IA não respondeu.");
      if (!onRef.current) return;
      setVia(`${data.via.provider} · ${String(data.via.model).split("/").pop()} · ${((performance.now() - started) / 1000).toFixed(1)}s`);
      setTurns((t) => [...t, { role: "assistant", content: data.text }]);
      const started2 = speak(data.text, agentId, {
        onStart: () => {
          setSpeaking(true);
          speakingCb.current?.(true);
        },
        onEnd: () => {
          setSpeaking(false);
          speakingCb.current?.(false);
          if (onRef.current) micRef.current.start();
        },
      });
      if (!started2 && onRef.current) micRef.current.start();
    } catch (e) {
      setError(e instanceof Error ? e.message : "A IA não respondeu.");
    } finally {
      setThinking(false);
    }
  }

  useEffect(() => {
    askRef.current = (text) => void ask(text);
  });

  function start() {
    setOn(true);
    setError("");
    setVoiceName(voiceNameFor(agentId));
    mic.start();
  }
  function end() {
    setOn(false);
    mic.stop();
    stopSpeaking();
    setSpeaking(false);
    speakingCb.current?.(false);
  }
  function orb() {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      speakingCb.current?.(false);
      mic.start();
    } else if (mic.listening) mic.stop();
    else if (!thinking) mic.start();
  }
  useEffect(() => {
    if (!on) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") end();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
    // end only reads refs and setters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);
  // Closing the panel must not let a cancelled utterance reopen the mic.
  useEffect(() => () => {
    onRef.current = false;
    stopSpeaking();
  }, []);

  if (!mic.supported)
    return null;
  if (!on)
    return (
      <button type="button" className={styles.liveStart} onClick={start}>
        ⚡ Conversa ao vivo com {name}
      </button>
    );

  const phase: Phase = speaking ? "speaking" : thinking ? "thinking" : mic.listening ? "listening" : "idle";
  const label = { idle: "Toque para falar", listening: "Ouvindo… toque para enviar", thinking: "Pensando…", speaking: "Falando… toque para interromper" }[phase];
  const lastUser = [...turns].reverse().find((t) => t.role === "user");
  return (
    <section className={styles.live} aria-label={`Conversa ao vivo com ${name}`}>
      <button type="button" className={styles.liveOrb} data-phase={phase} onClick={orb} disabled={phase === "thinking"} aria-label={label}>
        <span aria-hidden="true" />
      </button>
      <p className={styles.livePhase} aria-live="polite">{label}</p>
      {mic.listening && mic.interim && <p className={styles.interim}>{mic.interim}</p>}
      <div className={styles.liveTurns}>
        {turns.slice(-4).map((t, i) => (
          <p key={`${turns.length}-${i}`} data-role={t.role}>
            <b>{t.role === "user" ? "Você" : name}:</b> {t.content}
          </p>
        ))}
      </div>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {mic.error && <p role="alert" className={styles.error}>{mic.error}</p>}
      <div className={styles.liveActions}>
        {lastUser && (
          <button type="button" onClick={() => onSendToHermes(lastUser.content)}>
            Mandar a última fala ao Hermes
          </button>
        )}
        <button type="button" onClick={end}>Encerrar (Esc)</button>
      </div>
      <small className={styles.voiceNote}>
        Resposta rápida pela IA do LifeSystem{via ? ` (${via})` : ""}, sem memória nem ferramentas do Hermes.
        {voiceName ? ` Voz: ${voiceName}.` : ""} Para vozes mais naturais, use o Edge (vozes “Natural”) ou o Chrome (voz Google).
      </small>
    </section>
  );
}

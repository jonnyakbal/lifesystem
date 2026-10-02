"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { AgentId } from "@/lib/office/schema";

// Browser voice for the station, until Hermes serves local speech (see
// docs/contracts/office-voice-v1.md). Speech input uses the browser's
// recognizer: Chrome sends that audio to its own provider, so it is opt-in
// and labelled. Speech output uses the operating system's voices.

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function recognizer(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

const micErrors: Record<string, string> = {
  "not-allowed": "Permita o microfone no navegador para falar com a tripulação.",
  "service-not-allowed": "O navegador bloqueou o reconhecimento de voz.",
  "no-speech": "Não ouvi nada. Tente de novo mais perto do microfone.",
  "audio-capture": "Nenhum microfone encontrado.",
  network: "O reconhecimento do navegador precisa de internet.",
};

const never = () => () => {};
/** Browser capability, false during server render, without effect-driven state. */
export function useBrowserCapability(check: () => boolean) {
  return useSyncExternalStore(never, check, () => false);
}

export function useSpeechInput(onFinal: (text: string) => void) {
  const supported = useBrowserCapability(() => Boolean(recognizer()));
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const active = useRef<Recognition | null>(null);
  const finalRef = useRef(onFinal);
  useEffect(() => {
    finalRef.current = onFinal;
  });
  useEffect(() => () => active.current?.abort(), []);
  const start = useCallback(() => {
    const Ctor = recognizer();
    if (!Ctor || active.current) return;
    const rec = new Ctor();
    rec.lang = "pt-BR";
    rec.continuous = false;
    rec.interimResults = true;
    let heard = "";
    rec.onresult = (event) => {
      let partial = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) heard += result[0].transcript;
        else partial += result[0].transcript;
      }
      setInterim((heard + partial).trim());
    };
    rec.onerror = (event) => {
      if (event.error !== "aborted") setError(micErrors[event.error] || "Não consegui ouvir. Tente novamente.");
    };
    rec.onend = () => {
      active.current = null;
      setListening(false);
      setInterim("");
      if (heard.trim()) finalRef.current(heard.trim());
    };
    active.current = rec;
    setError("");
    setInterim("");
    setListening(true);
    rec.start();
  }, []);
  const stop = useCallback(() => active.current?.stop(), []);
  return { supported, listening, interim, error, start, stop };
}

// Distinct but natural settings per crew member; pitch/rate only, no cloning.
const personas: Record<AgentId, { pitch: number; rate: number }> = {
  hermes: { pitch: 1, rate: 1.02 },
  vega: { pitch: 1.15, rate: 1 },
  sirius: { pitch: 0.9, rate: 1.06 },
  orion: { pitch: 0.82, rate: 0.96 },
  astro: { pitch: 1.08, rate: 0.94 },
  cosmo: { pitch: 1.22, rate: 1.1 },
};

/** Short sentences avoid engines that silently stop long utterances. */
export function speechChunks(text: string, max = 220): string[] {
  const clean = text.replace(/```[\s\S]*?```/g, " (trecho de código omitido) ").replace(/[#*_>`]/g, "").replace(/\s+/g, " ").trim();
  const sentences = clean.match(/[^.!?…]+[.!?…]*/g) || [];
  const chunks: string[] = [];
  for (const sentence of sentences) {
    let rest = sentence.trim();
    while (rest.length > max) {
      const cut = rest.lastIndexOf(" ", max);
      chunks.push(rest.slice(0, cut > 40 ? cut : max));
      rest = rest.slice(cut > 40 ? cut + 1 : max);
    }
    if (rest) chunks.push(rest);
  }
  return chunks;
}

export function speechOutputSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

export function speak(text: string, agent: AgentId, events: { onStart?: () => void; onEnd?: () => void } = {}) {
  if (!speechOutputSupported()) return false;
  const synth = window.speechSynthesis;
  synth.cancel();
  const chunks = speechChunks(text);
  if (!chunks.length) return false;
  const voice = synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith("pt"));
  const persona = personas[agent];
  chunks.forEach((chunk, index) => {
    const utterance = new SpeechSynthesisUtterance(chunk);
    utterance.lang = "pt-BR";
    if (voice) utterance.voice = voice;
    utterance.pitch = persona.pitch;
    utterance.rate = persona.rate;
    if (index === 0) utterance.onstart = () => events.onStart?.();
    if (index === chunks.length - 1) {
      utterance.onend = () => events.onEnd?.();
      utterance.onerror = () => events.onEnd?.();
    }
    synth.speak(utterance);
  });
  return true;
}

export function stopSpeaking() {
  if (speechOutputSupported()) window.speechSynthesis.cancel();
}

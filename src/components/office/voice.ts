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

// Each crew member gets its own natural voice when the system has several.
// Pitch stays close to 1: bending it was what made voices sound robotic.
const personas: Record<AgentId, { gender: "m" | "f"; pitch: number; rate: number; slot: number }> = {
  hermes: { gender: "m", pitch: 1, rate: 1.08, slot: 0 },
  vega: { gender: "f", pitch: 1, rate: 1.06, slot: 0 },
  sirius: { gender: "m", pitch: 0.97, rate: 1.1, slot: 1 },
  orion: { gender: "m", pitch: 0.94, rate: 1.02, slot: 2 },
  astro: { gender: "f", pitch: 1.02, rate: 1.04, slot: 1 },
  cosmo: { gender: "f", pitch: 1.04, rate: 1.12, slot: 2 },
};

const maleNames = /antonio|daniel|donato|fabio|f[aá]bio|humberto|julio|j[uú]lio|nicolau|valerio|val[eé]rio|thiago|duarte|male|masculin/i;

/** Higher is better: neural/online voices first, then Google, then pt-BR. */
export function voiceScore(v: { name: string; lang: string; localService?: boolean }): number {
  const lang = v.lang.toLowerCase().replace("_", "-");
  if (!lang.startsWith("pt")) return -1;
  let score = lang === "pt-br" ? 30 : 5;
  if (/natural|neural|online|premium|enhanced|wavenet/i.test(v.name)) score += 100;
  if (/google/i.test(v.name)) score += 60;
  if (/desktop|compact|espeak/i.test(v.name)) score -= 40;
  if (v.localService === false) score += 5;
  return score;
}

export function pickVoice<V extends { name: string; lang: string; localService?: boolean }>(voices: V[], agent: AgentId): V | undefined {
  const ranked = voices.filter((v) => voiceScore(v) >= 0).sort((a, b) => voiceScore(b) - voiceScore(a));
  if (!ranked.length) return undefined;
  const persona = personas[agent];
  const best = voiceScore(ranked[0]);
  // Only voices close to the best quality compete; never trade a natural
  // voice for a robotic one just to vary gender.
  const good = ranked.filter((v) => voiceScore(v) >= best - 40);
  const sameGender = good.filter((v) => (maleNames.test(v.name) ? "m" : "f") === persona.gender);
  const pool = sameGender.length ? sameGender : good;
  return pool[persona.slot % pool.length];
}

/** Voices load asynchronously; the first call often sees an empty list. Waits
 * once, briefly, then never delays speech again. */
let waitedForVoices = false;
function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis;
  const now = synth.getVoices();
  if (now.length || waitedForVoices) return Promise.resolve(now);
  waitedForVoices = true;
  return new Promise((resolve) => {
    const done = () => resolve(synth.getVoices());
    synth.addEventListener?.("voiceschanged", done, { once: true });
    setTimeout(done, 600);
  });
}

export function voiceNameFor(agent: AgentId): string | null {
  if (!speechOutputSupported()) return null;
  return pickVoice(window.speechSynthesis.getVoices(), agent)?.name || null;
}

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
  const persona = personas[agent];
  void loadVoices().then((voices) => {
    const voice = pickVoice(voices, agent);
    chunks.forEach((chunk, index) => {
      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.lang = voice?.lang || "pt-BR";
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
  });
  return true;
}

export function stopSpeaking() {
  if (speechOutputSupported()) window.speechSynthesis.cancel();
}

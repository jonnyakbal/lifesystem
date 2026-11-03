"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AgentSigil } from "@/components/brand/sigils";
import { colors } from "../agent-sheet";
import type { AgentId } from "@/lib/office/schema";
import type { Chapter, Speaker } from "./chapters";
import { StageProp } from "./stage-props";
import s from "./story.module.css";

const names: Record<Speaker, string> = {
  hermes: "Hermes", vega: "Vega", sirius: "Sirius", orion: "Órion", astro: "Astro", cosmo: "Cosmo", antares: "Antares", sistema: "Sistema",
};

type Phase = "title" | "play" | "end";

/** Cena de cinema: cartão de título, falas digitadas com adereço animado no
 * palco e cartão final com a conquista e o caminho para a tela real.
 * Espaço/Enter/→ avançam (o 1º toque completa a fala), ← volta, Esc sai. */
export function Cutscene({ chapter, next, onComplete, onClose, onNext, onMeet }: {
  chapter: Chapter; next?: Chapter; onComplete: (id: string) => void; onClose: () => void; onNext: (id: string) => void; onMeet?: (agent: AgentId) => void;
}) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("title");
  const [index, setIndex] = useState(0);
  const [typedRaw, setTyped] = useState(0);
  const dialog = useRef<HTMLDivElement>(null);
  const beat = chapter.beats[index];
  // Com movimento reduzido a fala aparece inteira, sem digitação.
  const typed = reduce ? beat.line.length : typedRaw;
  const full = typed >= beat.line.length;

  useEffect(() => { dialog.current?.focus(); }, []);
  useEffect(() => {
    if (phase !== "title") return;
    const id = window.setTimeout(() => setPhase("play"), reduce ? 400 : 1900);
    return () => window.clearTimeout(id);
  }, [phase, reduce]);
  useEffect(() => {
    if (phase !== "play" || full) return;
    const id = window.setTimeout(() => setTyped((n) => Math.min(beat.line.length, n + 2)), 26);
    return () => window.clearTimeout(id);
  }, [phase, typed, full, beat.line.length]);

  const advance = useCallback(() => {
    if (phase === "title") { setPhase("play"); return; }
    if (phase === "end") return;
    if (!full) { setTyped(beat.line.length); return; }
    if (index + 1 < chapter.beats.length) { setIndex(index + 1); setTyped(0); return; }
    setPhase("end");
    onComplete(chapter.id);
  }, [phase, full, beat.line.length, index, chapter, onComplete]);
  const back = useCallback(() => {
    if (phase === "play" && index > 0) { setIndex(index - 1); setTyped(chapter.beats[index - 1].line.length); }
  }, [phase, index, chapter.beats]);

  function onKey(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      // Sem isto o mesmo Esc chega ao menu que reabre e fecha a campanha inteira.
      event.preventDefault(); event.stopPropagation(); onClose();
    }
    else if (event.key === "ArrowLeft") { event.preventDefault(); back(); }
    else if ((event.key === " " || event.key === "Enter" || event.key === "ArrowRight") && !(event.target instanceof HTMLAnchorElement || event.target instanceof HTMLButtonElement)) {
      event.preventDefault(); advance();
    }
  }

  const color = beat.who === "sistema" ? "var(--story-accent)" : colors[beat.who];
  return (
    <motion.div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`Cena: ${chapter.title}`} className={s.cutscene} onKeyDown={onKey}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className={s.barTop} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: reduce ? 0 : 0.5, ease: "easeOut" }} />
      <motion.div className={s.barBottom} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: reduce ? 0 : 0.5, ease: "easeOut" }} />
      <div className={s.hud}>
        <span>CAPÍTULO {String(chapter.number).padStart(2, "0")} · {chapter.title.toUpperCase()}</span>
        <button type="button" onClick={onClose}>{phase === "end" ? "Fechar" : "Pular cena"} <kbd>Esc</kbd></button>
      </div>

      <AnimatePresence mode="wait">
        {phase === "title" && (
          <motion.button key="title" type="button" className={s.titleCard} onClick={advance} initial={{ opacity: 0, letterSpacing: "0.6em" }} animate={{ opacity: 1, letterSpacing: "0.12em" }} exit={{ opacity: 0, y: -20 }} transition={{ duration: reduce ? 0 : 0.9 }}>
            <small>Capítulo {chapter.number}</small>
            <strong>{chapter.title}</strong>
            <span>{chapter.tagline}</span>
          </motion.button>
        )}
        {phase === "play" && (
          <motion.div key="play" className={s.scene} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className={s.stage} onClick={advance}>
              <AnimatePresence mode="wait">
                <motion.div key={beat.prop} className={s.stageInner} initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.04 }} transition={{ duration: reduce ? 0 : 0.35 }}>
                  <StageProp kind={beat.prop} at={beat.at ?? 0} />
                </motion.div>
              </AnimatePresence>
            </div>
            <div className={s.dialogue} style={{ "--agent": color } as React.CSSProperties} onClick={advance}>
              <motion.div key={beat.who} className={s.portrait} initial={{ x: -16, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
                {beat.who !== "sistema" && <AgentSigil agent={beat.who} color={colors[beat.who]} size={52} />}
              </motion.div>
              <div className={s.speech}>
                <b className={s.nameplate}>{names[beat.who]}</b>
                <p aria-hidden="true">{beat.line.slice(0, typed)}<span className={s.caret} data-done={full}>{full ? "▼" : "▌"}</span></p>
                <p className="sr-only" aria-live="polite">{names[beat.who]}: {beat.line}</p>
              </div>
              <div className={s.controls} onClick={(e) => e.stopPropagation()}>
                <button type="button" onClick={back} disabled={index === 0} aria-label="Fala anterior">◀</button>
                <span aria-label={`Fala ${index + 1} de ${chapter.beats.length}`}>{chapter.beats.map((_, i) => <i key={i} data-on={i <= index} />)}</span>
                <button type="button" onClick={advance} aria-label={full ? "Próxima fala" : "Mostrar fala inteira"}>▶</button>
              </div>
            </div>
          </motion.div>
        )}
        {phase === "end" && (
          <motion.div key="end" className={s.endCard} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <motion.div className={s.badge} initial={{ rotate: -180, scale: 0 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 12, delay: reduce ? 0 : 0.2 }}>★</motion.div>
            <small>Conquista desbloqueada</small>
            <strong>{chapter.badge}</strong>
            <span>Capítulo {chapter.number} concluído: {chapter.title}</span>
            <div className={s.endActions}>
              {chapter.cta && <Link href={chapter.cta.href} className={s.primary}>{chapter.cta.label} →</Link>}
              {next ? <button type="button" className={chapter.cta ? s.secondary : s.primary} onClick={() => onNext(next.id)}>Próximo: {next.title}</button>
                : <button type="button" className={s.secondary} onClick={onClose}>Voltar à estação</button>}
              {onMeet && <button type="button" className={s.secondary} onClick={() => onMeet(chapter.host)}>Ver {names[chapter.host]} na estação</button>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

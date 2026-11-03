"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { AgentId } from "@/lib/office/schema";
import { chapterById, chapters } from "./chapters";
import { Cutscene } from "./cutscene";
import s from "./story.module.css";

const storageKey = "lifesystem-office-story";

function readDone(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string" && id in chapterById) : [];
  } catch { return []; }
}

/** Progresso da campanha fica só neste navegador: é guia, não registro. */
export function useStoryProgress() {
  const [done, setDone] = useState<string[]>([]);
  useEffect(() => {
    const sync = () => setDone(readDone());
    queueMicrotask(sync);
    window.addEventListener("lifesystem-story-change", sync);
    return () => window.removeEventListener("lifesystem-story-change", sync);
  }, []);
  const save = useCallback((next: string[]) => {
    setDone(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Vale nesta sessão. */ }
    window.dispatchEvent(new Event("lifesystem-story-change"));
  }, []);
  const complete = useCallback((id: string) => {
    const current = readDone();
    save(current.includes(id) ? current : [...current, id]);
  }, [save]);
  const reset = useCallback(() => save([]), [save]);
  return { done, complete, reset };
}

/** Seleção de capítulos (como um menu de campanha) + o player da cena. */
export function StoryCampaign({ open, onClose, startWith, onMeet }: { open: boolean; onClose: () => void; startWith?: string | null; onMeet?: (agent: AgentId) => void }) {
  const { done, complete, reset } = useStoryProgress();
  const [playing, setPlaying] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);
  if (open && !opened) { setOpened(true); if (startWith) setPlaying(startWith); }
  if (!open && opened) { setOpened(false); setPlaying(null); }

  const nextUp = chapters.find((c) => !done.includes(c.id));
  const current = playing ? chapterById[playing] : null;
  const after = current ? chapters[current.number + 1] : undefined;

  useEffect(() => {
    if (!open || playing) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, playing, onClose]);

  return (
    <AnimatePresence>
      {open && !current && (
        <motion.div key="menu" className={s.campaignBackdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.section role="dialog" aria-modal="true" aria-label="Modo história" className={s.campaign} onClick={(e) => e.stopPropagation()}
            initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}>
            <header>
              <div>
                <small>Modo história · a doutrina da estação</small>
                <h2>Campanha</h2>
              </div>
              <span className={s.progress}><b>{done.length}</b>/{chapters.length} capítulos</span>
              <button type="button" className={s.close} onClick={onClose} aria-label="Fechar modo história">✕</button>
            </header>
            <div className={s.meter} aria-hidden="true"><i style={{ width: `${(done.length / chapters.length) * 100}%` }} /></div>
            <ol className={s.chapterList}>
              {chapters.map((chapter, i) => {
                const finished = done.includes(chapter.id);
                const isNext = nextUp?.id === chapter.id;
                return (
                  <motion.li key={chapter.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                    <button type="button" className={s.chapterRow} data-done={finished} data-next={isNext} onClick={() => setPlaying(chapter.id)} aria-label={`Assistir capítulo ${chapter.number}: ${chapter.title}${finished ? " (concluído)" : ""}`}>
                      <span className={s.chapterNum}>{finished ? "★" : String(chapter.number).padStart(2, "0")}</span>
                      <span className={s.chapterText}><strong>{chapter.title}</strong><small>{chapter.tagline}</small></span>
                      <span className={s.chapterState}>{finished ? chapter.badge : isNext ? "▶ Próximo" : `${chapter.beats.length} falas`}</span>
                    </button>
                  </motion.li>
                );
              })}
            </ol>
            <footer>
              <span>Espaço avança · ← volta · Esc sai</span>
              {done.length > 0 && <button type="button" onClick={reset}>Recomeçar campanha</button>}
            </footer>
          </motion.section>
        </motion.div>
      )}
      {open && current && (
        <Cutscene key={current.id} chapter={current} next={after} onComplete={complete} onNext={setPlaying} onMeet={onMeet} onClose={() => (startWith ? onClose() : setPlaying(null))} />
      )}
    </AnimatePresence>
  );
}

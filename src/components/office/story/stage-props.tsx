"use client";

import { AnimatePresence, motion } from "motion/react";
import type { AgentId } from "@/lib/office/schema";
import { AgentSigil, agentSky } from "@/components/brand/sigils";
import { colors } from "../agent-sheet";
import type { PropKind } from "./chapters";
import s from "./story.module.css";

// Mini-interfaces do palco: cada uma é um pedaço do sistema real, encenado.
// `at` avança a animação conforme a fala; tudo é decorativo (aria-hidden),
// porque a fala já diz o que a cena mostra.

const pop = { initial: { opacity: 0, scale: 0.6, y: 10 }, animate: { opacity: 1, scale: 1, y: 0 } };
const crewIds: AgentId[] = ["vega", "sirius", "orion", "astro", "cosmo", "antares"];

function Crew({ at }: { at: number }) {
  return (
    <div className={s.crew}>
      <motion.div className={s.crewLead} {...pop} transition={{ type: "spring", stiffness: 260, damping: 18 }}>
        <AgentSigil agent="hermes" color={colors.hermes} size={64} />
        <span>Hermes</span>
      </motion.div>
      <div className={s.crewRing}>
        {at > 0 &&
          crewIds.map((id, i) => (
            <motion.div key={id} className={s.crewMember} style={{ "--agent": colors[id] } as React.CSSProperties} {...pop} transition={{ delay: 0.15 + i * 0.22, type: "spring", stiffness: 300, damping: 20 }}>
              <AgentSigil agent={id} color={colors[id]} size={40} />
              <b>{id === "orion" ? "Órion" : id[0].toUpperCase() + id.slice(1)}</b>
              <small>{agentSky[id].role}</small>
            </motion.div>
          ))}
      </div>
    </div>
  );
}

const cycleSteps = ["Capturar", "Esclarecer", "Organizar", "Refletir", "Agir"];
function Cycle({ at }: { at: number }) {
  return (
    <div className={s.cycle}>
      <motion.div className={s.cycleRing} animate={{ rotate: at > 0 ? 360 : 0 }} transition={{ duration: 6, ease: "linear", repeat: at > 0 ? Infinity : 0 }} />
      {cycleSteps.map((step, i) => {
        const angle = (i / cycleSteps.length) * Math.PI * 2 - Math.PI / 2;
        return (
          <motion.span key={step} className={s.cycleStep} style={{ left: `${50 + Math.cos(angle) * 40}%`, top: `${50 + Math.sin(angle) * 40}%` }}
            initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 + i * 0.35 }}>
            <i>{i + 1}</i>{step}
          </motion.span>
        );
      })}
      <motion.strong className={s.cycleCore} animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 2.4, repeat: Infinity }}>
        ciclo
      </motion.strong>
    </div>
  );
}

const thoughts = ["Ligar pro DJ do sábado", "Ideia de flyer retrô", "Pagar o som", "Edital LIC até dia 26"];
function Capture({ at }: { at: number }) {
  const inBox = Math.min(thoughts.length, at >= 2 ? thoughts.length : at === 1 ? 2 : 0);
  return (
    <div className={s.capture}>
      <div className={s.cloud}>
        <small className={s.cloudLabel}>Sua cabeça</small>
        {inBox === thoughts.length && <motion.span className={s.silence} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>silêncio… espaço para pensar</motion.span>}
        {thoughts.map((t, i) => i >= inBox && (
          <motion.span key={t} className={s.thought} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: [0, -4, 0] }} transition={{ delay: i * 0.25, y: { duration: 2.2, repeat: Infinity, delay: i * 0.3 } }}>
            {t}
          </motion.span>
        ))}
      </div>
      <div className={s.tray}>
        <header>Caixa de entrada <b>{inBox}</b></header>
        <AnimatePresence>
          {thoughts.slice(0, inBox).map((t, i) => (
            <motion.div key={t} className={s.trayItem} initial={{ opacity: 0, x: -120, y: -60, rotate: -8 }} animate={{ opacity: 1, x: 0, y: 0, rotate: 0 }} transition={{ delay: i * 0.18, type: "spring", stiffness: 220, damping: 22 }}>
              {t}
            </motion.div>
          ))}
        </AnimatePresence>
        {at >= 3 && <motion.p className={s.trayCalm} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>cabeça livre ✓</motion.p>}
      </div>
    </div>
  );
}

function Clarify({ at }: { at: number }) {
  const no = ["Lixo", "Nota", "Algum dia"];
  const yes = ["< 2 min: faça", "Delegue", "Tarefa", "Projeto"];
  return (
    <div className={s.clarify}>
      <motion.div className={s.clarifyCard} {...pop}>Ideia de flyer retrô</motion.div>
      <motion.div className={s.clarifyQuestion} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>Exige alguma ação?</motion.div>
      <div className={s.clarifyBranches}>
        <div className={s.branch} data-active={at === 1}>
          <span className={s.branchLabel}>Não</span>
          {no.map((n, i) => <motion.em key={n} initial={{ opacity: 0 }} animate={{ opacity: at >= 1 ? 1 : 0.25 }} transition={{ delay: at === 1 ? i * 0.2 : 0 }}>{n}</motion.em>)}
        </div>
        <div className={s.branch} data-active={at >= 2}>
          <span className={s.branchLabel}>Sim</span>
          {yes.map((n, i) => {
            const lit = (at === 2 && i < 2) || (at >= 3 && i >= 2);
            return <motion.em key={n} data-lit={lit} initial={{ opacity: 0 }} animate={{ opacity: at >= 2 ? (lit ? 1 : 0.45) : 0.25, scale: lit ? 1.06 : 1 }} transition={{ delay: lit ? i * 0.15 : 0 }}>{n}</motion.em>;
          })}
        </div>
      </div>
    </div>
  );
}

// Mesmo mapa de teclas da Caixa de entrada (inbox/page.tsx); mudar lá e aqui juntos.
const keys = [["1", "Descartar"], ["2", "Nota"], ["3", "Fazer agora"], ["4", "Tarefa"], ["5", "Delegar"], ["6", "Projeto"], ["7", "Outro destino"]];
function Keys() {
  return (
    <div className={s.keys}>
      {keys.map(([k, label], i) => (
        <motion.div key={k} className={s.key} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: [0, 0, 4, 0] }} transition={{ delay: i * 0.12, y: { delay: 0.9 + i * 0.35, duration: 0.3, times: [0, 0.4, 0.6, 1] } }}>
          <kbd>{k}</kbd><span>{label}</span>
        </motion.div>
      ))}
    </div>
  );
}

function Project({ at }: { at: number }) {
  return (
    <div className={s.project}>
      <motion.div className={s.projectCard} {...pop}>
        <small>Projeto</small>
        <strong>Festa Retrô de novembro</strong>
        <div className={s.projectSteps}>
          {["Fechar line-up", "Arte do flyer", "Abrir vendas"].map((step, i) => (
            <motion.span key={step} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.2 }}>{step}</motion.span>
          ))}
        </div>
        <motion.div className={s.projectNext} data-ok={at >= 1} animate={at >= 1 ? { scale: [1, 1.05, 1] } : {}} transition={{ duration: 0.5 }}>
          {at >= 1 ? "Próxima ação: mandar mensagem para os DJs" : "Sem próxima ação · parado"}
        </motion.div>
      </motion.div>
    </div>
  );
}

const areas: { name: string; agent: AgentId; projects: string[] }[] = [
  { name: "Finanças", agent: "vega", projects: ["Orçamento"] },
  { name: "Corpo", agent: "orion", projects: ["Treino 3x"] },
  { name: "Trabalho", agent: "sirius", projects: ["Festa Retrô", "ARCO PASS"] },
  { name: "Mente", agent: "astro", projects: ["Curso"] },
];
function Areas({ at }: { at: number }) {
  return (
    <div className={s.areas}>
      {areas.map((area, i) => (
        <motion.div key={area.name} className={s.area} style={{ "--agent": colors[area.agent] } as React.CSSProperties} {...pop} transition={{ delay: i * 0.15 }}>
          <div className={s.planet}>
            <AgentSigil agent={area.agent} color="#0b0a1e" size={30} />
            {at >= 1 && area.projects.map((p, j) => (
              <motion.i key={p} className={s.moon} initial={{ opacity: 0 }} animate={{ opacity: 1, rotate: 360 }} transition={{ opacity: { delay: 0.2 + j * 0.2 }, rotate: { duration: 6 + j * 3, repeat: Infinity, ease: "linear" } }} style={{ inset: -10 - j * 9 }} />
            ))}
          </div>
          <b>{area.name}</b>
          <div className={s.areaProjects}>
            {at >= 1 && area.projects.map((p, j) => (
              <motion.span key={p} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + j * 0.2 }}>{p}</motion.span>
            ))}
          </div>
        </motion.div>
      ))}
      {at >= 2 && (
        <motion.div className={s.note} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <small>Nota destilada</small>
          <strong>Essência: públicos retrô respondem a nostalgia + novidade.</strong>
        </motion.div>
      )}
    </div>
  );
}

const reviewSteps = ["Esvaziar a caixa", "Olhar a agenda", "Revisar projetos", "Aguardando", "Backlog", "Áreas", "Escolher a semana"];
function Review({ at }: { at: number }) {
  return (
    <ol className={s.review}>
      {reviewSteps.map((step, i) => {
        const done = i < at;
        return (
          <motion.li key={step} data-done={done} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}>
            <motion.span className={s.check} animate={done ? { scale: [0.6, 1.2, 1] } : {}} transition={{ delay: 0.3 + i * 0.18 }}>{done ? "✓" : i + 1}</motion.span>
            {step}
          </motion.li>
        );
      })}
    </ol>
  );
}

const pile = ["Gravar teaser", "Responder edital", "Revisar orçamento", "Atualizar setlist", "Fechar parceria", "Postar agenda", "Comprar cabos", "Ligar pro contador"];
function Today({ at }: { at: number }) {
  return (
    <div className={s.today}>
      {pile.map((t, i) => {
        const top = i < 3;
        const hidden = at >= 1 && !top;
        const focused = at >= 2 && i === 0;
        return (
          <motion.div key={t} className={s.todayItem} data-top={top && at >= 1} data-focus={focused} layout
            animate={{ opacity: hidden ? 0 : focused || at < 2 ? 1 : 0.35, height: hidden ? 0 : "auto", scale: focused ? 1.08 : 1 }} transition={{ duration: 0.45, delay: hidden ? i * 0.05 : 0 }}>
            {t}
            {focused && <motion.span className={s.timer} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>⏱ 25:00</motion.span>}
          </motion.div>
        );
      })}
    </div>
  );
}

function Pact({ at }: { at: number }) {
  return (
    <div className={s.pact}>
      <motion.div className={s.proposal} {...pop}>
        <small>Proposta · Órion</small>
        <strong>Registrar treino de 40 min</strong>
        <span>muda: Corpo &gt; registros · cria tarefa “alongar”</span>
        {at >= 2 && <motion.b className={s.stamp} initial={{ opacity: 0, scale: 2.4, rotate: -24 }} animate={{ opacity: 1, scale: 1, rotate: -12 }} transition={{ type: "spring", stiffness: 400, damping: 14 }}>APROVADO</motion.b>}
      </motion.div>
      {at >= 1 && at < 2 && <motion.p className={s.pactWait} initial={{ opacity: 0 }} animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.6, repeat: Infinity }}>aguardando sua aprovação…</motion.p>}
      {at >= 3 && (
        <motion.div className={s.receipt} initial={{ opacity: 0, y: -10, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }}>
          <small>Recibo</small>
          <span>aplicado · revisão 2 · aprovado por Jonny</span>
        </motion.div>
      )}
    </div>
  );
}

export function StageProp({ kind, at }: { kind: PropKind; at: number }) {
  const props = { at };
  return (
    <div className={s.stageProp} aria-hidden="true">
      {kind === "crew" && <Crew {...props} />}
      {kind === "cycle" && <Cycle {...props} />}
      {kind === "capture" && <Capture {...props} />}
      {kind === "clarify" && <Clarify {...props} />}
      {kind === "keys" && <Keys />}
      {kind === "project" && <Project {...props} />}
      {kind === "areas" && <Areas {...props} />}
      {kind === "review" && <Review {...props} />}
      {kind === "today" && <Today {...props} />}
      {kind === "pact" && <Pact {...props} />}
    </div>
  );
}

"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { catalogSchema, emptyOffice, type AgentId } from "@/lib/office/schema";
import localCatalog from "@/lib/office/catalog.json";
import { projectOffice, stateLabels, type OfficeView } from "@/lib/office/view";
import { AgentSheet, colors } from "./agent-sheet";
import styles from "./office.module.css";
import { crew } from "./orbital-model";
const Scene = dynamic(() => import("./scene"), {
  ssr: false,
  loading: () => (
    <div className={styles.sceneLoading}>Preparando o escritório…</div>
  ),
});
const reference = catalogSchema.parse(localCatalog);
class SceneBoundary extends Component<
  { children: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFailure();
  }
  render() {
    return this.state.failed ? (
      <p className={styles.sceneLoading}>
        Use a lista de agentes para continuar.
      </p>
    ) : (
      this.props.children
    );
  }
}
const terminal: Record<string, string> = {
  accepted: "Recebido",
  running: "Iniciado",
  completed: "Resposta enviada ao canal",
  undelivered: "Resposta não entregue",
  failed: "Falha na execução",
  interrupted: "Interrompido",
  rejected: "Não executado",
};
const agentNames = Object.fromEntries(
  reference.profiles.map((p) => [p.id, p.name]),
);
export default function Office() {
  const [view, setView] = useState<OfficeView>(() =>
    projectOffice(emptyOffice()),
  );
  const [selected, setSelected] = useState<AgentId>("hermes");
  const [scene, setScene] = useState(true);
  const [visible, setVisible] = useState(true);
  const [motion, setMotion] = useState(false);
  const [error, setError] = useState("");
  const [reset, setReset] = useState(0);
  const [meeting, setMeeting] = useState(false);
  const [paused, setPaused] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [greeting, setGreeting] = useState(0);
  const [focus, setFocus] = useState(0);
  const [tour, setTour] = useState(false);
  const [alternate, setAlternate] = useState(false);
  const [line, setLine] = useState("");
  const [inView, setInView] = useState(true);
  const canvasWrap = useRef<HTMLDivElement>(null);
  function selectAgent(id: AgentId) {
    setSelected(id);
    setFocus((v) => v + 1);
    setLine("");
    setTour(false);
  }
  function sceneFailure() {
    setScene(false);
    setExpanded(false);
  }
  useEffect(() => {
    const element = canvasWrap.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) =>
      setInView(entry.isIntersecting),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [scene, visible]);
  useEffect(() => {
    if (!expanded || !scene || !visible) return;
    const previous = document.body.style.overflow;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    document.body.style.overflow = "hidden";
    canvasWrap.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
      if (event.key === "Tab") {
        const buttons =
          canvasWrap.current?.querySelectorAll<HTMLButtonElement>("button");
        if (!buttons?.length) return;
        const first = buttons[0],
          last = buttons[buttons.length - 1];
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            !canvasWrap.current?.contains(document.activeElement))
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            !canvasWrap.current?.contains(document.activeElement))
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", close);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [expanded, scene, visible]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setMotion(!media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let busy = false;
    let controller: AbortController | null = null;
    async function poll() {
      if (stopped || busy || document.hidden) return;
      busy = true;
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 8000);
      try {
        const res = await fetch("/api/hermes/office", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok)
          throw new Error(
            res.status === 401
              ? "Faça login para acompanhar seus agentes."
              : "Não foi possível atualizar a atividade.",
          );
        const next = await res.json();
        if (!stopped) {
          setView(next);
          setError("");
        }
      } catch (e) {
        if (!stopped) {
          setError(
            e instanceof Error && e.name !== "AbortError"
              ? e.message
              : "Conexão temporariamente indisponível.",
          );
          setView((v) => ({
            ...v,
            fresh: false,
            agents: v.agents.map((a) => ({
              ...a,
              state: v.lastSeenAt ? "stale" : "unknown",
            })),
          }));
        }
      } finally {
        clearTimeout(timeout);
        busy = false;
        if (!stopped && !document.hidden) timer = setTimeout(poll, 5000);
      }
    }
    const visibility = () => {
      setVisible(!document.hidden);
      if (timer) clearTimeout(timer);
      if (document.hidden) controller?.abort();
      else void poll();
    };
    document.addEventListener("visibilitychange", visibility);
    visibility();
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  const catalog = view.catalog || reference;
  const profile =
    catalog.profiles.find((p) => p.id === selected) ||
    reference.profiles.find((p) => p.id === selected)!;
  const presence = view.agents.find((a) => a.id === selected)!;
  const working = view.agents.filter((a) => a.state === "working").length;
  const queued = view.agents.reduce((sum, a) => sum + a.queued, 0);
  return (
    <main className={styles.office}>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>LIFESYSTEM / SEU TIME PESSOAL</p>
          <h1>
            Um lugar para
            <br />
            <em>as coisas acontecerem.</em>
          </h1>
          <p>
            O escritório de Hermes e seus especialistas. Cada um com seu papel,
            suas fontes e seu próximo passo.
          </p>
        </div>
        <Link href="/hermes" className={styles.connectionLink}>
          Configuração do Hermes ↗
        </Link>
      </header>
      <div className={styles.toolbar}>
        <div className={styles.live}>
          <span className={view.fresh ? styles.dotLive : styles.dot} />
          <strong>
            {view.fresh
              ? "Conectado"
              : view.lastSeenAt
                ? "Conexão desatualizada"
                : "Aguardando conexão"}
          </strong>
          <small>
            {view.lastSeenAt
              ? `Último sinal ${new Date(view.lastSeenAt).toLocaleTimeString("pt-BR")}`
              : "A presença real aparecerá após conectar o Hermes."}
          </small>
        </div>
        <div className={styles.numbers}>
          <span>
            <b>{view.fresh ? working : "—"}</b> trabalhando
          </span>
          <span>
            <b>{view.fresh ? queued : "—"}</b> na fila
          </span>
        </div>
        <div className={styles.toggles}>
          <button aria-pressed={scene} onClick={() => setScene(true)}>
            Escritório 3D
          </button>
          <button aria-pressed={!scene} onClick={() => setScene(false)}>
            Lista
          </button>
        </div>
      </div>
      {error && (
        <p role="status" className={styles.notice}>
          {error}
          {error.startsWith("Faça login") && (
            <>
              {" "}
              <Link href="/login?from=/escritorio">Entrar</Link>
            </>
          )}
        </p>
      )}
      {view.gap && (
        <p role="status" className={styles.notice}>
          Parte do histórico não foi recebida. O estado atual vem do último
          retrato completo.
        </p>
      )}
      <div className={styles.layout}>
        <section className={styles.stage} aria-label="Escritório dos agentes">
          {scene && visible ? (
            <div
              ref={canvasWrap}
              role={expanded ? "dialog" : undefined}
              aria-modal={expanded ? true : undefined}
              aria-label={expanded ? "Estação Jonny ampliada" : undefined}
              className={`${styles.canvasWrap} ${expanded ? styles.expanded : ""}`}
            >
              <div className={styles.sceneCaption}>
                <span>HERMES / ORBITAL RESEARCH STATION</span>
                <strong>Estação Jonny</strong>
                <small>
                  SETOR {alternate ? "02 / ÓRBITA ÂMBAR" : "01 / ÓRBITA BOREAL"}{" "}
                  · 06 UNIDADES
                </small>
              </div>
              <div
                className={styles.sceneControls}
                aria-label="Controles da estação"
              >
                <button
                  onClick={() => {
                    setFocus(0);
                    setReset((v) => v + 1);
                    setTour(false);
                  }}
                >
                  Visão geral
                </button>
                <button
                  aria-pressed={tour}
                  onClick={() => {
                    setTour((v) => !v);
                    setFocus(0);
                  }}
                >
                  Passeio orbital
                </button>
                <button onClick={() => setPaused((v) => !v)}>
                  {paused ? "Retomar animações" : "Pausar animações"}
                </button>
                <button onClick={() => setExpanded((v) => !v)}>
                  {expanded ? "Sair da visão ampliada" : "Ampliar estação"}
                </button>
              </div>
              <SceneBoundary onFailure={sceneFailure}>
                <Scene
                  reset={reset}
                  agents={view.agents}
                  selected={selected}
                  onSelect={selectAgent}
                  animate={motion && visible && inView && !paused}
                  meeting={meeting}
                  greeting={greeting}
                  focus={focus}
                  tour={tour}
                  alternate={alternate}
                  onOrbit={() => setAlternate((v) => !v)}
                  onFailure={sceneFailure}
                />
              </SceneBoundary>
              <div className={styles.interactionDeck}>
                {expanded && (
                  <div
                    className={styles.expandedCrew}
                    aria-label="Tripulação da estação"
                  >
                    {crew.map((c) => (
                      <button
                        key={c.id}
                        aria-pressed={selected === c.id}
                        onClick={() => selectAgent(c.id)}
                        style={{
                          borderColor: selected === c.id ? c.accent : undefined,
                        }}
                      >
                        Focalizar {c.name}
                      </button>
                    ))}
                  </div>
                )}
                <div className={styles.comms} role="status">
                  <span>
                    {line ? "TRANSMISSÃO / PERSONALIDADE" : "EXPLORAÇÃO LIVRE"}
                  </span>
                  <p>
                    {line ||
                      "Selecione um robô para aproximar. Toque no holograma central para mudar a órbita."}
                  </p>
                </div>
                <div className={styles.crewControls}>
                  <button
                    aria-pressed={meeting}
                    onClick={() => {
                      setMeeting((v) => !v);
                      setFocus(0);
                      setLine("");
                    }}
                  >
                    {meeting ? "Voltar às estações" : "Reunir equipe"}
                  </button>
                  <button
                    onClick={() => {
                      setGreeting((v) => v + 1);
                      setLine(
                        `${profile.name}: ${crew.find((c) => c.id === selected)?.line}`,
                      );
                    }}
                  >
                    Cumprimentar {profile.name}
                  </button>
                  <button onClick={() => setAlternate((v) => !v)}>
                    Mudar órbita
                  </button>
                </div>
                <div className={styles.sceneFoot}>
                  <span>Animação de ambientação · não executa tarefas</span>
                  <span>Arraste para explorar · role para aproximar</span>
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.listIntro}>
              <p className={styles.eyebrow}>SEU ESCRITÓRIO</p>
              <h2>
                Conheça quem está
                <br />
                do seu lado.
              </h2>
              <p>
                Selecione uma pessoa do time para ver seu papel, suas
                habilidades e o que pode fazer.
              </p>
            </div>
          )}
          <div className={styles.roster} aria-label="Selecionar agente">
            {catalog.profiles.map((p) => {
              const a = view.agents.find((item) => item.id === p.id)!;
              return (
                <button
                  key={p.id}
                  aria-pressed={selected === p.id}
                  onClick={() => selectAgent(p.id)}
                >
                  <span
                    className={styles.miniAvatar}
                    style={{ background: colors[p.id] }}
                  >
                    {p.name[0]}
                  </span>
                  <span>
                    <strong>{p.name}</strong>
                    <small>{p.role}</small>
                    <em>{stateLabels[a.state]}</em>
                  </span>
                </button>
              );
            })}
          </div>
          <section className={styles.activity}>
            <div>
              <p className={styles.eyebrow}>MOVIMENTO DO ESCRITÓRIO</p>
              <h2>Últimas atividades</h2>
            </div>
            {view.history.length ? (
              <ol>
                {view.history.map((event, index) =>
                  "runId" in event.payload ? (
                    <li key={`${event.payload.runId}-${event.kind}-${index}`}>
                      <span
                        style={{ background: colors[event.payload.agentId] }}
                      />
                      <div>
                        <strong>
                          {agentNames[event.payload.agentId]} ·{" "}
                          {terminal[event.payload.status]}
                        </strong>
                        <small>
                          {event.payload.channel} ·{" "}
                          {new Date(event.receivedAt).toLocaleString("pt-BR")}
                        </small>
                      </div>
                    </li>
                  ) : null,
                )}
              </ol>
            ) : (
              <p className={styles.empty}>
                Ainda sem atividade recebida. Quando um especialista atender
                você pelo WhatsApp ou Telegram, o movimento aparecerá aqui.
              </p>
            )}
          </section>
        </section>
        <AgentSheet
          key={profile.id}
          profile={profile}
          presence={presence}
          asOf={view.asOf}
          current={view.catalogCurrent && catalog.provenance === "deployed"}
        />
      </div>
      <footer className={styles.footer}>
        Atividade observada, sem chamadas extras ao modelo.{" "}
        <span>As conversas continuam no WhatsApp e Telegram.</span>
      </footer>
    </main>
  );
}

"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { catalogSchema, emptyOffice, type AgentId } from "@/lib/office/schema";
import localCatalog from "@/lib/office/catalog.json";
import { projectOffice, stateLabels, type OfficeView } from "@/lib/office/view";
import { AgentSheet, colors } from "./agent-sheet";
import { AgentChat } from "./agent-chat";
import styles from "./office.module.css";
import { crew } from "./orbital-model";
import { destinations, useFlightData, type Destination } from "./stellar-data";
import { DestinationPanel, StarDirectory } from "./stellar-panel";
import stellar from "./stellar.module.css";
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
  const [mapMode, setMapMode] = useState(true);
  const [stationView, setStationView] = useState(false);
  const [agentPanel, setAgentPanel] = useState(false);
  const [destinationId, setDestinationId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // Every control answers with a short, polite announcement (visible + aria-live).
  const [notice, setNotice] = useState("");
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function announce(text: string) {
    setNotice(text);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 3500);
  }
  useEffect(() => () => clearTimeout(noticeTimer.current), []);
  const flight = useFlightData(true);
  const allDestinations = useMemo(
    () => destinations(flight.data),
    [flight.data],
  );
  const matchingDestinations = useMemo(
    () =>
      allDestinations.filter((n) =>
        `${n.name} ${n.description}`
          .toLocaleLowerCase("pt-BR")
          .includes(query.toLocaleLowerCase("pt-BR")),
      ),
    [allDestinations, query],
  );
  const mappedDestinations = useMemo(() => {
    return (["project", "pillar", "tool"] as const).flatMap((kind, ring) => {
      const matches = matchingDestinations.filter((n) => n.kind === kind);
      const shown = matches.slice(0, kind === "project" ? 12 : 8);
      const chosen = allDestinations.find(
        (n) => n.id === destinationId && n.kind === kind,
      );
      if (chosen && !shown.some((n) => n.id === chosen.id)) shown.push(chosen);
      return shown.map((n, i) => {
        const a = (i / Math.max(shown.length, 1)) * Math.PI * 2 + ring * 0.7;
        const r = [18, 28, 38][ring];
        return {
          ...n,
          position: [Math.cos(a) * r, Math.sin(i * 2.4), Math.sin(a) * r] as [
            number,
            number,
            number,
          ],
        };
      });
    });
  }, [matchingDestinations, allDestinations, destinationId]);
  const destination = allDestinations.find((n) => n.id === destinationId);
  const canvasWrap = useRef<HTMLDivElement>(null);
  function selectDestination(node: Destination) {
    setDestinationId(node.id);
    setAgentPanel(false);
    setStationView(false);
    setFocus(0);
    setTour(false);
  }
  function closeDestination() {
    setDestinationId(null);
    const label = `Explorar ${destination?.name}`;
    Array.from(
      canvasWrap.current?.querySelectorAll<HTMLButtonElement>("button") || [],
    )
      .find((button) => button.getAttribute("aria-label") === label)
      ?.focus();
  }
  const selectAgentRef = useRef<(id: AgentId) => void>(() => {});
  function selectAgent(id: AgentId) {
    announce(`${agentNames[id] || id} em foco. Converse pelo painel de comando.`);
    setMapMode(scene);
    setAgentPanel(true);
    setStationView(true);
    setDestinationId(null);
    setSelected(id);
    setFocus((v) => v + 1);
    setLine("");
    setTour(false);
  }
  useEffect(() => {
    selectAgentRef.current = selectAgent;
  });
  // Keys 1–6 focus a crew member, like picking a unit in a game; typing is never hijacked.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      const index = Number(event.key) - 1;
      if (Number.isInteger(index) && index >= 0 && index < crew.length) {
        event.preventDefault();
        selectAgentRef.current(crew[index].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
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
    if (!expanded || (!scene && !mapMode)) return;
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
        const buttons = canvasWrap.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex="0"]',
        );
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
  }, [expanded, scene, mapMode]);
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
          <p className={styles.eyebrow}>LIFESYSTEM / CENTRO DE OPERAÇÕES</p>
          <h1>
            Um lugar para
            <br />
            <em>as coisas acontecerem.</em>
          </h1>
          <p>
            Seu universo em movimento. Explore projetos, cuide dos seus pilares
            e encontre o próximo destino com sua tripulação.
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
          <button
            aria-pressed={scene && stationView}
            onClick={() => {
              setScene(true);
              setMapMode(true);
              setStationView(true);
              setDestinationId(null);
              setAgentPanel(false);
              setFocus(0);
              setTour(false);
              setReset((v) => v + 1);
            }}
          >
            Tripulação
          </button>
          <button
            aria-pressed={scene && !stationView}
            onClick={() => {
              setScene(true);
              setMapMode(true);
              setStationView(false);
              setDestinationId(null);
              setAgentPanel(false);
              setFocus(0);
              setTour(false);
              setReset((v) => v + 1);
            }}
          >
            Explorar universo
          </button>
          <button
            aria-pressed={!scene && !mapMode}
            onClick={() => {
              setScene(false);
              setMapMode(false);
              setExpanded(false);
            }}
          >
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
      <div className={`${styles.layout} ${mapMode ? stellar.mapLayout : ""}`}>
        <section className={styles.stage} aria-label="Escritório dos agentes">
          {scene || mapMode ? (
            <div
              ref={canvasWrap}
              role={expanded ? "dialog" : undefined}
              aria-modal={expanded ? true : undefined}
              aria-label={expanded ? "Estação Jonny ampliada" : undefined}
              className={`${styles.canvasWrap} ${mapMode ? stellar.mapStage : ""} ${expanded ? styles.expanded : ""} ${expanded && mapMode ? stellar.mapExpanded : ""}`}
            >
              <div className={styles.sceneCaption}>
                <span>HERMES / ORBITAL RESEARCH STATION</span>
                <strong>Estação Jonny</strong>
                <small>
                  {mapMode
                    ? "UM UNIVERSO · SUA TRIPULAÇÃO · PRÓXIMOS AVANÇOS"
                    : `SETOR ${alternate ? "02 / ÓRBITA ÂMBAR" : "01 / ÓRBITA BOREAL"} · 06 UNIDADES`}
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
                    setDestinationId(null);
                    setAgentPanel(false);
                    announce(
                      stationView
                        ? "Câmera de volta à visão geral da estação."
                        : "Câmera de volta à visão geral do universo.",
                    );
                  }}
                >
                  Visão geral
                </button>
                <button
                  aria-pressed={tour}
                  onClick={() => {
                    if (!tour && !(motion && !paused)) {
                      announce(
                        paused
                          ? "Retome as animações para iniciar o passeio orbital."
                          : "Passeio indisponível: seu sistema pede menos movimento.",
                      );
                      return;
                    }
                    setTour((v) => !v);
                    setFocus(0);
                    setDestinationId(null);
                    setAgentPanel(false);
                    setReset((v) => v + 1);
                    announce(
                      tour
                        ? "Passeio orbital encerrado."
                        : "Passeio orbital iniciado. Arraste a cena para assumir o controle.",
                    );
                  }}
                >
                  {tour ? "Parar passeio" : "Passeio orbital"}
                </button>
                <button
                  onClick={() => {
                    setPaused((v) => !v);
                    if (!paused) setTour(false);
                    announce(paused ? "Animações retomadas." : "Animações pausadas.");
                  }}
                >
                  {paused ? "Retomar animações" : "Pausar animações"}
                </button>
                <button onClick={() => setExpanded((v) => !v)}>
                  {expanded ? "Sair da visão ampliada" : "Ampliar estação"}
                </button>
              </div>
              <p
                className={`${stellar.notice} ${notice ? stellar.noticeOn : ""}`}
                role="status"
                aria-live="polite"
              >
                {notice}
              </p>
              {tour && (
                <p className={stellar.tourBadge} aria-hidden="true">
                  ● PASSEIO ORBITAL
                </p>
              )}
              <div className={stellar.viewport}>
                {scene ? (
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
                      onOrbit={() => {
                        setStationView(false);
                        setFocus(0);
                        setAgentPanel(false);
                        setDestinationId(null);
                        setReset((v) => v + 1);
                      }}
                      onFailure={sceneFailure}
                      mapMode={!stationView}
                      destinations={mappedDestinations}
                      selectedDestination={destinationId}
                      onSelectDestination={selectDestination}
                    />
                  </SceneBoundary>
                ) : (
                  <p className={styles.sceneLoading}>
                    Continue explorando pelos destinos e painéis abaixo.
                  </p>
                )}
              </div>
              {mapMode && (
                <nav
                  className={stellar.crewDock}
                  aria-label="Tripulação da estação"
                >
                  {crew.map((c) => {
                    const live = view.agents.find((a) => a.id === c.id)!;
                    return (
                      <button
                        key={c.id}
                        aria-label={`Focalizar ${c.name}`}
                        aria-pressed={agentPanel && selected === c.id}
                        onClick={() => selectAgent(c.id)}
                        style={
                          { "--crew-accent": c.accent } as React.CSSProperties
                        }
                      >
                        <span>{c.name[0]}</span>
                        <strong>{c.name}</strong>
                        <small>{stateLabels[live.state]}</small>
                      </button>
                    );
                  })}
                  <button
                    aria-pressed={meeting}
                    onClick={() => {
                      setMeeting((v) => !v);
                      setStationView(true);
                      setFocus(0);
                      setDestinationId(null);
                      setAgentPanel(false);
                      announce(
                        meeting
                          ? "Tripulação de volta aos postos."
                          : "Tripulação reunida no centro da estação.",
                      );
                    }}
                  >
                    <span>◎</span>
                    <strong>{meeting ? "Aos postos" : "Reunir equipe"}</strong>
                    <small>Animação de ambiente</small>
                  </button>
                </nav>
              )}
              {mapMode && agentPanel && !destination && (
                <section
                  className={stellar.agentInspector}
                  aria-label={`Comando de ${profile.name}`}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.stopPropagation();
                      setAgentPanel(false);
                      canvasWrap.current
                        ?.querySelector<HTMLButtonElement>(
                          `button[aria-label="Focalizar ${profile.name}"]`,
                        )
                        ?.focus();
                    }
                  }}
                >
                  <button
                    className={stellar.closeAgent}
                    aria-label="Fechar ficha do agente"
                    onClick={() => setAgentPanel(false)}
                  >
                    Fechar ×
                  </button>
                  <nav
                    className={stellar.agentDestinations}
                    aria-label={`Área de trabalho de ${profile.name}`}
                  >
                    <small>ABRIR ÁREA DE TRABALHO</small>
                    {allDestinations
                      .filter((node) => {
                        if (selected === "sirius")
                          return node.kind === "project";
                        if (selected === "vega")
                          return node.entityId === "finance";
                        if (selected === "cosmo")
                          return node.entityId === "content";
                        if (selected === "orion")
                          return (
                            node.kind === "pillar" &&
                            /corpo|físic|saúde/i.test(node.name)
                          );
                        if (selected === "astro")
                          return (
                            node.kind === "pillar" &&
                            /mente|conhecimento/i.test(node.name)
                          );
                        return node.kind === "tool";
                      })
                      .map((node) => (
                        <button
                          key={node.id}
                          onClick={() => selectDestination(node)}
                        >
                          {node.name} ↗
                        </button>
                      ))}
                  </nav>
                  <AgentChat
                    key={"chat-" + profile.id}
                    agentId={profile.id}
                    name={profile.name}
                  />
                  <AgentSheet
                    key={profile.id}
                    profile={profile}
                    presence={presence}
                    asOf={view.asOf}
                    current={
                      view.catalogCurrent && catalog.provenance === "deployed"
                    }
                  />
                </section>
              )}
              {mapMode ? (
                <>
                  <StarDirectory
                    nodes={matchingDestinations}
                    query={query}
                    setQuery={setQuery}
                    selected={destinationId}
                    onSelect={selectDestination}
                    loading={flight.loading}
                    error={flight.error}
                    refresh={flight.refresh}
                  />
                  {destination && (
                    <DestinationPanel
                      key={destination.id}
                      node={destination}
                      data={flight.data}
                      available={!flight.loading && !flight.error}
                      onClose={closeDestination}
                      acceptTask={flight.acceptTask}
                      refresh={flight.refresh}
                    />
                  )}
                  <div className={stellar.coordinates}>
                    <span>
                      <strong>
                        UNIVERSO / {mappedDestinations.length} DESTINOS VISÍVEIS
                      </strong>{" "}
                      · {allDestinations.length} destinos no índice
                    </span>
                    <span>
                      Selecione um destino · teclas 1–6 escolhem a tripulação ·
                      arraste para orbitar · role para aproximar
                    </span>
                  </div>
                </>
              ) : (
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
                            borderColor:
                              selected === c.id ? c.accent : undefined,
                          }}
                        >
                          Focalizar {c.name}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className={styles.comms} role="status">
                    <span>
                      {line
                        ? "TRANSMISSÃO / PERSONALIDADE"
                        : "EXPLORAÇÃO LIVRE"}
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
                    <button
                      onClick={() => {
                        setAlternate((v) => !v);
                        announce(
                          alternate
                            ? "Órbita boreal ativada."
                            : "Órbita âmbar ativada.",
                        );
                      }}
                    >
                      Mudar órbita
                    </button>
                  </div>
                  <div className={styles.sceneFoot}>
                    <span>Animação de ambientação · não executa tarefas</span>
                    <span>Arraste para explorar · role para aproximar</span>
                  </div>
                </div>
              )}
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
                você no escritório, WhatsApp ou Telegram, o movimento aparecerá
                aqui.
              </p>
            )}
          </section>
        </section>
        {!mapMode && (
          <div>
            <AgentChat
              key={"chat-list-" + profile.id}
              agentId={profile.id}
              name={profile.name}
            />
            <AgentSheet
              key={profile.id}
              profile={profile}
              presence={presence}
              asOf={view.asOf}
              current={view.catalogCurrent && catalog.provenance === "deployed"}
            />
          </div>
        )}
      </div>
      <footer className={styles.footer}>
        Sinais de atividade sem chamadas extras ao modelo.{" "}
        <span>Converse aqui ou continue pelo WhatsApp e Telegram.</span>
      </footer>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Compass,
  Globe2,
  Orbit,
  Radio,
  Search,
  X,
} from "lucide-react";
import type { Task } from "@/types";
import type { Destination, FlightData } from "./stellar-data";
import s from "./stellar.module.css";

export const kindNames = {
  project: "Planeta · projeto",
  pillar: "Constelação · pilar",
  tool: "Satélite · ferramenta",
};
const symbols = { project: Globe2, pillar: Orbit, tool: Radio };

export function StarDirectory({
  nodes,
  query,
  setQuery,
  selected,
  onSelect,
  loading,
  error,
  refresh,
}: {
  nodes: Destination[];
  query: string;
  setQuery: (q: string) => void;
  selected: string | null;
  onSelect: (node: Destination) => void;
  loading: boolean;
  error: string;
  refresh: () => void;
}) {
  const [kind, setKind] = useState("all");
  const filtered = nodes.filter((n) => kind === "all" || n.kind === kind);
  // Shows when the last manual refresh finished, so the button visibly answers.
  const [requested, setRequested] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState("");
  const [wasLoading, setWasLoading] = useState(loading);
  if (loading !== wasLoading) {
    setWasLoading(loading);
    if (!loading && requested) {
      setRequested(false);
      setRefreshedAt(
        error
          ? ""
          : new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      );
    }
  }
  const empty = query
    ? "Nenhum destino para esta busca."
    : ({ project: "Nenhum projeto no seu universo ainda.", pillar: "Nenhum pilar cadastrado ainda.", tool: "Nenhuma ferramenta disponível." } as Record<string, string>)[kind] || "Nenhum destino ainda.";
  return (
    <nav className={s.directory} aria-label="Destinos estelares">
      <div className={s.directoryTitle}>
        <Compass size={16} />
        <strong>Coordenadas</strong>
        <span>{nodes.length.toString().padStart(2, "0")}</span>
      </div>
      <label className={s.search}>
        <Search size={14} />
        <input
          aria-label="Buscar destino"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar no seu universo…"
        />
      </label>
      <div className={s.filters} aria-label="Filtrar destinos">
        {[
          ["all", "Todos"],
          ["project", "Projetos"],
          ["pillar", "Pilares"],
          ["tool", "Ferramentas"],
        ].map(([id, label]) => (
          <button
            key={id}
            aria-pressed={kind === id}
            onClick={() => setKind(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {loading && (
        <p className={s.message} role="status">
          Recebendo coordenadas…
        </p>
      )}
      {error && (
        <div className={s.error} role="alert">
          {error}
          <button onClick={refresh}>Tentar novamente</button>
        </div>
      )}
      {!loading && !error && (
        <div className={s.destinations}>
          {filtered.length ? (
            filtered.map((n) => {
              const Icon = symbols[n.kind];
              return (
                <button
                  key={n.id}
                  aria-label={`Explorar ${n.name}`}
                  aria-pressed={selected === n.id}
                  onClick={() => onSelect(n)}
                >
                  <Icon size={16} style={{ color: n.color }} />
                  <span>
                    <strong>{n.name}</strong>
                    <small>{kindNames[n.kind]}</small>
                  </span>
                  <ChevronRight size={12} />
                </button>
              );
            })
          ) : (
            <p className={s.message} role="status">{empty}</p>
          )}
        </div>
      )}
      <button
        className={s.refresh}
        disabled={loading}
        onClick={() => {
          setRequested(true);
          setRefreshedAt("");
          refresh();
        }}
      >
        {loading && requested ? "Atualizando…" : "Atualizar dados"} <span>↻</span>
      </button>
      {refreshedAt && (
        <p className={s.refreshed} role="status">
          Dados atualizados às {refreshedAt}
        </p>
      )}
    </nav>
  );
}

export function DestinationPanel({
  node,
  data,
  onClose,
  acceptTask,
  available,
  refresh,
}: {
  node: Destination;
  data: FlightData;
  onClose: () => void;
  acceptTask: (task: Task) => void;
  available: boolean;
  refresh: () => void;
}) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);
  const project = data.projects.find(
    (p) => node.kind === "project" && p.id === node.entityId,
  );
  const pillar = data.pillars.find(
    (p) => node.kind === "pillar" && p.id === node.entityId,
  );
  const tasks = data.tasks.filter((t) =>
    node.kind === "project"
      ? t.projectId === node.entityId
      : node.kind === "pillar" && t.pillarId === node.entityId,
  );
  const complete = tasks.filter(
    (t) => data.stages.find((st) => st.id === t.status)?.isTerminal,
  ).length;
  const initialStage = data.stages.find((st) => !st.isTerminal)?.id;
  async function write(url: string, method: string, body: object) {
    if (lock.current || !available) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    const controller = new AbortController(),
      timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const result = await r.json();
      if (!r.ok)
        throw new Error(
          result.error || "Não foi possível salvar esta alteração.",
        );
      if (!result.id || !result.title)
        throw new Error("O servidor não confirmou o registro.");
      acceptTask(result);
      setNotice(
        method === "POST"
          ? "Tarefa criada no LifeSystem."
          : "Etapa atualizada no LifeSystem.",
      );
      if (method === "POST") setTitle("");
    } catch (e) {
      setError(
        e instanceof Error &&
          e.name !== "AbortError" &&
          e.name !== "TypeError" &&
          e.name !== "SyntaxError"
          ? e.message
          : "A confirmação não chegou. Atualize os dados e confira a tarefa antes de tentar novamente.",
      );
    } finally {
      clearTimeout(timeout);
      lock.current = false;
      setBusy(false);
    }
  }
  function create(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !initialStage) return;
    void write("/api/tasks", "POST", {
      title: title.trim(),
      status: initialStage,
      priority: "normal",
      [node.kind === "project" ? "projectId" : "pillarId"]: node.entityId,
    });
  }
  const Icon = symbols[node.kind];
  return (
    <section
      className={s.inspector}
      role="region"
      aria-label={`Painel de ${node.name}`}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className={s.panelHead}>
        <span>
          <Icon size={14} />
          {kindNames[node.kind]}
        </span>
        <button onClick={onClose} aria-label="Fechar painel">
          <X size={17} />
        </button>
      </div>
      <div
        className={s.planetEmblem}
        style={{ "--planet": node.color } as React.CSSProperties}
      >
        <span />
        <i />
      </div>
      <h2 ref={heading} tabIndex={-1}>
        {node.name}
      </h2>
      <p className={s.description}>{node.description}</p>
      {node.kind !== "tool" && (
        <>
          <div className={s.progress}>
            <span>
              <strong>{complete}</strong> / {tasks.length} tarefas concluídas
            </span>
            <div>
              <i
                style={{
                  width: `${tasks.length ? (complete / tasks.length) * 100 : 0}%`,
                  background: node.color,
                }}
              />
            </div>
          </div>
          {project?.needs && project.needs !== node.description && (
            <div className={s.context}>
              <small>O QUE PRECISA AVANÇAR</small>
              <p>{project.needs}</p>
            </div>
          )}
          {pillar?.target && (
            <div className={s.context}>
              <small>SEU NORTE</small>
              <p>{pillar.target}</p>
              {pillar.currentStatus && <p>{pillar.currentStatus}</p>}
            </div>
          )}
          <div className={s.taskHeading}>
            <h3>Plano de voo</h3>
            <span>{tasks.length}</span>
          </div>
          {tasks.length ? (
            <ul className={s.tasks}>
              {tasks.map((t) => (
                <li key={t.id}>
                  <div>
                    <span
                      className={s.taskDot}
                      style={{
                        background: data.stages.find((st) => st.id === t.status)
                          ?.isTerminal
                          ? "#add4b0"
                          : node.color,
                      }}
                    />
                    <strong>{t.title}</strong>
                  </div>
                  {t.dueDate && (
                    <small>
                      Prazo: {t.dueDate.split("-").reverse().join("/")}
                    </small>
                  )}
                  <select
                    aria-label={`Etapa de ${t.title}`}
                    disabled={busy || !available}
                    value={t.status}
                    onChange={(e) =>
                      void write(
                        `/api/tasks/${encodeURIComponent(t.id)}`,
                        "PATCH",
                        { status: e.target.value },
                      )
                    }
                  >
                    {!data.stages.some((st) => st.id === t.status) && (
                      <option value={t.status}>{t.status}</option>
                    )}
                    {data.stages.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.label}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          ) : (
            <p className={s.message}>O próximo passo pode começar aqui.</p>
          )}
          <form className={s.taskForm} onSubmit={create}>
            <label htmlFor="flight-task-title">Nova tarefa</label>
            <input
              id="flight-task-title"
              value={title}
              maxLength={300}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Qual é o próximo avanço?"
              disabled={busy || !available}
            />
            <button
              disabled={busy || !available || !title.trim() || !initialStage}
              type="submit"
            >
              {busy ? "Salvando…" : "Criar tarefa"}
              <span aria-hidden="true">＋</span>
            </button>
          </form>
        </>
      )}
      {notice && (
        <p className={s.success} role="status">
          <Check size={14} />
          {notice}
        </p>
      )}
      {error && (
        <div className={s.error} role="alert">
          {error}
          <button disabled={busy} onClick={refresh}>
            Conferir dados salvos
          </button>
        </div>
      )}
      {node.kind === "tool" && (
        <div className={s.context}>
          <small>CONEXÃO DE NAVEGAÇÃO</small>
          <p>
            {node.external
              ? "Abre seu CRM em outra aba, preservando esta estação."
              : "Continue no módulo completo para usar todas as ferramentas."}
          </p>
        </div>
      )}
      <Link
        className={s.moduleLink}
        href={node.href}
        target={node.external ? "_blank" : undefined}
        rel={node.external ? "noopener noreferrer" : undefined}
      >
        {node.kind === "project"
          ? "Abrir Projetos"
          : node.kind === "pillar"
            ? "Abrir Pilares"
            : `Abrir ${node.name}`}
        <ArrowUpRight size={15} />
      </Link>
    </section>
  );
}

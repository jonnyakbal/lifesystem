"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Pillar, Project, StageConfig, Task } from "@/types";

export type Destination = {
  id: string;
  entityId: string;
  kind: "project" | "pillar" | "tool";
  name: string;
  description: string;
  color: string;
  position: [number, number, number];
  href: string;
  external?: boolean;
};
export type FlightData = {
  projects: Project[];
  pillars: Pillar[];
  tasks: Task[];
  stages: StageConfig["stages"];
};
const palette = [
  "#80c9d5",
  "#d6ad74",
  "#b7bbec",
  "#b5d2a4",
  "#e3a590",
  "#a5c8ee",
];
const tools = [
  {
    id: "calendar",
    name: "Agenda",
    description:
      "Sua semana e seus blocos de foco, integrados ao Google Agenda.",
    href: "/planejar",
    color: "#a5c8ee",
  },
  {
    id: "content",
    name: "Central de conteúdo",
    description:
      "Pautas, rascunhos e revisão de Arco Labs, ArcoPass e Ateliê Studio.",
    href: "/conteudo",
    color: "#e3a590",
  },
  {
    id: "finance",
    name: "Financeiro",
    description: "Contas, compromissos e planejamento financeiro pessoal.",
    href: "/financeiro",
    color: "#d6ad74",
  },
  {
    id: "crm",
    name: "Arco Leads",
    description:
      "Sua base comercial: clientes, oportunidades e próximos contatos no CRM.",
    href: "https://arco.oj0nny.com/",
    color: "#80c9d5",
    external: true,
  },
  {
    id: "inbox",
    name: "Capturas",
    description: "Guarde uma ideia agora e organize depois.",
    href: "/inbox",
    color: "#b7bbec",
  },
  {
    id: "hermes",
    name: "Hermes",
    description:
      "Estado da conexão, registros e integrações do seu agente pessoal.",
    href: "/hermes",
    color: "#b5d2a4",
  },
];

// Stable positions follow the saved IDs, so changing task progress does not move a planet.
function position(
  index: number,
  count: number,
  radius: number,
  offset: number,
): [number, number, number] {
  const a = offset + (index / Math.max(count, 1)) * Math.PI * 2;
  return [
    Math.cos(a) * radius,
    Math.sin(index * 2.4) * 1.2,
    Math.sin(a) * radius,
  ];
}
export function destinations(data: FlightData): Destination[] {
  return [
    ...[...data.projects]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((p, i, all) => ({
        id: `project:${p.id}`,
        entityId: p.id,
        kind: "project" as const,
        name: p.name,
        description:
          p.description || p.needs || "Escolha o próximo passo deste projeto.",
        color: palette[i % palette.length],
        position: position(i, all.length, 12, 0.4),
        href: "/projetos",
      })),
    ...[...data.pillars]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((p, i, all) => ({
        id: `pillar:${p.id}`,
        entityId: p.id,
        kind: "pillar" as const,
        name: p.name,
        description:
          p.description || "Um setor da sua vida para acompanhar com cuidado.",
        color: /^#[0-9a-f]{6}$/i.test(p.color)
          ? p.color
          : palette[(i + 3) % palette.length],
        position: position(i, all.length, 21, -0.6),
        href: "/pilares",
      })),
    ...tools.map((t, i, all) => ({
      ...t,
      id: `tool:${t.id}`,
      entityId: t.id,
      kind: "tool" as const,
      position: position(i, all.length, 29, 0.1),
    })),
  ];
}
async function get<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, cache: "no-store" });
  if (!response.ok)
    throw new Error(
      response.status === 401
        ? "Sua sessão expirou. Entre novamente no LifeSystem."
        : "Não foi possível carregar o mapa. Seus dados continuam no LifeSystem.",
    );
  return response.json();
}
export function useFlightData(enabled: boolean) {
  const [data, setData] = useState<FlightData>({
    projects: [],
    pillars: [],
    tasks: [],
    stages: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const mutations = useRef<{
    version: number;
    tasks: Map<string, { version: number; task: Task }>;
  }>({ version: 0, tasks: new Map() });
  const refresh = useCallback(() => setRevision((v) => v + 1), []);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let stopped = false;
    const timeout = setTimeout(() => controller.abort(), 15000);
    const readVersion = mutations.current.version;
    // Set these asynchronously to keep mount/effect behavior consistent in Strict Mode.
    Promise.resolve().then(async () => {
      if (stopped) return;
      setLoading(true);
      setError("");
      try {
        const [projects, pillars, tasks, stages] = await Promise.all([
          get<Project[]>("/api/projects", controller.signal),
          get<Pillar[]>("/api/pillars", controller.signal),
          get<Task[]>("/api/tasks", controller.signal),
          get<StageConfig>("/api/stage-configs/tasks", controller.signal),
        ]);
        if (
          !Array.isArray(projects) ||
          !Array.isArray(pillars) ||
          !Array.isArray(tasks) ||
          !Array.isArray(stages.stages)
        )
          throw new Error("O mapa recebeu dados incompletos. Tente atualizar.");
        if (!stopped) {
          // A refresh started before a confirmed write must not erase that receipt.
          const newer = [...mutations.current.tasks.values()]
            .filter((m) => m.version > readVersion)
            .map((m) => m.task);
          const newerIds = new Set(newer.map((t) => t.id));
          setData({
            projects,
            pillars,
            tasks: [...tasks.filter((t) => !newerIds.has(t.id)), ...newer],
            stages: stages.stages,
          });
        }
      } catch (e) {
        if (!stopped)
          setError(
            e instanceof Error && e.name !== "AbortError"
              ? e.message
              : "Não foi possível carregar o mapa. A conexão demorou mais que o esperado.",
          );
      } finally {
        clearTimeout(timeout);
        if (!stopped) setLoading(false);
      }
    });
    return () => {
      stopped = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [enabled, revision]);
  const acceptTask = (task: Task) => {
    mutations.current.version += 1;
    mutations.current.tasks.set(task.id, {
      version: mutations.current.version,
      task,
    });
    setData((old) => ({
      ...old,
      tasks: [...old.tasks.filter((t) => t.id !== task.id), task],
    }));
  };
  return { data, loading, error, refresh, acceptTask };
}

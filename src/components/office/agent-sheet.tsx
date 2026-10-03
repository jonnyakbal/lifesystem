"use client";
import { useEffect, useState } from "react";
import type { AgentEvidence } from "@/lib/office/capabilities";
import type { Profile } from "@/lib/office/schema";
import {
  catalogStateLabels,
  stateLabels,
  type AgentPresence,
  type CatalogState,
} from "@/lib/office/view";
import styles from "./office.module.css";
export const colors: Record<string, string> = {
  hermes: "#e2d5bd",
  vega: "#d8ac64",
  sirius: "#8dbdcd",
  orion: "#99b99a",
  astro: "#b5a0cd",
  cosmo: "#df967b",
};
const availability = {
  verified: "Verificada",
  configured: "Configurada · falta validar",
  pending: "Integração pendente",
  unavailable: "Indisponível",
};
const kind = {
  instruction: "Instruções",
  skill: "Skill",
  briefing: "Briefing",
  connector: "Conector",
  memory: "Preferências",
};
export function AgentSheet({
  profile,
  presence,
  catalog,
  asOf,
}: {
  profile: Profile;
  presence: AgentPresence;
  catalog: { state: CatalogState; revision: string | null; receivedAt: string | null };
  asOf: number;
}) {
  const current = catalog.state === "received";
  const proven = profile.id === "orion" || profile.id === "sirius";
  const [evidence, setEvidence] = useState<AgentEvidence | null | "error">(null);
  useEffect(() => {
    if (!proven) return;
    let stop = false;
    fetch("/api/hermes/office/capabilities", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("indisponível"))))
      .then((data) => !stop && setEvidence(data[profile.id] as AgentEvidence))
      .catch(() => !stop && setEvidence("error"));
    return () => {
      stop = true;
    };
  }, [profile.id, proven]);
  const [copied, setCopied] = useState("");
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
    } catch {
      setCopied("error");
    }
  }
  return (
    <aside className={styles.sheet} aria-label={`Ficha de ${profile.name}`}>
      <div className={styles.profileTop}>
        <span
          className={styles.avatar}
          style={{ background: colors[profile.id] }}
          aria-hidden="true"
        >
          {profile.name[0]}
        </span>
        <div>
          <p className={styles.eyebrow}>{profile.role}</p>
          <h2>{profile.name}</h2>
        </div>
        <span className={styles.status}>{stateLabels[presence.state]}</span>
      </div>
      <p className={styles.summary}>{profile.summary}</p>
      <p className={styles.provenance} data-state={catalog.state}>
        {catalogStateLabels[catalog.state]}
        {catalog.revision && catalog.state !== "local" && (
          <>
            {" "}
            Revisão {catalog.revision}
            {catalog.receivedAt &&
              ` · recebida em ${new Date(catalog.receivedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`}
            .
          </>
        )}
      </p>
      {proven && (
        <section className={styles.proof} aria-label={`O que foi comprovado sobre ${profile.name}`}>
          <h3>O que foi comprovado</h3>
          {evidence === null && <p>Carregando evidências…</p>}
          {evidence === "error" && <p>Evidências indisponíveis agora; isso não significa ausência.</p>}
          {evidence && evidence !== "error" && (
            <ul>
              <li data-ok={evidence.credentials.length > 0}>
                <strong>Credencial dedicada</strong>
                {evidence.credentials.length
                  ? `${evidence.credentials.map((c) => c.id).join(", ")} · ${evidence.domain === "health" ? "escopos de saúde" : "escopos profissionais"}`
                  : "Nenhuma configurada neste servidor."}
              </li>
              <li data-ok={evidence.state === "verified"}>
                <strong>Chamada real bem-sucedida</strong>
                {evidence.lastCall
                  ? `${evidence.lastCall.tool} · ${new Date(evidence.lastCall.at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}${evidence.state === "stale" ? " · há mais de 7 dias" : ""}`
                  : `Nenhuma nas últimas ${evidence.logWindow} chamadas registradas.`}
              </li>
              {evidence.lastFailure && (
                <li data-ok={false}>
                  <strong>Falha mais recente</strong>
                  {`${evidence.lastFailure.tool} · ${new Date(evidence.lastFailure.at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`}
                </li>
              )}
              <li data-ok={Boolean(evidence.lastApplied)}>
                <strong>Operação aprovada por você e aplicada</strong>
                {evidence.lastApplied
                  ? new Date(evidence.lastApplied.at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
                  : "Nenhuma ainda."}
              </li>
            </ul>
          )}
          <small>Conversar no Escritório não comprova estas operações. O contrato também é coberto por teste automatizado com dados sintéticos.</small>
        </section>
      )}
      {presence.run && (
        <div className={styles.run}>
          <strong>
            Atendimento pelo{" "}
            {presence.run.channel === "office"
              ? "Escritório"
              : presence.run.channel === "whatsapp"
                ? "WhatsApp"
                : "Telegram"}
          </strong>
          <span>
            Recebido {new Date(presence.run.acceptedAt).toLocaleString("pt-BR")}
          </span>
          {presence.run.startedAt && (
            <span>
              Iniciado{" "}
              {new Date(presence.run.startedAt).toLocaleTimeString("pt-BR")}
            </span>
          )}
          <span>{presence.queued} pedido(s) na fila</span>
        </div>
      )}
      <details open>
        <summary>Como eu trabalho</summary>
        {profile.principles.map((rule) => (
          <div className={styles.principle} key={rule.text}>
            <p>{rule.text}</p>
            <a href={`#source-${profile.id}-${rule.sourceId}`}>
              Fonte:{" "}
              {profile.sources.find((s) => s.id === rule.sourceId)?.title}
            </a>
          </div>
        ))}
      </details>
      <details open>
        <summary>
          Skills e fontes <span>{profile.sources.length}</span>
        </summary>
        <div className={styles.sources}>
          {profile.sources.map((source) => (
            <article id={`source-${profile.id}-${source.id}`} key={source.id}>
              <span className={styles.kind}>{kind[source.kind]}</span>
              <h3>{source.title}</h3>
              <p>{source.summary}</p>
              <details>
                <summary>Ver origem</summary>
                <code>{source.reference}</code>
                <p>
                  {source.revision
                    ? `Revisão: ${source.revision}`
                    : "Revisão da implantação não confirmada."}
                </p>
                <p>
                  {source.verifiedAt
                    ? `Verificada em ${new Date(source.verifiedAt).toLocaleString("pt-BR")}`
                    : "Sem verificação recente."}
                </p>
              </details>
              {source.kind === "skill" && (
                <small>Uso nesta conversa não monitorado.</small>
              )}
            </article>
          ))}
        </div>
      </details>
      <details open>
        <summary>
          O que posso fazer <span>{profile.actions.length}</span>
        </summary>
        <div className={styles.actions}>
          {profile.actions.map((action) => {
            const stale =
              action.availability === "verified" &&
              (!current ||
                !action.checkedAt ||
                asOf - Date.parse(action.checkedAt) > 86400000);
            return (
              <article key={action.title}>
                <h3>{action.title}</h3>
                <p>{action.description}</p>
                <span className={styles.actionState}>
                  {stale
                    ? "Verificação desatualizada"
                    : availability[action.availability]}
                </span>
                <p className={styles.dependency}>
                  Precisa de: {action.dependency}
                </p>
                <small>
                  {action.approval === "read"
                    ? "Consulta dentro do escopo permitido."
                    : action.approval === "forbidden"
                      ? "Ação não permitida."
                      : "Requer seu pedido ou aprovação dos dados exatos."}{" "}
                  {action.enforcement === "instructions"
                    ? "Regra nas instruções do agente."
                    : action.enforcement === "server"
                      ? "Exige validação do mecanismo de autorização."
                      : ""}
                </small>
                <blockquote>{action.example}</blockquote>
                <button onClick={() => copy(action.example)}>
                  {copied === action.example
                    ? "Pedido copiado ✓"
                    : "Copiar pedido"}
                </button>
              </article>
            );
          })}
        </div>
        <p className={styles.footnote} role="status">
          {copied === "error"
            ? "Não foi possível copiar. Selecione o texto do pedido."
            : "Copiar prepara o texto. Não envia nem executa uma ação."}
        </p>
      </details>
    </aside>
  );
}

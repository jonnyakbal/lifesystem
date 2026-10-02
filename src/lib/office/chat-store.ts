import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  agentIds,
  type AgentId,
  type ChatJob,
  type OfficeData,
} from "./schema";
import { readOffice, transaction } from "./store";

const input = z
  .object({
    clientId: z.string().uuid(),
    agentId: z.enum(agentIds),
    text: z.string().trim().min(1).max(6000),
  })
  .strict();
const command = z.discriminatedUnion("op", [
  z.object({ op: z.literal("claim"), sessionId: z.string().uuid() }).strict(),
  z
    .object({
      op: z.literal("result"),
      sessionId: z.string().uuid(),
      id: z.string().uuid(),
      receiptSession: z.string().uuid().optional(),
      status: z.enum(["running", "completed", "failed", "interrupted"]),
      response: z.string().max(24000).optional(),
    })
    .strict(),
]);
const uncertain =
  "Este atendimento foi interrompido. Confira os registros antes de repetir um pedido que alterava dados; ele não será executado novamente automaticamente.";
const pending = (j: ChatJob) =>
  ["queued", "claimed", "running"].includes(j.status);
function expire(data: OfficeData) {
  for (const j of data.chats || []) {
    if (
      ["claimed", "running"].includes(j.status) &&
      (j.claimSession !== data.session?.id ||
        Date.now() - Date.parse(j.updatedAt) > 600000)
    ) {
      j.status = "interrupted";
      j.response = uncertain;
      j.updatedAt = new Date().toISOString();
    }
    if (
      j.status === "queued" &&
      Date.now() - Date.parse(j.createdAt) > 3600000
    ) {
      j.status = "interrupted";
      j.response = "O pedido expirou na fila e não foi iniciado.";
      j.updatedAt = new Date().toISOString();
    }
  }
}
function publicJob(j: ChatJob) {
  // The publisher session is a worker receipt, never a browser capability.
  const { claimSession: _claim, ...view } = j;
  void _claim;
  return view;
}
export async function readChats(installation: string, agent: AgentId) {
  z.enum(agentIds).parse(agent);
  const data = await readOffice(installation);
  expire(data);
  return (data.chats || [])
    .filter((j) => j.agentId === agent)
    .slice(-50)
    .map(publicJob);
}
/** Mission board: each agent's latest 50, the same public projection as readChats. */
export async function readAllChats(installation: string) {
  const data = await readOffice(installation);
  expire(data);
  const chats = data.chats || [];
  return agentIds.flatMap((agent) =>
    chats.filter((j) => j.agentId === agent).slice(-50).map(publicJob),
  );
}
export async function submitChat(installation: string, raw: unknown) {
  const value = input.parse(raw);
  return transaction(installation, (data) => {
    const chats = (data.chats ||= []);
    expire(data);
    const prior = chats.find((j) => j.clientId === value.clientId);
    if (prior) {
      if (prior.agentId !== value.agentId || prior.text !== value.text)
        throw new Error("Identificador já usado em outro pedido.");
      return publicJob(prior);
    }
    if (
      !data.snapshot ||
      Date.now() - Date.parse(data.snapshot.receivedAt) > 90000
    )
      throw new Error(
        "Hermes desconectado. Aguarde a reconexão antes de enviar.",
      );
    if (chats.filter(pending).length >= 4)
      throw new Error("A fila está cheia. Aguarde um atendimento terminar.");
    if (chats.length >= 1000)
      throw new Error(
        "Histórico cheio. Solicite manutenção antes de continuar.",
      );
    if (
      chats.filter((j) => Date.now() - Date.parse(j.createdAt) < 86400000)
        .length >= 100
    )
      throw new Error("Limite de cem pedidos em 24 horas atingido.");
    const job: ChatJob = {
      ...value,
      id: randomUUID(),
      status: "queued",
      response: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    chats.push(job);
    return publicJob(job);
  });
}
export async function commandTransaction(installation: string, raw: unknown) {
  const value = command.parse(raw);
  return transaction(installation, (data) => {
    if (data.session?.id !== value.sessionId)
      throw new Error("Sessão aposentada");
    expire(data);
    const jobs = data.chats || [];
    if (value.op === "claim") {
      const active = jobs.find((j) =>
        ["claimed", "running"].includes(j.status),
      );
      if (active) return { job: active };
      const job = jobs.find((j) => j.status === "queued");
      if (job) {
        job.status = "claimed";
        job.claimSession = value.sessionId;
        job.updatedAt = new Date().toISOString();
      }
      return { job: job || null };
    }
    const job = jobs.find((j) => j.id === value.id);
    if (!job || job.claimSession !== (value.receiptSession || value.sessionId))
      throw new Error("Recibo de atendimento inválido.");
    if (value.status === "running" && job.claimSession !== value.sessionId)
      throw new Error("Execução de sessão antiga recusada.");
    if (!["claimed", "running"].includes(job.status)) {
      if (
        job.status === value.status &&
        job.response === (value.response || null)
      )
        return { job };
      // An interrupted claim may have a durable final receipt in the worker outbox.
      // Accept the receipt only; the claim is never queued or executed again.
      if (!(job.status === "interrupted" && value.status !== "running"))
        throw new Error("Atendimento já encerrado.");
    }
    if (value.status === "completed" && !value.response?.trim())
      throw new Error("Resposta final ausente.");
    job.status = value.status;
    job.response = value.response || null;
    job.updatedAt = new Date().toISOString();
    return { job };
  });
}

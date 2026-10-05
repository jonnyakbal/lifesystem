import { z } from "zod";
import catalog from "./catalog.json";
import { agentIds, type AgentId } from "./schema";
import { chatCompletion, type ChatMessage, type ProviderFailure } from "@/lib/ai";

// Live voice talk with a crew member. It uses the LifeSystem AI fallback
// chain (fast, e.g. Workers AI or Groq) with the member's public persona from
// the local catalog. It is NOT the Hermes profile: no memory, no tools, no
// queued job, nothing persisted, and the model is told never to claim an
// action. Anything that needs real work goes to Hermes as a normal request.

export const liveRequestSchema = z
  .object({
    agentId: z.enum(agentIds),
    text: z.string().trim().min(1).max(1000),
    history: z
      .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(1500) }).strict())
      .max(12)
      .default([]),
  })
  .strict();
export type LiveRequest = z.infer<typeof liveRequestSchema>;

type Profile = { id: string; name: string; role: string; summary: string; principles?: { text: string }[] };

export function livePersona(agentId: AgentId): string {
  const p = (catalog.profiles as Profile[]).find((x) => x.id === agentId)!;
  const principles = (p.principles || []).slice(0, 5).map((x) => `- ${x.text}`).join("\n");
  return [
    `Você é ${p.name}, da tripulação do LifeSystem (área: ${p.role}). ${p.summary}`,
    principles && `Princípios:\n${principles}`,
    "Esta é uma conversa por VOZ, ao vivo, em português do Brasil.",
    "Responda como fala natural: no máximo 2 ou 3 frases curtas, tom próximo e direto, sem markdown, sem listas, sem emojis, sem ler links.",
    "Você não tem acesso aos dados do LifeSystem nem a ferramentas nesta conversa. Nunca diga que registrou, consultou, agendou ou enviou algo.",
    "Se o pedido exigir isso, diga em uma frase que dá para mandar como pedido ao Hermes pelo botão da conversa.",
    "Se não entender, peça para repetir em poucas palavras.",
  ].filter(Boolean).join("\n");
}

/** Strips what a voice should not read even if the model ignores the prompt. */
export function spokenText(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_#>`]/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1200);
}

export async function liveReply(input: LiveRequest): Promise<{ text: string; via: { provider: string; model: string; falhas: ProviderFailure[] } }> {
  const messages: ChatMessage[] = [
    { role: "system", content: livePersona(input.agentId) },
    ...input.history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: input.text },
  ];
  // Reasoning models spend part of the budget before answering; 600 keeps
  // replies short without leaving them empty.
  const { message, provider, model, failures } = await chatCompletion(messages, { maxTokens: 600 });
  const text = spokenText(message.content || "");
  if (!text) throw new Error("A IA não devolveu uma fala.");
  return { text, via: { provider, model, falhas: failures } };
}

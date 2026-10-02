import { NextRequest, NextResponse } from "next/server";
import { isValidSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { installation, limitedJson } from "@/lib/office/auth";
import { readAllChats, readChats, submitChat } from "@/lib/office/chat-store";
import { agentIds, type AgentId } from "@/lib/office/schema";
import { consumeRateLimit } from "@/lib/rate-limit";
export const runtime = "nodejs";
async function authorized(r: NextRequest) {
  return isValidSessionToken(r.cookies.get(SESSION_COOKIE)?.value);
}
export async function GET(r: NextRequest) {
  if (!(await authorized(r)))
    return NextResponse.json(
      { error: "Faça login para conversar." },
      { status: 401 },
    );
  const id = r.nextUrl.searchParams.get("agentId") as AgentId | "all";
  if (id === "all") {
    try {
      return NextResponse.json(
        { jobs: await readAllChats(installation()) },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    } catch {
      return NextResponse.json(
        { error: "Não foi possível ler as missões." },
        { status: 503 },
      );
    }
  }
  if (!agentIds.includes(id))
    return NextResponse.json({ error: "Agente inválido." }, { status: 400 });
  try {
    return NextResponse.json(
      { jobs: await readChats(installation(), id) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Não foi possível ler a conversa." },
      { status: 503 },
    );
  }
}
export async function POST(r: NextRequest) {
  if (!(await authorized(r)))
    return NextResponse.json(
      { error: "Faça login para conversar." },
      { status: 401 },
    );
  if (!consumeRateLimit("office-chat-send", 10, 60000).allowed)
    return NextResponse.json(
      { error: "Aguarde um momento antes de enviar." },
      { status: 429 },
    );
  try {
    return NextResponse.json({
      job: await submitChat(installation(), await limitedJson(r)),
    });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error && /^(Identificador já|Hermes desconectado|A fila está|Histórico cheio|Limite de cem)/.test(e.message)
            ? e.message
            : "Pedido inválido.",
      },
      { status: 400 },
    );
  }
}

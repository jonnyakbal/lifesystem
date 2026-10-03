import { NextRequest, NextResponse } from "next/server";
import { isValidSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { isAIConfigured } from "@/lib/ai";
import { liveReply, liveRequestSchema } from "@/lib/office/live";
import { consumeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Human session only (same-origin is enforced for writes in src/proxy.ts).
// Each call is one explicit spoken turn; nothing is queued or stored.
export async function POST(r: NextRequest) {
  if (!(await isValidSessionToken(r.cookies.get(SESSION_COOKIE)?.value)))
    return NextResponse.json({ error: "Faça login para conversar." }, { status: 401 });
  if (!isAIConfigured())
    return NextResponse.json({ error: "Nenhum provedor de IA configurado no servidor." }, { status: 503 });
  if (!consumeRateLimit("office-live", 30, 60_000).allowed)
    return NextResponse.json({ error: "Muitas falas seguidas. Respire um instante." }, { status: 429 });
  let body: unknown;
  try {
    body = await r.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const parsed = liveRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  try {
    return NextResponse.json(await liveReply(parsed.data), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message.slice(0, 200) : "A IA não respondeu." }, { status: 502 });
  }
}

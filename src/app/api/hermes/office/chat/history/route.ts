import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { isValidSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { installation, limitedJson } from "@/lib/office/auth";
import { archiveChats, archivePreview, readHistory } from "@/lib/office/chat-history";
export const runtime = "nodejs";

// History reading and archiving belong to the human session only: the
// publisher token cannot browse conversations nor run maintenance.
async function authorized(r: NextRequest) {
  return isValidSessionToken(r.cookies.get(SESSION_COOKIE)?.value);
}
const known = /^(Cursor|O histórico mudou|Nenhuma conversa|Identificador de manutenção|Segmento)/;
function failure(e: unknown) {
  const message = e instanceof Error && known.test(e.message) ? e.message : e instanceof ZodError ? "Parâmetros inválidos." : "Não foi possível concluir.";
  const status = e instanceof Error && /^O histórico mudou|^Identificador/.test(e.message) ? 409 : 400;
  return NextResponse.json({ error: message }, { status });
}

export async function GET(r: NextRequest) {
  if (!(await authorized(r))) return NextResponse.json({ error: "Faça login." }, { status: 401 });
  const q = r.nextUrl.searchParams;
  try {
    if (q.get("preview") === "1")
      return NextResponse.json(
        await archivePreview(installation(), { agentId: q.get("agentId") || null, before: q.get("before") }),
        { headers: { "Cache-Control": "private, no-store" } },
      );
    return NextResponse.json(
      await readHistory(installation(), {
        agentId: q.get("agentId"),
        archived: q.get("archived") === "true",
        before: q.get("before") || undefined,
        limit: q.get("limit") ? Number(q.get("limit")) : undefined,
      }),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}

export async function POST(r: NextRequest) {
  if (!(await authorized(r))) return NextResponse.json({ error: "Faça login." }, { status: 401 });
  try {
    const body = (await limitedJson(r)) as Record<string, unknown>;
    if (body.op !== "archive") return NextResponse.json({ error: "Operação inválida." }, { status: 400 });
    const { op: _op, ...rest } = body;
    void _op;
    return NextResponse.json({ receipt: await archiveChats(installation(), rest) });
  } catch (e) {
    return failure(e);
  }
}

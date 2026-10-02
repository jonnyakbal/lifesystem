import { NextRequest, NextResponse } from "next/server";
import { isValidSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { capabilityEvidence } from "@/lib/office/capabilities";
export const runtime = "nodejs";

// Owner-only: credential ids and scopes, never key values.
export async function GET(r: NextRequest) {
  if (!(await isValidSessionToken(r.cookies.get(SESSION_COOKIE)?.value)))
    return NextResponse.json({ error: "Faça login." }, { status: 401 });
  try {
    return NextResponse.json(await capabilityEvidence(), { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Evidências indisponíveis." }, { status: 503 });
  }
}

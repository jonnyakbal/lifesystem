import { NextRequest, NextResponse } from "next/server";
import { isValidSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { installation } from "@/lib/office/auth";
import { readOffice } from "@/lib/office/store";
import { projectOffice } from "@/lib/office/view";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  if (!(await isValidSessionToken(request.cookies.get(SESSION_COOKIE)?.value)))
    return NextResponse.json(
      { error: "Faça login para ver o escritório." },
      { status: 401 },
    );
  try {
    return NextResponse.json(projectOffice(await readOffice(installation())), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível consultar o escritório." },
      { status: 503 },
    );
  }
}

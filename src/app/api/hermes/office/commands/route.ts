import { NextRequest, NextResponse } from "next/server";
import {
  installation,
  publisherAuth,
  limitedJson,
  officeError,
} from "@/lib/office/auth";
import { commandTransaction } from "@/lib/office/chat-store";
export const runtime = "nodejs";
export async function POST(r: NextRequest) {
  const denied = publisherAuth(r, 90);
  if (denied) return denied;
  try {
    return NextResponse.json(
      await commandTransaction(installation(), await limitedJson(r)),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return officeError(e);
  }
}

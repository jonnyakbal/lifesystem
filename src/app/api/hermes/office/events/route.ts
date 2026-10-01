import { NextRequest, NextResponse } from "next/server";
import {
  installation,
  publisherAuth,
  limitedJson,
  officeError,
} from "@/lib/office/auth";
import { ingestOffice } from "@/lib/office/store";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const denied = publisherAuth(request, 30);
  if (denied) return denied;
  try {
    return NextResponse.json(
      await ingestOffice(installation(), await limitedJson(request)),
    );
  } catch (error) {
    return officeError(error);
  }
}

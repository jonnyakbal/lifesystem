import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  installation,
  publisherAuth,
  limitedJson,
  officeError,
} from "@/lib/office/auth";
import { registerPublisher } from "@/lib/office/store";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const denied = publisherAuth(request, 6);
  if (denied) return denied;
  try {
    const body = z
      .object({ bootId: z.string() })
      .strict()
      .parse(await limitedJson(request));
    return NextResponse.json(
      await registerPublisher(installation(), body.bootId),
    );
  } catch (error) {
    return officeError(error);
  }
}

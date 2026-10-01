import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { consumeRateLimit } from "../rate-limit";
export function installation() {
  return process.env.HERMES_OFFICE_INSTALLATION_ID || "personal";
}
export function publisherAuth(request: NextRequest, limit: number) {
  const expected = process.env.HERMES_OFFICE_TOKEN || "";
  const presented =
    request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/)?.[1] || "";
  const a = Buffer.from(expected),
    b = Buffer.from(presented);
  if (a.length < 32 || a.length !== b.length || !timingSafeEqual(a, b))
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const rate = consumeRateLimit(
    `office:${limit}:${installation()}`,
    limit,
    60000,
  );
  if (!rate.allowed)
    return NextResponse.json(
      { error: "Aguarde para publicar." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  return null;
}
export async function limitedJson(request: NextRequest) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new Error("media");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("invalid");
  let size = 0;
  const parts: Uint8Array[] = [];
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65536) {
        await reader.cancel();
        throw new Error("size");
      }
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(Buffer.concat(parts).toString("utf8")) as unknown;
}
export function officeError(error: unknown) {
  const reason = error instanceof Error ? error.message : "";
  const status =
    reason === "size"
      ? 413
      : reason === "media"
        ? 415
        : reason.includes("aposentada")
          ? 409
          : 400;
  return NextResponse.json(
    {
      error:
        status === 413
          ? "Corpo acima de 64 KiB."
          : status === 409
            ? "Sessão aposentada."
            : "Publicação inválida ou temporariamente indisponível.",
    },
    { status },
  );
}

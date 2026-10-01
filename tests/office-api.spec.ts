import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { GET } from "../src/app/api/hermes/office/route";
import { POST as session } from "../src/app/api/hermes/office/sessions/route";
import { POST as events } from "../src/app/api/hermes/office/events/route";
import { createSessionToken, SESSION_COOKIE } from "../src/lib/auth";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
test("office enforces browser login and isolated publisher credentials, including size limit", async () => {
  const dir = await mkdtemp(join(tmpdir(), "office-api-"));
  const saved = { ...process.env };
  Object.assign(process.env, {
    LIFESYSTEM_DATA_DIR: dir,
    AUTH_USER: "office-test",
    AUTH_PASSWORD: "test-only",
    HERMES_OFFICE_TOKEN: "a".repeat(40),
  });
  const req = (path: string, body: string, token = "a".repeat(40)) =>
    new NextRequest("http://localhost" + path, {
      method: "POST",
      headers: {
        authorization: "Bearer " + token,
        "content-type": "application/json",
      },
      body,
    });
  try {
    expect(
      (await GET(new NextRequest("http://localhost/api/hermes/office"))).status,
    ).toBe(401);
    expect(
      (
        await session(
          req("/api/hermes/office/sessions", '{"bootId":"test-boot"}', "wrong"),
        )
      ).status,
    ).toBe(401);
    const registered = await session(
      req("/api/hermes/office/sessions", '{"bootId":"test-boot"}'),
    );
    expect(registered.status).toBe(200);
    expect(
      (await events(req("/api/hermes/office/events", " ".repeat(65537))))
        .status,
    ).toBe(413);
    const cookie = await createSessionToken();
    const read = await GET(
      new NextRequest("http://localhost/api/hermes/office", {
        headers: { cookie: `${SESSION_COOKIE}=${cookie}` },
      }),
    );
    expect(read.status).toBe(200);
    expect(JSON.stringify(await read.json())).not.toContain("a".repeat(40));
  } finally {
    for (const key of [
      "LIFESYSTEM_DATA_DIR",
      "AUTH_USER",
      "AUTH_PASSWORD",
      "HERMES_OFFICE_TOKEN",
    ]) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    await rm(dir, { recursive: true, force: true });
  }
});

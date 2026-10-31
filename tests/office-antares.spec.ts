import { test, expect } from "@playwright/test";
import { agentIds, catalogSchema, eventSchema } from "../src/lib/office/schema";
import { reference as catalog } from "../src/lib/office/reference";
import { crew, stationPoint, robotPose } from "../src/components/office/orbital-model";
import { agentSky } from "../src/components/brand/sigils";

test("Antares extends the roster while old six-profile publishers remain valid", () => {
  expect(agentIds).toContain("antares");
  expect(catalogSchema.safeParse(catalog).success).toBe(true);
  const legacy = { ...catalog, profiles: catalog.profiles.filter((p) => p.id !== "antares") };
  expect(catalogSchema.safeParse(legacy).success).toBe(true);
  const missing = { ...catalog, profiles: catalog.profiles.filter((p) => p.id !== "vega") };
  expect(catalogSchema.safeParse(missing).success).toBe(false);
  const duplicate = { ...catalog, profiles: [...legacy.profiles, legacy.profiles[0]] };
  expect(catalogSchema.safeParse(duplicate).success).toBe(false);
});

test("seven monitored identities are accepted without relaxing run validation", () => {
  const event = { schemaVersion: 1, kind: "snapshot", sessionId: "synthetic-test-session", sequence: 1, emittedAt: new Date().toISOString(), payload: { monitored: [...agentIds], runs: [], catalogRevision: catalog.revision, gap: false } };
  expect(eventSchema.safeParse(event).success).toBe(true);
  expect(eventSchema.safeParse({ ...event, payload: { ...event.payload, monitored: [...agentIds, "unknown"] } }).success).toBe(false);
});

test("every crew member has a distinct operational station and a constellation", () => {
  expect(crew.map((c) => c.id)).toEqual([...agentIds]);
  const points = crew.map((_, index) => stationPoint(index));
  for (let i = 0; i < points.length; i++) {
    expect(agentSky[crew[i].id]).toBeTruthy();
    const pose = robotPose(i, 0, false, true);
    expect(Number.isFinite(pose.x) && Number.isFinite(pose.z)).toBe(true);
    for (let j = i + 1; j < points.length; j++)
      expect(Math.hypot(points[i][0] - points[j][0], points[i][2] - points[j][2])).toBeGreaterThan(3.8);
  }
});

test("selecting Antares exposes the commercial profile without sending a job", async ({ page, context }) => {
  await page.request.post("/api/login", { data: { user: "office-test", password: "office-ui-test-only" } });
  await context.addCookies((await page.request.storageState()).cookies);
  let sends = 0;
  await page.route("**/api/hermes/office/chat**", (route) => {
    if (route.request().method() === "POST") sends++;
    return route.fulfill({ json: { jobs: [] } });
  });
  await page.goto("/escritorio");
  await page.getByRole("button", { name: "Focalizar Antares", exact: true }).click();
  await expect(page.getByRole("region", { name: "Conversa com Antares" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Antares", exact: true })).toBeVisible();
  expect(sends).toBe(0);
});

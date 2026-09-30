import { test, expect } from '@playwright/test';
import { NextRequest } from 'next/server';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSessionToken, SESSION_COOKIE } from '../src/lib/auth';
import { GET, POST } from '../src/app/api/health/route';
import { POST as approve } from '../src/app/api/health/approval/route';
import { proposeHealthChange } from '../src/lib/health/service';

test('human UI reads the same ledger and agent cannot approve via route', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ls-health-route-'));
  const previous = { dir: process.env.LIFESYSTEM_DATA_DIR, user: process.env.AUTH_USER, pass: process.env.AUTH_PASSWORD };
  process.env.LIFESYSTEM_DATA_DIR = dir; process.env.AUTH_USER = 'owner-test'; process.env.AUTH_PASSWORD = 'fixture-only-never-production';
  const cookie = `${SESSION_COOKIE}=${await createSessionToken()}`;
  const url = 'http://localhost:3000/api/health';
  try {
    const unauthorized = await GET(new NextRequest(url));
    expect(unauthorized.status).toBe(403);
    const payload = { action: 'record', observation: { type: 'water', ml: 350, observedAt: '2026-09-30T11:00:00-03:00', timezone: 'America/Sao_Paulo' }, idempotencyKey: 'ui-water-001' };
    const saved = await POST(new NextRequest(url, { method: 'POST', headers: { cookie, origin: 'http://localhost:3000' }, body: JSON.stringify(payload) }));
    expect(saved.status).toBe(201);
    const body = await saved.json();
    const listed = await GET(new NextRequest(url, { headers: { cookie } }));
    expect((await listed.json()).items[0].id).toBe(body.id);
    const proposal = await proposeHealthChange({ operation: 'record', observation: { type: 'energy', score: 6, observedAt: '2026-09-30T12:00:00-03:00', timezone: 'America/Sao_Paulo' }, idempotencyKey: 'agent-proposal-001' }, { id: 'orion', human: false });
    const approvalBody = JSON.stringify({ proposalId: proposal.id, revision: proposal.revision, hash: proposal.hash });
    const denied = await approve(new NextRequest(`${url}/approval`, { method: 'POST', body: approvalBody }));
    expect(denied.status).toBe(403);
    const approved = await approve(new NextRequest(`${url}/approval`, { method: 'POST', headers: { cookie, origin: 'http://localhost:3000' }, body: approvalBody }));
    expect(approved.status).toBe(200);
  } finally {
    if (previous.dir === undefined) delete process.env.LIFESYSTEM_DATA_DIR; else process.env.LIFESYSTEM_DATA_DIR = previous.dir;
    if (previous.user === undefined) delete process.env.AUTH_USER; else process.env.AUTH_USER = previous.user;
    if (previous.pass === undefined) delete process.env.AUTH_PASSWORD; else process.env.AUTH_PASSWORD = previous.pass;
    await rm(dir, { recursive: true, force: true });
  }
});

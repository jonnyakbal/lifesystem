import { test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runMcpIdempotent } from '../src/lib/mcp/receipts';

test('replays the stored receipt instead of repeating a side effect', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lifesystem-mcp-receipts-'));
  const previous = process.env.LIFESYSTEM_DATA_DIR;
  process.env.LIFESYSTEM_DATA_DIR = directory;
  let calls = 0;
  try {
    const first = await runMcpIdempotent('hermes-mcp', 'calendar.create', 'calendar-2026-09-27', async () => {
      calls += 1;
      return { id: 'managed-event' };
    });
    const second = await runMcpIdempotent('hermes-mcp', 'calendar.create', 'calendar-2026-09-27', async () => {
      calls += 1;
      return { id: 'should-not-run' };
    });
    expect(first).toEqual({ result: { id: 'managed-event' }, replayed: false });
    expect(second).toEqual({ result: { id: 'managed-event' }, replayed: true });
    expect(calls).toBe(1);
    await expect(runMcpIdempotent('hermes-mcp', 'financial.create', 'calendar-2026-09-27', async () => ({ id: 'other' })))
      .rejects.toThrow('outra operação');
  } finally {
    if (previous === undefined) delete process.env.LIFESYSTEM_DATA_DIR;
    else process.env.LIFESYSTEM_DATA_DIR = previous;
    await rm(directory, { recursive: true, force: true });
  }
});

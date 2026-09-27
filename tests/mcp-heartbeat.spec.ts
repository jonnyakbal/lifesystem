import { test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getLatestMcpHeartbeat, recordMcpHeartbeat } from '../src/lib/mcp/heartbeat';

test('stores a bounded Hermes heartbeat by credential identity', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lifesystem-mcp-heartbeat-'));
  const previous = process.env.LIFESYSTEM_DATA_DIR;
  process.env.LIFESYSTEM_DATA_DIR = directory;
  try {
    const saved = await recordMcpHeartbeat('hermes-mcp', { version: '1.4.0', status: 'online', tools: ['list_tasks', 'convert_capture'] });
    expect(saved.clientId).toBe('hermes-mcp');
    expect(saved.tools).toEqual(['list_tasks', 'convert_capture']);
    expect((await getLatestMcpHeartbeat())?.status).toBe('online');
    await expect(recordMcpHeartbeat('hermes-mcp', { version: 'x'.repeat(101) })).rejects.toThrow();
  } finally {
    if (previous === undefined) delete process.env.LIFESYSTEM_DATA_DIR;
    else process.env.LIFESYSTEM_DATA_DIR = previous;
    await rm(directory, { recursive: true, force: true });
  }
});

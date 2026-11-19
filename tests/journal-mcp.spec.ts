import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLifesystemMcpServer } from '../src/lib/mcp/server';

async function connect(scopes: string[]) {
  const client = new Client({ name: 'journal-test', version: '1' });
  const server = createLifesystemMcpServer(scopes, 'journal-test');
  const [caller, receiver] = InMemoryTransport.createLinkedPair();
  await server.connect(receiver);
  await client.connect(caller);
  return client;
}

test('diário exige escopos próprios e não concede exclusão', async () => {
  for (const [scopes, expected] of [
    [['*'], []],
    [['log_entries:read', 'log_entries:write'], []],
    [['journal:read'], ['list_journal_entries']],
    [['journal:write'], ['save_journal_entry']],
  ] as [string[], string[]][]) {
    const client = await connect(scopes);
    try {
      const { tools } = await client.listTools();
      expect(tools.map(tool => tool.name).filter(name => name.includes('journal'))).toEqual(expected);
    } finally {
      await client.close();
    }
  }
});

test('escrita por data preserva campos omitidos e exige versão para editar', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ls-journal-mcp-'));
  const previous = process.env.LIFESYSTEM_DATA_DIR;
  process.env.LIFESYSTEM_DATA_DIR = dir;
  const client = await connect(['journal:read', 'journal:write']);
  try {
    const save = (args: Record<string, unknown>) => client.callTool({ name: 'save_journal_entry', arguments: args });
    const date = '2026-11-19';
    expect((await save({ entryDate: date, content: 'Texto sintético', gratitude: 'Teste', mood: 'good' })).isError).toBeFalsy();
    const list = async () => {
      const result = await client.callTool({ name: 'list_journal_entries', arguments: { from: date, to: date } });
      expect(result.isError).toBeFalsy();
      return JSON.parse((result.content as { text: string }[])[0].text);
    };
    const before = (await list())[0];
    expect((await save({ entryDate: date, content: 'Conflito' })).isError).toBe(true);
    expect((await save({ entryDate: date, expectedUpdatedAt: before.updatedAt, mood: 'neutral' })).isError).toBeFalsy();
    expect((await save({ entryDate: date, expectedUpdatedAt: before.updatedAt, content: 'Versão vencida' })).isError).toBe(true);
    expect(await list()).toEqual([expect.objectContaining({ entryDate: date, content: 'Texto sintético', gratitude: 'Teste', mood: 'neutral' })]);
  } finally {
    await client.close();
    if (previous === undefined) delete process.env.LIFESYSTEM_DATA_DIR;
    else process.env.LIFESYSTEM_DATA_DIR = previous;
    await rm(dir, { recursive: true, force: true });
  }
});

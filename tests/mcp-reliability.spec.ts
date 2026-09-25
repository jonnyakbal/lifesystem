import { test, expect } from '@playwright/test';
import { runMcpToolWithAudit } from '../src/lib/mcp/audit';

test('a falha do histórico não transforma uma criação concluída em erro', async () => {
  const created = { id: 'task-1', title: 'Planejar semana' };
  const result = await runMcpToolWithAudit('create_task', async () => ({
    content: [{ type: 'text' as const, text: JSON.stringify(created) }],
  }), async () => { throw new Error('histórico indisponível'); });

  expect(JSON.parse(result.content[0].text)).toEqual(created);
});

test('uma falha da ferramenta continua sendo reportada mesmo se o histórico falhar', async () => {
  await expect(runMcpToolWithAudit('create_task', async () => {
    throw new Error('gravação indisponível');
  }, async () => { throw new Error('histórico indisponível'); })).rejects.toThrow('gravação indisponível');
});

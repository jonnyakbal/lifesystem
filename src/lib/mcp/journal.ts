import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { listJournalEntries, saveJournalEntry } from '@/lib/journal';
import { journalPayloadSchema } from '@/lib/validation';
import { runMcpToolWithAudit } from './audit';
import { canUseMcpTool } from './auth';

const listSchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
  limit: z.number().int().min(1).max(31).default(7),
}).refine(input => input.from <= input.to, 'A data inicial precisa ser anterior ou igual à final.');

const saveSchema = journalPayloadSchema.omit({ entryDate: true }).partial().extend({
  entryDate: z.iso.date(),
  expectedUpdatedAt: z.iso.datetime({ offset: true }).optional(),
}).refine(input => [input.content, input.gratitude, input.mood, input.pillarChecks].some(value => value !== undefined), 'Informe pelo menos um campo para salvar.');

function result(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
}

function failure(message: string) {
  return { isError: true, content: [{ type: 'text' as const, text: message }] };
}

export function registerJournalTools(server: McpServer, scopes: string[], clientId?: string) {
  const listName = 'list_journal_entries';
  if (canUseMcpTool(listName, scopes)) {
    server.registerTool(listName, {
      description: 'Lê o Diário pessoal no intervalo inclusivo informado, do dia mais recente para o mais antigo.',
      inputSchema: listSchema,
      annotations: { readOnlyHint: true },
    }, input => runMcpToolWithAudit(listName, async () => {
      try {
        return result(await listJournalEntries(input));
      } catch {
        return failure('Não foi possível consultar o diário.');
      }
    }, undefined, clientId));
  }

  const saveName = 'save_journal_entry';
  if (canUseMcpTool(saveName, scopes)) {
    server.registerTool(saveName, {
      description: 'Cria uma entrada por dia ou edita os campos enviados. Para editar, informe expectedUpdatedAt da leitura mais recente. pillarChecks substitui o mapa inteiro quando enviado.',
      inputSchema: saveSchema,
      annotations: { readOnlyHint: false, destructiveHint: true },
    }, ({ entryDate, expectedUpdatedAt, ...fields }) => runMcpToolWithAudit(saveName, async () => {
      try {
        const saved = await saveJournalEntry(entryDate, fields, { expectedUpdatedAt });
        if (!saved) return failure('Conflito de versão. Releia a entrada antes de salvar.');
        return result({ id: saved.entry.id, entryDate, updatedAt: saved.entry.updatedAt, created: saved.created });
      } catch {
        return failure('Não foi possível salvar o diário.');
      }
    }, undefined, clientId));
  }
}

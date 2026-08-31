// Tools exposed to the Hermes Agent (or any other MCP client) over the MCP
// server at src/app/api/mcp/route.ts. Every tool calls `storage` directly —
// same layer the REST routes under src/app/api/*/route.ts use — so there's
// exactly one source of truth for how each collection's data is shaped.
//
// The list/create/update/delete shape repeats identically across 6
// unrelated entities (tasks, content, captures, pillars, indicators,
// projects), so `registerCrudTools` generates the 4 tools once per entity
// instead of 24 near-identical hand-written blocks. Pillars are the one
// exception — they're a fixed set of 6, so only list/update are registered.
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { storage } from '@/lib/storage';
import { logMcpCall } from './log';

function textResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function errorResult(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true as const };
}

// Wraps every generated tool callback so activity shows up on /hermes
// without each of the 26 tools needing its own logging call.
function logged<Args extends unknown[]>(
  toolName: string,
  fn: (...args: Args) => Promise<{ isError?: boolean; content: { type: 'text'; text: string }[] }>
) {
  return async (...args: Args) => {
    try {
      const result = await fn(...args);
      await logMcpCall(toolName, !result.isError, result.isError ? result.content[0]?.text : undefined);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      await logMcpCall(toolName, false, message);
      throw err;
    }
  };
}

interface CrudToolsConfig<TCreate extends z.ZodRawShape, TUpdate extends z.ZodRawShape> {
  entity: string; // e.g. 'task' — used to build tool names (list_tasks, create_task, ...)
  collection: string; // storage collection name, e.g. 'tasks'
  plural: string; // e.g. 'tasks' — for list_ tool naming when it differs from entity + 's'
  listFilters?: (keyof TCreate | string)[];
  createShape: TCreate;
  updateShape: TUpdate;
  buildCreatePayload: (input: z.infer<z.ZodObject<TCreate>>) => Record<string, unknown>;
  allowCreate?: boolean;
  allowDelete?: boolean;
}

function registerCrudTools<TCreate extends z.ZodRawShape, TUpdate extends z.ZodRawShape>(
  server: McpServer,
  config: CrudToolsConfig<TCreate, TUpdate>
) {
  const { entity, collection, plural, listFilters = [], createShape, updateShape, buildCreatePayload } = config;
  const allowCreate = config.allowCreate ?? true;
  const allowDelete = config.allowDelete ?? true;

  const filterShape: z.ZodRawShape = Object.fromEntries(
    listFilters.map((key) => [String(key), z.string().optional().describe(`Filtrar por ${String(key)}`)])
  );

  server.registerTool(
    `list_${plural}`,
    {
      title: `Listar ${plural}`,
      description: `Lista todos os itens de ${plural} no LIFESYSTEM, com filtros opcionais.`,
      inputSchema: filterShape,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    logged(`list_${plural}`, async (input: any) => {
      const filters: Record<string, unknown> = {};
      for (const key of listFilters) {
        const value = input?.[key as string];
        if (value !== undefined && value !== '') filters[key as string] = value;
      }
      const items = Object.keys(filters).length > 0
        ? await storage.query(collection, filters)
        : await storage.getAll(collection);
      return textResult(items);
    })
  );

  const createShapeConcrete: z.ZodRawShape = createShape;
  const updateShapeConcrete: z.ZodRawShape = updateShape;

  if (allowCreate) {
    server.registerTool(
      `create_${entity}`,
      {
        title: `Criar ${entity}`,
        description: `Cria um novo item em ${plural} no LIFESYSTEM.`,
        inputSchema: createShapeConcrete,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      logged(`create_${entity}`, async (rawInput: any) => {
        try {
          const input = rawInput as z.infer<z.ZodObject<TCreate>>;
          const created = await storage.create(collection, buildCreatePayload(input));
          return textResult(created);
        } catch (err) {
          return errorResult(err instanceof Error ? err.message : 'Erro ao criar item.');
        }
      })
    );
  }

  server.registerTool(
    `update_${entity}`,
    {
      title: `Atualizar ${entity}`,
      description: `Atualiza campos de um item existente em ${plural} pelo id.`,
      inputSchema: { id: z.string().describe('ID do item'), ...updateShapeConcrete },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    logged(`update_${entity}`, async (rawInput: any) => {
      const { id, ...fields } = rawInput as { id: string } & Record<string, unknown>;
      const cleaned = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
      const updated = await storage.update(collection, id, cleaned);
      if (!updated) return errorResult(`Item com id "${id}" não encontrado em ${plural}.`);
      return textResult(updated);
    })
  );

  if (allowDelete) {
    server.registerTool(
      `delete_${entity}`,
      {
        title: `Apagar ${entity}`,
        description: `Apaga permanentemente um item de ${plural} pelo id.`,
        inputSchema: { id: z.string().describe('ID do item') },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      logged(`delete_${entity}`, async (rawInput: any) => {
        const { id } = rawInput as { id: string };
        const ok = await storage.delete(collection, id);
        if (!ok) return errorResult(`Item com id "${id}" não encontrado em ${plural}.`);
        return textResult({ success: true, id });
      })
    );
  }
}

export function registerAllTools(server: McpServer) {
  // Tasks — mirrors src/app/api/tasks/route.ts POST body.
  registerCrudTools(server, {
    entity: 'task',
    collection: 'tasks',
    plural: 'tasks',
    listFilters: ['status', 'pillarId', 'projectId'],
    createShape: {
      title: z.string().describe('Título da tarefa'),
      description: z.string().optional(),
      priority: z.enum(['urgent', 'important', 'normal']).optional().describe('Padrão: normal'),
      status: z.enum(['todo', 'doing', 'review', 'done']).optional().describe('Padrão: todo'),
      projectId: z.string().optional(),
      pillarId: z.string().optional(),
      dueDate: z.string().optional().describe('Formato YYYY-MM-DD'),
      tags: z.array(z.string()).optional(),
    },
    updateShape: {
      title: z.string().optional(),
      description: z.string().optional(),
      priority: z.enum(['urgent', 'important', 'normal']).optional(),
      status: z.enum(['todo', 'doing', 'review', 'done']).optional(),
      projectId: z.string().optional(),
      pillarId: z.string().optional(),
      dueDate: z.string().optional(),
      tags: z.array(z.string()).optional(),
    },
    buildCreatePayload: (input) => ({
      title: input.title || 'Sem título',
      description: input.description,
      priority: input.priority || 'normal',
      status: input.status || 'todo',
      projectId: input.projectId,
      pillarId: input.pillarId,
      dueDate: input.dueDate,
      tags: input.tags || [],
      checklist: [],
      sortOrder: 0,
    }),
  });

  // Content — mirrors src/app/api/content/route.ts POST body.
  registerCrudTools(server, {
    entity: 'content',
    collection: 'content',
    plural: 'content',
    listFilters: ['status', 'stage', 'channel'],
    createShape: {
      title: z.string().describe('Título do conteúdo'),
      body: z.string().optional(),
      channel: z.enum(['blog', 'youtube', 'instagram', 'tiktok']).optional().describe('Padrão: blog'),
      stage: z.enum(['idea', 'draft', 'review', 'scheduled', 'published', 'archived']).optional().describe('Padrão: idea'),
      category: z.string().optional(),
      format: z.string().optional(),
      tags: z.array(z.string()).optional(),
      scheduledDate: z.string().optional().describe('Formato YYYY-MM-DD'),
      scheduledTime: z.string().optional(),
    },
    updateShape: {
      title: z.string().optional(),
      body: z.string().optional(),
      channel: z.enum(['blog', 'youtube', 'instagram', 'tiktok']).optional(),
      stage: z.enum(['idea', 'draft', 'review', 'scheduled', 'published', 'archived']).optional(),
      category: z.string().optional(),
      format: z.string().optional(),
      tags: z.array(z.string()).optional(),
      scheduledDate: z.string().optional(),
      scheduledTime: z.string().optional(),
      publishedUrl: z.string().optional(),
    },
    buildCreatePayload: (input) => ({
      title: input.title || 'Sem título',
      body: input.body || '',
      channel: input.channel || 'blog',
      stage: input.stage || 'idea',
      category: input.category || 'Geral',
      format: input.format || '',
      tags: input.tags || [],
      status: 'draft',
      pinned: false,
      scheduledDate: input.scheduledDate,
      scheduledTime: input.scheduledTime,
      checklist: [],
      linkedTaskIds: [],
      linkedProjectIds: [],
    }),
  });

  // Captures — INBOX/Notas. Mirrors src/app/api/captures/route.ts POST body.
  registerCrudTools(server, {
    entity: 'capture',
    collection: 'captures',
    plural: 'captures',
    listFilters: ['status', 'type'],
    createShape: {
      content: z.string().describe('Conteúdo da nota/captura'),
      type: z.enum(['text', 'link', 'image', 'audio']).optional().describe('Padrão: text'),
      title: z.string().optional(),
      description: z.string().optional(),
      url: z.string().optional(),
      status: z.enum(['inbox', 'classified', 'noted', 'organized']).optional().describe("Padrão: inbox. Use 'noted' para virar uma Nota direto."),
      category: z.string().optional(),
    },
    updateShape: {
      content: z.string().optional(),
      title: z.string().optional(),
      description: z.string().optional(),
      status: z.enum(['inbox', 'classified', 'noted', 'organized']).optional(),
      category: z.string().optional(),
    },
    buildCreatePayload: (input) => ({
      content: input.content,
      type: input.type || 'text',
      title: input.title,
      description: input.description,
      url: input.url,
      status: input.status || 'inbox',
      coverUrl: '',
      coverColor: '',
      category: input.category || '',
    }),
  });

  // Pillars — fixed set of 6, só leitura + atualização de campos (ex: target/BHAG, currentStatus).
  registerCrudTools(server, {
    entity: 'pillar',
    collection: 'pillars',
    plural: 'pillars',
    allowCreate: false,
    allowDelete: false,
    createShape: {},
    updateShape: {
      name: z.string().optional(),
      description: z.string().optional(),
      icon: z.string().optional(),
      color: z.string().optional(),
      currentStatus: z.string().optional(),
      target: z.string().optional().describe('BHAG / Meta do Ano do pilar'),
    },
    buildCreatePayload: () => ({}),
  });

  // Indicators — Metas. Mirrors src/app/api/indicators/route.ts POST body.
  registerCrudTools(server, {
    entity: 'indicator',
    collection: 'indicators',
    plural: 'indicators',
    listFilters: ['pillarId', 'frequency'],
    createShape: {
      pillarId: z.string().describe('ID do pilar ao qual essa meta pertence'),
      name: z.string().describe('Nome da meta'),
      description: z.string().optional(),
      type: z.enum(['count', 'boolean', 'scale', 'currency', 'percentage']).optional().describe('Padrão: count'),
      targetValue: z.number().optional(),
      currentValue: z.number().optional(),
      unit: z.string().optional(),
      frequency: z.enum(['daily', 'weekly', 'monthly']).optional().describe('Padrão: weekly'),
    },
    updateShape: {
      name: z.string().optional(),
      description: z.string().optional(),
      targetValue: z.number().optional(),
      currentValue: z.number().optional(),
      unit: z.string().optional(),
      frequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
    },
    buildCreatePayload: (input) => ({
      pillarId: input.pillarId,
      name: input.name,
      description: input.description,
      type: input.type || 'count',
      targetValue: input.targetValue,
      currentValue: input.currentValue || 0,
      unit: input.unit,
      frequency: input.frequency || 'weekly',
    }),
  });

  // Projects — mirrors src/app/api/projects/route.ts POST body.
  registerCrudTools(server, {
    entity: 'project',
    collection: 'projects',
    plural: 'projects',
    listFilters: ['status'],
    createShape: {
      name: z.string().describe('Nome do projeto'),
      description: z.string().optional(),
      status: z.enum(['active', 'development', 'paused', 'idea']).optional().describe('Padrão: idea'),
      tags: z.array(z.string()).optional(),
      needs: z.string().optional(),
    },
    updateShape: {
      name: z.string().optional(),
      description: z.string().optional(),
      status: z.enum(['active', 'development', 'paused', 'idea']).optional(),
      tags: z.array(z.string()).optional(),
      needs: z.string().optional(),
    },
    buildCreatePayload: (input) => ({
      name: input.name || 'Sem título',
      description: input.description || '',
      status: input.status || 'idea',
      tags: input.tags || [],
      needs: input.needs || '',
      links: [],
      tasksCount: 0,
      tasksDone: 0,
    }),
  });

  // Log entries — Diário de Bordo (/diario-bordo). Mirrors
  // src/app/api/log-entries/route.ts POST body. Lets an agent record
  // technical/product decisions directly from a conversation.
  registerCrudTools(server, {
    entity: 'log_entry',
    collection: 'log-entries',
    plural: 'log_entries',
    listFilters: ['category'],
    createShape: {
      title: z.string().describe('Título da entrada'),
      body: z.string().optional().describe('Corpo em HTML simples (ex: <p>...</p>)'),
      category: z.enum(['stack', 'infra', 'deploy', 'seguranca', 'testes', 'produto', 'roadmap', 'geral']).optional().describe('Padrão: geral'),
      date: z.string().optional().describe('Formato YYYY-MM-DD. Padrão: hoje'),
    },
    updateShape: {
      title: z.string().optional(),
      body: z.string().optional(),
      category: z.enum(['stack', 'infra', 'deploy', 'seguranca', 'testes', 'produto', 'roadmap', 'geral']).optional(),
      date: z.string().optional(),
    },
    buildCreatePayload: (input) => ({
      title: input.title || 'Sem título',
      body: input.body || '',
      category: input.category || 'geral',
      date: input.date || new Date().toISOString().split('T')[0],
    }),
  });
}

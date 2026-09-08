// Tool definitions for the embedded Copiloto chat — the in-app counterpart
// to the MCP tools in src/lib/mcp/tools.ts. Both call `storage` directly and
// cover mostly the same entities, but this file speaks OpenAI's JSON-Schema
// tool format (for chatCompletion) rather than the MCP SDK's zod-based
// registerTool, so the two aren't literally shared code — same data layer,
// same shapes, parallel registration.
//
// Every write tool here requires explicit user confirmation before it runs
// (enforced by the route, not by this file) — mirroring the confirm-before-
// write pattern in Nave-Mãe's Copiloto (dona-maria/nave-app/src/lib/copiloto.ts),
// adapted to a server-side executor instead of a client-side one since
// LIFESYSTEM's data already lives behind `storage`, not in browser state.
import { storage } from '@/lib/storage';
import type { ChatTool } from '@/lib/ai';

interface FieldDef {
  type: 'string' | 'number' | 'boolean' | 'array';
  description?: string;
  enum?: string[];
  items?: { type: string };
}

interface EntityDef {
  entity: string; // 'task'
  collection: string; // 'tasks'
  plural: string; // 'tasks' — used for list_/create_ tool naming
  label: string; // 'tarefa' — for human-readable confirmation text
  titleField: string; // which create field to show in the confirmation ("title", "name", "content"...)
  listFilters?: Record<string, FieldDef>;
  createFields: Record<string, FieldDef>;
  requiredCreate?: string[]; // used both for the JSON schema's `required` and as a runtime guard before writing
  updateFields: Record<string, FieldDef>;
  allowCreate?: boolean;
  allowDelete?: boolean;
  buildCreatePayload: (input: Record<string, unknown>) => Record<string, unknown>;
}

function toJsonSchema(fields: Record<string, FieldDef>, required: string[] = []) {
  return {
    type: 'object',
    properties: Object.fromEntries(
      Object.entries(fields).map(([key, def]) => [key, {
        type: def.type,
        ...(def.description ? { description: def.description } : {}),
        ...(def.enum ? { enum: def.enum } : {}),
        ...(def.items ? { items: def.items } : {}),
      }])
    ),
    ...(required.length > 0 ? { required } : {}),
  };
}

const ENTITIES: EntityDef[] = [
  {
    entity: 'task',
    collection: 'tasks',
    plural: 'tasks',
    label: 'tarefa',
    titleField: 'title',
    requiredCreate: ['title'],
    listFilters: {
      status: { type: 'string', description: 'Filtrar por etapa (ex: todo, doing, done — use list_tasks sem filtro pra ver as etapas existentes)' },
      projectId: { type: 'string' },
      pillarId: { type: 'string' },
    },
    createFields: {
      title: { type: 'string', description: 'Título da tarefa' },
      description: { type: 'string' },
      priority: { type: 'string', enum: ['urgent', 'important', 'normal'], description: 'Padrão: normal' },
      status: { type: 'string', description: 'Padrão: todo' },
      projectId: { type: 'string' },
      pillarId: { type: 'string' },
      dueDate: { type: 'string', description: 'Formato YYYY-MM-DD' },
      tags: { type: 'array', items: { type: 'string' } },
    },
    updateFields: {
      title: { type: 'string' }, description: { type: 'string' },
      priority: { type: 'string', enum: ['urgent', 'important', 'normal'] },
      status: { type: 'string' }, projectId: { type: 'string' }, pillarId: { type: 'string' },
      dueDate: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } },
    },
    buildCreatePayload: (i) => ({
      title: i.title || 'Sem título', description: i.description, priority: i.priority || 'normal',
      status: i.status || 'todo', projectId: i.projectId, pillarId: i.pillarId, dueDate: i.dueDate,
      tags: i.tags || [], checklist: [], sortOrder: 0,
    }),
  },
  {
    entity: 'project',
    collection: 'projects',
    plural: 'projects',
    label: 'projeto',
    titleField: 'name',
    requiredCreate: ['name'],
    listFilters: { status: { type: 'string', description: 'Filtrar por etapa (use list_projects sem filtro pra ver as existentes)' } },
    createFields: {
      name: { type: 'string', description: 'Nome do projeto' },
      description: { type: 'string' },
      status: { type: 'string', description: 'Padrão: idea' },
      tags: { type: 'array', items: { type: 'string' } },
      needs: { type: 'string' },
    },
    updateFields: {
      name: { type: 'string' }, description: { type: 'string' }, status: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } }, needs: { type: 'string' },
    },
    buildCreatePayload: (i) => ({
      name: i.name || 'Sem título', description: i.description || '', status: i.status || 'idea',
      tags: i.tags || [], needs: i.needs || '', links: [], tasksCount: 0, tasksDone: 0,
    }),
  },
  {
    entity: 'edital',
    collection: 'editais',
    plural: 'editais',
    label: 'edital',
    titleField: 'title',
    requiredCreate: ['title'],
    listFilters: { stage: { type: 'string', description: 'Filtrar por etapa (use list_editais sem filtro pra ver as existentes)' } },
    createFields: {
      title: { type: 'string', description: 'Título do edital' },
      orgao: { type: 'string' }, description: { type: 'string' },
      valor: { type: 'number', description: 'Valor em reais' },
      prazoInscricao: { type: 'string', description: 'Formato YYYY-MM-DD' },
      link: { type: 'string' }, pillarId: { type: 'string' },
      stage: { type: 'string', description: 'Padrão: radar' }, notes: { type: 'string' },
    },
    updateFields: {
      title: { type: 'string' }, orgao: { type: 'string' }, description: { type: 'string' },
      valor: { type: 'number' }, prazoInscricao: { type: 'string' }, link: { type: 'string' },
      pillarId: { type: 'string' }, stage: { type: 'string' }, notes: { type: 'string' },
    },
    buildCreatePayload: (i) => ({
      title: i.title || 'Sem título', orgao: i.orgao, description: i.description, valor: i.valor,
      prazoInscricao: i.prazoInscricao, link: i.link, pillarId: i.pillarId, stage: i.stage || 'radar', notes: i.notes,
    }),
  },
  {
    entity: 'indicator',
    collection: 'indicators',
    plural: 'indicators',
    label: 'meta',
    titleField: 'name',
    requiredCreate: ['pillarId', 'name'],
    listFilters: { pillarId: { type: 'string' } },
    createFields: {
      pillarId: { type: 'string', description: 'ID do pilar' },
      name: { type: 'string', description: 'Nome da meta' },
      description: { type: 'string' },
      type: { type: 'string', enum: ['count', 'boolean', 'scale', 'currency', 'percentage'] },
      targetValue: { type: 'number' }, currentValue: { type: 'number' }, unit: { type: 'string' },
      frequency: { type: 'string', enum: ['daily', 'weekly', 'monthly'] },
    },
    updateFields: {
      name: { type: 'string' }, description: { type: 'string' }, targetValue: { type: 'number' },
      currentValue: { type: 'number' }, unit: { type: 'string' },
      frequency: { type: 'string', enum: ['daily', 'weekly', 'monthly'] },
    },
    buildCreatePayload: (i) => ({
      pillarId: i.pillarId, name: i.name, description: i.description, type: i.type || 'count',
      targetValue: i.targetValue, currentValue: i.currentValue || 0, unit: i.unit, frequency: i.frequency || 'weekly',
    }),
  },
  {
    entity: 'pillar',
    collection: 'pillars',
    plural: 'pillars',
    label: 'pilar',
    titleField: 'name',
    allowCreate: false,
    allowDelete: false,
    createFields: {},
    updateFields: {
      name: { type: 'string' }, description: { type: 'string' },
      currentStatus: { type: 'string' }, target: { type: 'string', description: 'BHAG / Meta do Ano' },
    },
    buildCreatePayload: () => ({}),
  },
  {
    entity: 'capture',
    collection: 'captures',
    plural: 'captures',
    label: 'nota',
    titleField: 'content',
    requiredCreate: ['content'],
    listFilters: { status: { type: 'string' } },
    createFields: {
      content: { type: 'string', description: 'Conteúdo da nota' },
      title: { type: 'string' }, url: { type: 'string' },
      status: { type: 'string', description: "Padrão: inbox. Use 'noted' pra virar Nota direto." },
    },
    updateFields: { content: { type: 'string' }, title: { type: 'string' }, status: { type: 'string' } },
    buildCreatePayload: (i) => ({
      content: i.content, type: i.url ? 'link' : 'text', title: i.title, url: i.url,
      status: i.status || 'inbox', coverUrl: '', coverColor: '', category: '',
    }),
  },
];

function omitUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

const WRITE_TOOLS = new Set<string>();
export const TOOLS: ChatTool[] = [];

// Maps a tool name back to its executor. Built once at module load from
// ENTITIES, same way registerCrudTools builds MCP tools from the same kind
// of table — see the comment at the top of src/lib/mcp/tools.ts.
type Executor = (args: Record<string, unknown>) => Promise<unknown>;
const EXECUTORS = new Map<string, Executor>();
const DESCRIBERS = new Map<string, (args: Record<string, unknown>) => string>();
// Per-tool required-field check, run BEFORE a write is presented to the user
// for confirmation — a malformed/incomplete tool call (a flaky free model
// omitting an id, or JSON that failed to parse into anything usable) fails
// immediately with a message the model can read and retry, instead of
// showing the user a confirmation card for an action that can only fail
// (e.g. "Atualizar tarefa undefined").
const VALIDATORS = new Map<string, (args: Record<string, unknown>) => string | null>();

for (const def of ENTITIES) {
  const allowCreate = def.allowCreate ?? true;
  const allowDelete = def.allowDelete ?? true;

  TOOLS.push({
    type: 'function',
    function: {
      name: `list_${def.plural}`,
      description: `Lista ${def.plural} do LIFESYSTEM, com filtros opcionais.`,
      parameters: toJsonSchema(def.listFilters || {}),
    },
  });
  EXECUTORS.set(`list_${def.plural}`, async (args) => {
    const filters = Object.fromEntries(Object.entries(args).filter(([, v]) => v !== undefined && v !== ''));
    return Object.keys(filters).length > 0 ? storage.query(def.collection, filters) : storage.getAll(def.collection);
  });

  if (allowCreate) {
    const required = def.requiredCreate || [];
    TOOLS.push({
      type: 'function',
      function: {
        name: `create_${def.entity}`,
        description: `Cria uma nova ${def.label} no LIFESYSTEM.`,
        parameters: toJsonSchema(def.createFields, required),
      },
    });
    WRITE_TOOLS.add(`create_${def.entity}`);
    EXECUTORS.set(`create_${def.entity}`, (args) => storage.create(def.collection, def.buildCreatePayload(args)));
    DESCRIBERS.set(`create_${def.entity}`, (args) => `Criar ${def.label}: "${args[def.titleField] ?? '(sem título)'}"`);
    VALIDATORS.set(`create_${def.entity}`, (args) => {
      const missing = required.filter((k) => args[k] === undefined || args[k] === '');
      return missing.length > 0 ? `Faltou informar: ${missing.join(', ')}.` : null;
    });
  }

  TOOLS.push({
    type: 'function',
    function: {
      name: `update_${def.entity}`,
      description: `Atualiza campos de uma ${def.label} existente pelo id. Use list_${def.plural} pra achar o id.`,
      parameters: toJsonSchema({ id: { type: 'string', description: 'ID do item' }, ...def.updateFields }, ['id']),
    },
  });
  WRITE_TOOLS.add(`update_${def.entity}`);
  EXECUTORS.set(`update_${def.entity}`, async (args) => {
    const { id, ...fields } = args as { id: string } & Record<string, unknown>;
    const cleaned = omitUndefined(fields);
    const updated = await storage.update(def.collection, id, cleaned);
    if (!updated) throw new Error(`${def.label} com id "${id}" não encontrada.`);
    return updated;
  });
  DESCRIBERS.set(`update_${def.entity}`, (args) => {
    const { id, ...fields } = args;
    const changes = Object.entries(fields).map(([k, v]) => `${k}=${v}`).join(', ');
    return `Atualizar ${def.label} ${id}: ${changes || '(nenhum campo)'}`;
  });
  VALIDATORS.set(`update_${def.entity}`, (args) =>
    typeof args.id === 'string' && args.id ? null : `Faltou o id de qual ${def.label} atualizar.`
  );

  if (allowDelete) {
    TOOLS.push({
      type: 'function',
      function: {
        name: `delete_${def.entity}`,
        description: `Apaga permanentemente uma ${def.label} pelo id.`,
        parameters: toJsonSchema({ id: { type: 'string', description: 'ID do item' } }, ['id']),
      },
    });
    WRITE_TOOLS.add(`delete_${def.entity}`);
    EXECUTORS.set(`delete_${def.entity}`, async (args) => {
      const ok = await storage.delete(def.collection, (args as { id: string }).id);
      if (!ok) throw new Error(`${def.label} com id "${args.id}" não encontrada.`);
      return { success: true, id: args.id };
    });
    DESCRIBERS.set(`delete_${def.entity}`, (args) => `Apagar ${def.label} ${args.id} — isso não pode ser desfeito`);
    VALIDATORS.set(`delete_${def.entity}`, (args) =>
      typeof args.id === 'string' && args.id ? null : `Faltou o id de qual ${def.label} apagar.`
    );
  }
}

export function isWriteTool(name: string): boolean {
  return WRITE_TOOLS.has(name);
}

export async function executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const fn = EXECUTORS.get(name);
  if (!fn) throw new Error(`Ferramenta desconhecida: ${name}`);
  return fn(args);
}

export function describeTool(name: string, args: Record<string, unknown>): string {
  const fn = DESCRIBERS.get(name);
  return fn ? fn(args) : name;
}

// Returns an error message if the write call is malformed enough that it
// would only ever fail — a missing id, a required create field the model
// dropped, or (upstream) JSON that failed to parse into anything usable.
// Checked before a write is ever shown to the user for confirmation.
export function validateArgs(name: string, args: Record<string, unknown>): string | null {
  const fn = VALIDATORS.get(name);
  return fn ? fn(args) : null;
}

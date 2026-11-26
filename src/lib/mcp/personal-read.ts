import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { htmlToText } from '@/lib/content-hub/fetch';
import { DEFAULT_STAGES } from '@/lib/default-stages';
import { storage } from '@/lib/storage';
import { isTaskCompleted, resolveTaskStages } from '@/lib/task-stages';
import { getWeekAvailability } from '@/lib/week-availability';
import { DEFAULT_REVIEW_SETTINGS, latestReview, REVIEW_SETTINGS_COLLECTION, reviewSettingsSchema, WEEKLY_REVIEW_COLLECTION, weeklyReviewStalledProjects, type WeeklyReview } from '@/lib/weekly-review';
import type { Capture, Project, StageConfig, Task, VisionDocument, WikiCollection } from '@/types';
import { runMcpToolWithAudit } from './audit';
import { canUseMcpTool } from './auth';

const codeStage = z.enum(['captured', 'distilled', 'expressed']);
const id = z.string().min(1).max(200);
const section = z.enum(['identity', 'vision_5y', 'timeline', 'dream', 'custom']);
const pageShape = {
  limit: z.number().int().min(1).max(50).default(15),
  cursor: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
};

function page<T>(items: T[], limit: number, cursor: number) {
  const end = cursor + limit;
  return { items: items.slice(cursor, end), nextCursor: end < items.length ? end : null };
}

function isNote(capture: Capture) {
  // Mirrors Notas and includes older classified captures.
  return capture.status !== 'inbox' && capture.status !== 'organized';
}

function noteStage(capture: Capture) {
  return capture.codeStage ?? 'captured';
}

function noteTitle(capture: Capture, text: string) {
  const heading = (capture.content ?? '').match(/^\s*<h2(?:\s[^>]*)?>([\s\S]*?)<\/h2>/i)?.[1];
  return (heading && htmlToText(heading) || capture.title || text.split('\n')[0] || 'Nova página').slice(0, 300);
}

function noteSummary(capture: Capture, text: string) {
  return {
    id: capture.id,
    title: noteTitle(capture, text),
    collectionId: capture.category ?? null,
    codeStage: noteStage(capture),
    preview: (capture.essence || text).replace(/\s+/g, ' ').slice(0, 180),
    updatedAt: capture.updatedAt,
  };
}

async function getReview() {
  const [reviews, record] = await Promise.all([
    storage.getAll<WeeklyReview>(WEEKLY_REVIEW_COLLECTION),
    storage.getById<{ id: string; settings: unknown }>(REVIEW_SETTINGS_COLLECTION, 'default'),
  ]);
  const settings = reviewSettingsSchema.safeParse(record?.settings);
  return { latest: latestReview(reviews), reviewDay: settings.success ? settings.data.reviewDay : DEFAULT_REVIEW_SETTINGS.reviewDay };
}

async function prepareReview(through: string, limit: number) {
  const [review, captures, tasks, projects, configs] = await Promise.all([
    getReview(),
    storage.getAll<Capture>('captures'),
    storage.getAll<Task>('tasks'),
    storage.getAll<Project>('projects'),
    storage.getAll<StageConfig>('stage-configs'),
  ]);
  const stages = resolveTaskStages(configs.find(config => config.scope === 'tasks')?.stages ?? DEFAULT_STAGES.tasks, tasks);
  const openTasks = tasks.filter(task => !isTaskCompleted(task, stages));
  const inbox = captures.filter(capture => capture.status === 'inbox')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const dated = openTasks.filter(task => task.dueDate && task.dueDate <= through)
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!) || a.id.localeCompare(b.id));
  const projectsWithoutNextAction = weeklyReviewStalledProjects(projects, openTasks);
  const carriedPriorities = review.latest?.priorities.filter(taskId => openTasks.some(task => task.id === taskId)) ?? [];

  return {
    ...review,
    through,
    status: 'draft',
    reviewPath: '/revisao',
    carriedPriorities,
    inbox: { total: inbox.length, items: inbox.slice(0, limit).map(capture => {
      const text = htmlToText(capture.content ?? '');
      return { id: capture.id, title: noteTitle(capture, text) };
    }) },
    dueTasks: { total: dated.length, items: dated.slice(0, limit).map(task => ({
      id: task.id, title: task.title, dueDate: task.dueDate, priority: task.priority, projectId: task.projectId ?? null,
    })) },
    projectsWithoutNextAction: { total: projectsWithoutNextAction.length, items: projectsWithoutNextAction.slice(0, limit).map(project => ({
      id: project.id, name: project.name, status: project.status,
    })) },
  };
}

export function registerPersonalReadTools(server: McpServer, scopes: string[], clientId?: string) {
  function register<S extends z.ZodRawShape>(
    name: string,
    description: string,
    shape: S,
    execute: (input: z.infer<z.ZodObject<S>>) => Promise<unknown>,
  ) {
    if (!canUseMcpTool(name, scopes)) return;
    const schema = z.object(shape);
    const inputSchema: z.ZodRawShape = shape;
    server.registerTool(name, { description, inputSchema, annotations: { readOnlyHint: true } },
      input => runMcpToolWithAudit(name, async () => {
        try {
          const value = await execute(schema.parse(input));
          return { content: [{ type: 'text' as const, text: JSON.stringify(value) }] };
        } catch {
          return { isError: true, content: [{ type: 'text' as const, text: 'Não foi possível concluir a consulta.' }] };
        }
      }, undefined, clientId),
    );
  }

  register('get_week_availability', 'Devolve janelas livres na semana de segunda a domingo, conforme a jornada, blocos de tarefas e Google Agenda. freeWindows null indica agenda incompleta.', {
    date: z.iso.date(), minimumMinutes: z.number().int().min(1).max(1440).default(30),
  }, input => getWeekAvailability(input.date, input.minimumMinutes));
  register('get_weekly_review', 'Consulta a última revisão concluída e o dia configurado para revisar. As prioridades são IDs de tarefas.', {}, getReview);
  register('prepare_weekly_review', 'Prepara um rascunho somente de leitura com Inbox, tarefas até o dia informado e projetos sem próxima ação. A confirmação é feita em /revisao.', {
    through: z.iso.date(), limit: z.number().int().min(1).max(20).default(8),
  }, input => prepareReview(input.through, input.limit));
  register('list_notes', 'Busca resumos de notas por texto, coleção da Wiki ou etapa CODE. Use get_note para abrir uma nota.', {
    query: z.string().trim().min(1).max(200).optional(), collectionId: id.optional(), codeStage: codeStage.optional(), ...pageShape,
  }, async input => {
    const query = input.query?.toLocaleLowerCase('pt-BR');
    const captures = await storage.getAll<Capture>('captures');
    const matches = captures.filter(isNote)
      .filter(capture => (!input.collectionId || capture.category === input.collectionId) && (!input.codeStage || noteStage(capture) === input.codeStage))
      .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '') || a.id.localeCompare(b.id))
      .flatMap(capture => {
        const text = htmlToText(capture.content ?? '');
        const summary = noteSummary(capture, text);
        if (query && ![summary.title, capture.essence, text].some(value => value?.toLocaleLowerCase('pt-BR').includes(query))) return [];
        return [summary];
      });
    return page(matches, input.limit, input.cursor);
  });
  register('get_note', 'Abre uma nota por ID e devolve seu conteúdo como texto simples. Retorna null para itens que não estão em Notas.', {
    id,
  }, async input => {
    const capture = await storage.getById<Capture>('captures', input.id);
    if (!capture || !isNote(capture)) return null;
    const text = htmlToText(capture.content ?? '');
    return { ...noteSummary(capture, text), content: text, essence: capture.essence ?? null, linkedCaptureIds: capture.linkedCaptureIds ?? [] };
  });
  register('list_wiki_collections', 'Lista coleções da Wiki. Use o ID da coleção em list_notes.', pageShape, async input => {
    const collections = await storage.getAll<WikiCollection>('wiki-collections');
    return page(collections.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)), input.limit, input.cursor);
  });
  register('list_vision_documents', 'Consulta os documentos de Visão por seção. Use includeContent para ler o conteúdo.', {
    section: section.optional(), includeContent: z.boolean().default(false), ...pageShape,
  }, async input => {
    const documents = await storage.getAll<VisionDocument>('vision');
    const selected = documents.filter(document => !input.section || document.section === input.section)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
      .map(document => ({
        id: document.id, section: document.section, title: document.title, updatedAt: document.updatedAt,
        ...(input.includeContent ? { content: document.content ?? '' } : {}),
      }));
    return page(selected, input.limit, input.cursor);
  });
}

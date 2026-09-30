import { z } from 'zod';
import { storage } from '@/lib/storage';
import { DEFAULT_STAGES } from '@/lib/default-stages';
import type { Edital, StageConfig } from '@/types';

const schema = z.object({ title: z.string().max(500).optional(), orgao: z.string().max(500).optional(), description: z.string().max(20000).optional(), valor: z.number().nonnegative().optional(), prazoInscricao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), link: z.string().max(2000).optional(), pillarId: z.string().max(100).optional(), stage: z.string().max(100).optional(), notes: z.string().max(20000).optional(), projectId: z.string().max(100).optional() }).strict();
export async function updateEdital(id: string, raw: unknown, expectedUpdatedAt?: string, authorizeTrigger?: (action: string) => boolean) {
  const fields = schema.parse(raw);
  return storage.transact<Edital, Edital | null>('editais', async items => {
    const current = items.find(item => item.id === id); if (!current) return null;
    if (expectedUpdatedAt && expectedUpdatedAt !== current.updatedAt) throw new Error('Conflito de versão do edital.');
    const changed = fields.stage && fields.stage !== current.stage;
    const next = { ...current, ...fields, updatedAt: new Date().toISOString() };
    if (changed) {
      const config = (await storage.query<StageConfig>('stage-configs', { scope: 'editais' }))[0];
      const trigger = (config?.stages || DEFAULT_STAGES.editais).find(stage => stage.id === next.stage)?.trigger;
      if (trigger && authorizeTrigger && !authorizeTrigger(trigger.action)) throw new Error('Sem permissão para o destino da automação do edital.');
      if (trigger?.action === 'create_reminder_task') await storage.createOnce('tasks', `edital-${id}-${next.stage}-reminder`, { title: `Acompanhar resultado: ${next.title}`, pillarId: next.pillarId, dueDate: next.prazoInscricao, projectId: next.projectId, tags: ['Edital'], status: 'todo', priority: 'normal', sortOrder: 0, checklist: [] });
      if (trigger?.action === 'create_project' && !next.projectId) {
        const project = await storage.createOnce<{ id: string }>('projects', `edital-${id}-${next.stage}-project`, { name: next.title, description: next.description || '', tags: ['Edital'], status: 'idea', links: [], needs: '', tasksCount: 0, tasksDone: 0 });
        next.projectId = project.id;
      }
    }
    items[items.indexOf(current)] = next; return next;
  });
}

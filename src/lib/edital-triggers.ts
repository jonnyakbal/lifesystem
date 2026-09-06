// Client-side, post-API-call side effect — same pattern as
// spawnNextOccurrenceIfRecurring in src/lib/recurring.ts. Called after a
// stage-change PATCH on an Edital succeeds, if the new stage has a trigger.
import type { Edital, StageTrigger } from '@/types';

export async function runStageTrigger(trigger: StageTrigger, edital: Edital): Promise<void> {
  if (trigger.action === 'create_reminder_task') {
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `Acompanhar resultado: ${edital.title}`,
        pillarId: edital.pillarId,
        dueDate: edital.prazoInscricao,
        tags: ['Edital'],
      }),
    });
  } else if (trigger.action === 'create_project') {
    await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: edital.title,
        description: edital.description || '',
        tags: ['Edital'],
      }),
    });
  }
}

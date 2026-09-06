import type { StageDef, StageScope } from '@/types';

// Seed values for each scope's StageConfig — used both to seed a scope's
// document on first read (see src/app/api/stage-configs/[scope]/route.ts)
// and by the "Restaurar padrão" button in the stage config dialog.
export const DEFAULT_STAGES: Record<StageScope, StageDef[]> = {
  tasks: [
    { id: 'todo', label: 'A fazer', color: 'text-muted-foreground', dot: 'bg-muted-foreground' },
    { id: 'doing', label: 'Fazendo', color: 'text-primary', dot: 'bg-primary' },
    { id: 'review', label: 'Revisão', color: 'text-blue-500', dot: 'bg-blue-500' },
    { id: 'done', label: 'Concluída', color: 'text-money', dot: 'bg-money', isTerminal: true },
  ],
  projects: [
    { id: 'idea', label: 'Ideia', color: 'text-muted-foreground', dot: 'bg-muted-foreground' },
    { id: 'development', label: 'Desenvolvimento', color: 'text-purple-500', dot: 'bg-purple-500' },
    { id: 'active', label: 'Ativo', color: 'text-money', dot: 'bg-money' },
    { id: 'paused', label: 'Parado', color: 'text-destructive', dot: 'bg-destructive' },
  ],
  editais: [
    { id: 'radar', label: 'Radar', color: 'text-muted-foreground', dot: 'bg-muted-foreground' },
    { id: 'em_analise', label: 'Em análise', color: 'text-yellow-500', dot: 'bg-yellow-500' },
    { id: 'inscrito', label: 'Inscrito', color: 'text-blue-500', dot: 'bg-blue-500', trigger: { action: 'create_reminder_task' } },
    { id: 'resultado', label: 'Resultado', color: 'text-money', dot: 'bg-money', isTerminal: true },
  ],
};

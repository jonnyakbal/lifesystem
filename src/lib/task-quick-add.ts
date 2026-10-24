import { todayStr } from '@/lib/utils';

export interface QuickAddResult {
  title: string;
  priority?: 'urgent' | 'important';
  dueDate?: string;
  projectId?: string;
  tags: string[];
  /** Rótulos legíveis do que foi reconhecido, para mostrar antes de criar. */
  labels: string[];
}

const WEEKDAYS: Record<string, number> = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6, 'sáb': 6 };
const fold = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function resolveDate(token: string, now = new Date()): string | undefined {
  const value = fold(token);
  const shift = (days: number) => { const d = new Date(now); d.setDate(d.getDate() + days); return todayStr(d); };
  if (value === 'hoje') return shift(0);
  if (value === 'amanha') return shift(1);
  if (value in WEEKDAYS) return shift(((WEEKDAYS[value] - now.getDay() + 7) % 7) || 7);
  const match = value.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (match) {
    const day = Number(match[1]); const month = Number(match[2]);
    let year = match[3] ? Number(match[3]) : now.getFullYear();
    if (year < 100) year += 2000;
    const date = new Date(year, month - 1, day, 12);
    if (date.getMonth() !== month - 1) return undefined;
    if (!match[3] && date < new Date(now.getFullYear(), now.getMonth(), now.getDate())) date.setFullYear(year + 1);
    return todayStr(date);
  }
  return undefined;
}

/**
 * Criação rápida: "Gravar vídeo #arco !alta @sex" vira título + projeto/tag,
 * prioridade e prazo. Tokens não reconhecidos ficam no título.
 */
export function parseQuickAdd(input: string, projects: { id: string; name: string }[], now = new Date()): QuickAddResult {
  const result: QuickAddResult = { title: input.trim(), tags: [], labels: [] };
  const kept: string[] = [];
  for (const word of input.trim().split(/\s+/).filter(Boolean)) {
    const body = word.slice(1);
    if (word.startsWith('!') && body) {
      const value = fold(body);
      if (['urgente', 'alta', '1'].includes(value)) { result.priority = 'urgent'; result.labels.push('Urgente'); continue; }
      if (['importante', 'media', '2'].includes(value)) { result.priority = 'important'; result.labels.push('Importante'); continue; }
    }
    if (word.startsWith('@') && body) {
      const date = resolveDate(body, now);
      if (date) { result.dueDate = date; result.labels.push(new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })); continue; }
    }
    if (word.startsWith('#') && body) {
      const project = projects.find(item => fold(item.name).replace(/\s+/g, '') === fold(body) || fold(item.name).replace(/\s+/g, '').startsWith(fold(body)));
      if (project && !result.projectId) { result.projectId = project.id; result.labels.push(project.name); continue; }
      result.tags.push(body); result.labels.push(`#${body}`); continue;
    }
    kept.push(word);
  }
  result.title = kept.join(' ');
  return result;
}

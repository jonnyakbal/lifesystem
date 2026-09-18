import { askAIForJson } from '@/lib/ai';
import { ActionType, ContentItem } from '@/types';

export interface AiAnalysis {
  summary: string;
  actionSuggestion: ActionType;
  actionTitle: string;
  relatedPillar?: string;
  relatedProject?: string;
}

export async function analyzeContentItem(item: ContentItem): Promise<AiAnalysis | null> {
  if (!item.content && !item.excerpt) return null;
  try {
    const prompt = `Analise o seguinte conteúdo dentro do sistema LifeSystem e responda APENAS com um JSON válido neste formato:
{
  "summary": "resumo em até 3 frases",
  "actionSuggestion": "capture" | "task" | "note" | "content" | "dismiss",
  "actionTitle": "título sugerido para a ação",
  "relatedPillar": "nome do pilar mais relevante (opcional)",
  "relatedProject": "nome do projeto mais relevante (opcional)"
}

Conteúdo:
Título: ${item.title}
${item.excerpt ? `Resumo: ${item.excerpt}` : ''}
${item.content ? `Texto completo (use até 2000 caracteres): ${item.content.slice(0, 2000)}` : ''}

Se não conseguir identificar uma ação útil, use "dismiss".`;

    const parsed = await askAIForJson<AiAnalysis>(prompt, { maxTokens: 1000 });
    return {
      summary: parsed.summary ?? 'Sem resumo disponível.',
      actionSuggestion: ['capture', 'task', 'note', 'content', 'dismiss'].includes(parsed.actionSuggestion)
        ? parsed.actionSuggestion
        : 'dismiss',
      actionTitle: parsed.actionTitle || item.title,
      relatedPillar: parsed.relatedPillar,
      relatedProject: parsed.relatedProject,
    };
  } catch {
    return null;
  }
}
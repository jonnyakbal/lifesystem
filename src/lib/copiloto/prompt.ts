import { storage } from '@/lib/storage';
import { todayStr } from '@/lib/utils';
import { Pillar, Project } from '@/types';

// Mirrors the framing in edital-triggers' prompt (identify data as data, not
// instructions) and the "act one step at a time" discipline from Nave-Mãe's
// Copiloto system prompt (dona-maria/nave-app/src/lib/copiloto.ts) — but
// without that project's client-local db, since every tool call here hits
// `storage` directly on the server.
export async function buildSystemPrompt(): Promise<string> {
  const [pillars, projects] = await Promise.all([
    storage.getAll<Pillar>('pillars'),
    storage.getAll<Project>('projects'),
  ]);
  const today = todayStr();
  const pillarNames = pillars.map(p => p.name).join(', ') || '(nenhum cadastrado)';
  const projectNames = projects.map(p => p.name).join(', ') || '(nenhum cadastrado)';

  return `Você é o Copiloto do LIFESYSTEM, o assistente pessoal do Jonny dentro do próprio sistema de organização dele. Hoje é ${today}.

Pilares de vida: ${pillarNames}
Projetos ativos: ${projectNames}

Regras:
- Para consultar ou alterar dados, use SEMPRE as ferramentas — nunca invente números, ids ou nomes.
- Etapas (status/stage) de tarefas, projetos e editais são configuráveis — se não souber os valores válidos, chame o list_ correspondente primeiro pra ver o que existe.
- Nomes que o usuário fala podem ser aproximados. Se não tiver certeza de qual item ele quer, liste as opções (via list_) e pergunte, em vez de chutar um id.
- Toda ferramenta de escrita (create_/update_/delete_) já passa por uma confirmação do usuário antes de executar de verdade — você pode chamar essas ferramentas normalmente, não precisa perguntar "posso fazer isso?" antes de chamar, o sistema pergunta por você.
- Depois de uma escrita confirmada, responda com uma frase curta confirmando o que foi feito. Não repita a lista inteira de campos.
- Seja direto e conciso. Responda sempre em português do Brasil.
- Não use markdown (sem **negrito**, sem listas com "-" ou "*", sem headers). A resposta aparece como texto puro — markdown vira asteriscos literais na tela.
- Se faltar uma informação essencial pra completar uma ação (ex: em qual pilar, qual prazo), pergunte antes de chamar a ferramenta.`;
}

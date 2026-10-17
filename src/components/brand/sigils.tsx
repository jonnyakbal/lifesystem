import type { AgentId } from '@/lib/office/schema';

// Each crew member is a constellation. The drawings follow the real sky
// where the name allows it (Órion's belt, Vega in the Summer Triangle,
// Sirius as the brightest point) and the role where it does not.

type Pt = [number, number, number?];
const sparkle = (x: number, y: number, r: number) =>
  `M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z`;

const sky: Record<AgentId, { stars: Pt[]; lines: [number, number][]; bright: number; meaning: string; role: string }> = {
  hermes: { role: 'Coordenação', meaning: 'O mensageiro: um caminho que sobe ligando todos os pontos.', stars: [[3, 18], [8, 13], [12, 15], [17, 8], [21, 3]], lines: [[0, 1], [1, 2], [2, 3], [3, 4]], bright: 4 },
  vega: { role: 'Finanças', meaning: 'Vega fecha o Triângulo de Verão: três pontos em equilíbrio.', stars: [[12, 3], [4, 19], [20, 18]], lines: [[0, 1], [1, 2], [2, 0]], bright: 0 },
  sirius: { role: 'Projetos e produtividade', meaning: 'A estrela mais brilhante do céu, com o que gira em volta dela.', stars: [[12, 12], [20, 5], [4, 19]], lines: [], bright: 0 },
  orion: { role: 'Corpo e saúde', meaning: 'O caçador: ombros, cinturão de três estrelas e passos firmes.', stars: [[6, 3], [18, 4], [10, 11], [12, 12], [14, 13], [6, 21], [18, 20]], lines: [[0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6]], bright: 3 },
  astro: { role: 'Mente e aprendizado', meaning: 'Um halo de ideias em volta de um centro calmo.', stars: [[3, 15], [6, 8], [12, 5], [18, 8], [21, 15], [12, 15]], lines: [[0, 1], [1, 2], [2, 3], [3, 4]], bright: 5 },
  cosmo: { role: 'Conteúdo e criação', meaning: 'Uma espiral: ordem nascendo do caos criativo.', stars: [[12, 12], [15, 10], [16, 15], [10, 17], [6, 11], [10, 5], [18, 4]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]], bright: 0 },
};

export const agentSky = sky;

export function AgentSigil({ agent, color, size = 48, title }: { agent: AgentId; color: string; size?: number; title?: string }) {
  const s = sky[agent];
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      {s.lines.map(([a, b]) => (
        <line key={`${a}-${b}`} x1={s.stars[a][0]} y1={s.stars[a][1]} x2={s.stars[b][0]} y2={s.stars[b][1]} stroke={color} strokeOpacity=".45" strokeWidth=".6" />
      ))}
      {s.stars.map(([x, y], i) => i === s.bright
        ? <path key={i} d={sparkle(x, y, agent === 'sirius' ? 4.2 : 2.6)} fill={color} />
        : <circle key={i} cx={x} cy={y} r={1.05} fill={color} />)}
    </svg>
  );
}

import { cosmos } from './illustrations';

// The whole LifeSystem as one sky: the core (you), pillars as background
// constellations, projects as planets on orbits with their tool satellites,
// tasks as stars around them, the inbox as an incoming comet, loose tasks as
// an asteroid belt and the crew's station at the edge. Sample data only.

const star = (x: number, y: number, r: number) => `M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z`;

type Planet = { name: string; color: string; rx: number; ry: number; angle: number; size: number; tools: string[]; done: number; open: number };

const planets: Planet[] = [
  { name: 'Site Arco Labs', color: cosmos.cyan, rx: 150, ry: 62, angle: -0.35, size: 14, tools: ['Agenda'], done: 4, open: 2 },
  { name: 'TCC', color: '#A78BFA', rx: 235, ry: 98, angle: 2.55, size: 12, tools: ['Notas', 'Fontes'], done: 2, open: 3 },
  { name: 'Casamento', color: cosmos.sun, rx: 320, ry: 134, angle: 0.62, size: 17, tools: ['Financeiro', 'Agenda'], done: 6, open: 4 },
];

const constellations = [
  { name: 'Carreira', pts: [[60, 70], [92, 52], [120, 66], [150, 40]] },
  { name: 'Saúde', pts: [[690, 60], [720, 84], [752, 62], [780, 90]] },
  { name: 'Relações', pts: [[420, 34], [452, 52], [486, 38]] },
];

function Label({ x, y, children, anchor = 'start', tone = cosmos.lavender }: { x: number; y: number; children: string; anchor?: 'start' | 'middle' | 'end'; tone?: string }) {
  return <text x={x} y={y} textAnchor={anchor} fontSize="12" fill={tone} opacity=".9" fontFamily="var(--font-ui), system-ui">{children}</text>;
}

export function SystemMap() {
  const cx = 400;
  const cy = 235;
  return (
    <svg viewBox="0 0 800 470" className="h-auto w-full" fill="none" role="img" aria-label="Mapa do sistema: você no centro, projetos como planetas, ferramentas como satélites, pilares como constelações, caixa de entrada como cometa e o Escritório como estação">
      <defs>
        <radialGradient id="sm-sun" cx="40%" cy="35%" r="70%"><stop offset="0" stopColor="#FEF3C7" /><stop offset=".4" stopColor={cosmos.sun} /><stop offset=".8" stopColor="#A78BFA" /><stop offset="1" stopColor="#6D28D9" /></radialGradient>
        <radialGradient id="sm-glow"><stop offset="0" stopColor={cosmos.sun} stopOpacity=".4" /><stop offset="1" stopColor={cosmos.sun} stopOpacity="0" /></radialGradient>
        <linearGradient id="sm-tail" x1="1" y1="1" x2="0" y2="0"><stop offset="0" stopColor={cosmos.cyan} stopOpacity=".75" /><stop offset="1" stopColor={cosmos.cyan} stopOpacity="0" /></linearGradient>
      </defs>
      {Array.from({ length: 90 }, (_, i) => <circle key={i} cx={(i * 263.9) % 800} cy={(i * 151.7) % 470} r={i % 11 === 0 ? 1.3 : 0.6} fill={cosmos.lavender} opacity={0.15 + (i % 5) * 0.07} />)}

      {/* Pilares: constelações ao fundo */}
      {constellations.map(c => (
        <g key={c.name} opacity=".75">
          {c.pts.slice(1).map(([x, y], i) => <line key={i} x1={c.pts[i][0]} y1={c.pts[i][1]} x2={x} y2={y} stroke={cosmos.lavender} strokeOpacity=".3" />)}
          {c.pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.8" fill={cosmos.lavender} />)}
          <Label x={Math.min(...c.pts.map(q => q[0]))} y={Math.max(...c.pts.map(q => q[1])) + 18} tone={cosmos.dust}>{`Pilar · ${c.name}`}</Label>
        </g>
      ))}

      {/* Cinturão de asteroides: tarefas soltas */}
      {Array.from({ length: 34 }, (_, i) => { const a = (i / 34) * Math.PI * 2; return <circle key={i} cx={cx + 192 * Math.cos(a) + ((i * 7) % 5)} cy={cy + 80 * Math.sin(a) + ((i * 3) % 4)} r={0.9 + (i % 3) * 0.5} fill={cosmos.dust} opacity=".55" />; })}
      <Label x={cx - 200} y={cy + 100} anchor="end" tone={cosmos.dust}>Cinturão · tarefas soltas</Label>

      {/* Órbitas e planetas */}
      {planets.map(p => {
        const px = cx + p.rx * Math.cos(p.angle);
        const py = cy + p.ry * Math.sin(p.angle);
        const total = p.done + p.open;
        return (
          <g key={p.name}>
            <ellipse cx={cx} cy={cy} rx={p.rx} ry={p.ry} stroke={cosmos.lavender} strokeOpacity=".16" />
            {Array.from({ length: total }, (_, k) => {
              const a = (k / total) * Math.PI * 2;
              const sx = px + Math.cos(a) * (p.size + 16 + (k % 2) * 7);
              const sy = py + Math.sin(a) * (p.size + 10 + (k % 3) * 4);
              return k < p.done ? <path key={k} d={star(sx, sy, 3.2)} fill={p.color} /> : <circle key={k} cx={sx} cy={sy} r="1.3" fill={cosmos.dust} opacity=".6" />;
            })}
            <circle cx={px} cy={py} r={p.size} fill={p.color} />
            <circle cx={px - p.size * 0.35} cy={py - p.size * 0.35} r={p.size * 0.55} fill="#fff" opacity=".14" />
            {p.tools.map((t, k) => {
              const ox = px + (p.size + 34) * Math.cos(0.9 + k * 2.3);
              const oy = py + (p.size + 18) * Math.sin(0.9 + k * 2.3);
              return (
                <g key={t}>
                  <ellipse cx={px} cy={py} rx={p.size + 34} ry={p.size + 18} stroke={p.color} strokeOpacity=".22" strokeDasharray="2 3" />
                  <rect x={ox - 3} y={oy - 3} width="6" height="6" rx="1" fill={cosmos.lavender} />
                  <rect x={ox - 10} y={oy - 1.5} width="5" height="3" fill={cosmos.cyan} /><rect x={ox + 5} y={oy - 1.5} width="5" height="3" fill={cosmos.cyan} />
                  <Label x={ox} y={oy + 16} anchor="middle" tone={cosmos.cyan}>{`Satélite · ${t}`}</Label>
                </g>
              );
            })}
            <Label x={px} y={py - p.size - 8} anchor="middle">{`Planeta · ${p.name}`}</Label>
          </g>
        );
      })}

      {/* Núcleo */}
      <circle cx={cx} cy={cy} r="70" fill="url(#sm-glow)" />
      <circle cx={cx} cy={cy} r="28" fill="url(#sm-sun)" />
      <Label x={cx} y={cy + 48} anchor="middle" tone={cosmos.sun}>Núcleo · você e sua visão</Label>

      {/* Cometa: caixa de entrada */}
      <path d="M40 160 Q110 150 178 128 L182 136 Q114 160 40 160Z" fill="url(#sm-tail)" />
      <circle cx="182" cy="131" r="6" fill={cosmos.lavender} />
      <Label x={60} y={182} tone={cosmos.cyan}>Cometa · captura chegando</Label>

      {/* Estação: Escritório e tripulação */}
      <g transform="translate(110 400)">
        <ellipse cx="0" cy="0" rx="26" ry="9" stroke={cosmos.lavender} strokeOpacity=".7" strokeWidth="2.5" />
        <rect x="-5" y="-14" width="10" height="26" rx="3" fill={cosmos.nebula} />
        <rect x="-44" y="-3" width="13" height="6" fill={cosmos.cyan} opacity=".8" /><rect x="31" y="-3" width="13" height="6" fill={cosmos.cyan} opacity=".8" />
        <circle cx="0" cy="-6" r="1.8" fill={cosmos.sun} />
      </g>
      <Label x={110} y={436} anchor="middle">Estação · Escritório e tripulação</Label>
    </svg>
  );
}

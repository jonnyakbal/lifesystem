// "Sua constelação": the illustration system drawn from data. The sun is the
// centre (purpose); each pillar is a planet on its own orbit; tasks are stars
// around it, and every completed one lights up and joins the line.
export type ConstellationPillar = { name: string; color: string; done: number; open: number };

export function LifeConstellation({ pillars, width = 560, height = 320 }: { pillars: ConstellationPillar[]; width?: number; height?: number }) {
  const cx = width / 2;
  const cy = height / 2;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={`Constelação com ${pillars.length} pilares`}>
      <defs>
        <radialGradient id="lc-sun" cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#FEF3C7" /><stop offset=".35" stopColor="#FDE68A" /><stop offset=".75" stopColor="#A78BFA" /><stop offset="1" stopColor="#6D28D9" />
        </radialGradient>
        <radialGradient id="lc-glow"><stop offset="0" stopColor="#FDE68A" stopOpacity=".45" /><stop offset="1" stopColor="#FDE68A" stopOpacity="0" /></radialGradient>
      </defs>
      {Array.from({ length: 40 }, (_, i) => (
        <circle key={`s${i}`} cx={(i * 137.5) % width} cy={(i * 71.3) % height} r={i % 7 === 0 ? 1.2 : 0.6} fill="#EDE9FE" opacity={0.25 + (i % 5) * 0.08} />
      ))}
      <circle cx={cx} cy={cy} r={60} fill="url(#lc-glow)" />
      {pillars.map((p, i) => {
        const rx = 90 + i * 42;
        const ry = rx * 0.42;
        const angle = -0.6 + i * 1.9;
        const px = cx + rx * Math.cos(angle);
        const py = cy + ry * Math.sin(angle);
        const stars = Array.from({ length: p.done + p.open }, (_, k) => {
          const a = (k / Math.max(1, p.done + p.open)) * Math.PI * 2 + i;
          return { x: px + Math.cos(a) * (24 + (k % 3) * 9), y: py + Math.sin(a) * (18 + (k % 2) * 8), lit: k < p.done };
        });
        const lit = stars.filter(s => s.lit);
        return (
          <g key={p.name}>
            <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke="#C4B5FD" strokeOpacity=".18" />
            {lit.slice(1).map((s, k) => <line key={k} x1={lit[k].x} y1={lit[k].y} x2={s.x} y2={s.y} stroke={p.color} strokeOpacity=".55" strokeWidth=".8" />)}
            {stars.map((s, k) => <circle key={k} cx={s.x} cy={s.y} r={s.lit ? 1.9 : 1.1} fill={s.lit ? p.color : '#94a3b8'} opacity={s.lit ? 1 : 0.5} />)}
            <circle cx={px} cy={py} r={7 + Math.min(6, p.done)} fill={p.color} />
            <text x={px} y={py + 26} textAnchor="middle" fontSize="11" fill="#E9E5FF" opacity=".85">{p.name}</text>
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={24} fill="url(#lc-sun)" />
    </svg>
  );
}

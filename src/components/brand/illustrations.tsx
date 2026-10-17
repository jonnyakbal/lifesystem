// Spot illustrations of the LifeSystem cosmology. One per concept, same
// drawing language: thin orbits, soft glows, the brand palette, no text.
// Built as inline SVG so they stay crisp, light and themeable, and can be
// reused in empty states, onboarding and module headers.

export const cosmos = {
  space: '#070A1C',
  nebula: '#8B5CF6',
  lavender: '#EDE9FE',
  sun: '#FDE68A',
  cyan: '#67E8F9',
  aurora: '#34D399',
  red: '#FB7185',
  dust: '#A5A3C2',
};

type Props = { size?: number; className?: string; title?: string };

function Frame({ size = 120, className, title, children }: Props & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 120 90" width={size} height={(size * 90) / 120} className={className} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true} fill="none">
      {children}
    </svg>
  );
}

const star = (x: number, y: number, r: number) => `M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z`;
const dust = [[12, 14], [104, 10], [96, 78], [18, 74], [60, 8], [110, 46]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 2 ? 0.8 : 1.1} fill={cosmos.lavender} opacity=".45" />);

export function SunArt(p: Props) {
  return <Frame {...p}>{dust}<circle cx="60" cy="45" r="30" fill={cosmos.sun} opacity=".12" /><circle cx="60" cy="45" r="20" fill={cosmos.sun} opacity=".25" /><circle cx="60" cy="45" r="13" fill={cosmos.sun} /><path d={star(60, 45, 26)} fill={cosmos.sun} opacity=".18" /></Frame>;
}

export function ConstellationArt(p: Props) {
  const pts: [number, number][] = [[22, 60], [40, 34], [58, 48], [78, 22], [98, 40]];
  return <Frame {...p}>{dust}{pts.slice(1).map(([x, y], i) => <line key={i} x1={pts[i][0]} y1={pts[i][1]} x2={x} y2={y} stroke={cosmos.lavender} strokeOpacity=".4" />)}{pts.map(([x, y], i) => i === 3 ? <path key={i} d={star(x, y, 6)} fill={cosmos.lavender} /> : <circle key={i} cx={x} cy={y} r="2.2" fill={cosmos.lavender} />)}</Frame>;
}

export function PlanetArt(p: Props) {
  return <Frame {...p}>{dust}<circle cx="58" cy="46" r="20" fill={cosmos.nebula} /><circle cx="52" cy="40" r="20" fill="#A78BFA" opacity=".35" /><ellipse cx="58" cy="48" rx="36" ry="9" transform="rotate(-14 58 48)" stroke={cosmos.lavender} strokeOpacity=".55" strokeWidth="2" /><circle cx="96" cy="26" r="4" fill={cosmos.cyan} /></Frame>;
}

export function SatelliteArt(p: Props) {
  return (
    <Frame {...p}>{dust}
      <circle cx="40" cy="54" r="15" fill={cosmos.nebula} opacity=".85" />
      <ellipse cx="40" cy="54" rx="44" ry="20" transform="rotate(-18 40 54)" stroke={cosmos.cyan} strokeOpacity=".35" strokeDasharray="3 4" />
      <g transform="translate(82 26) rotate(-18)">
        <rect x="-4" y="-5" width="8" height="10" rx="2" fill={cosmos.lavender} />
        <rect x="-18" y="-3" width="12" height="6" fill={cosmos.cyan} opacity=".8" /><rect x="6" y="-3" width="12" height="6" fill={cosmos.cyan} opacity=".8" />
        <line x1="0" y1="-5" x2="0" y2="-11" stroke={cosmos.lavender} /><circle cx="0" cy="-12" r="1.6" fill={cosmos.sun} />
      </g>
    </Frame>
  );
}

export function StarsArt(p: Props) {
  return <Frame {...p}>{dust}<path d={star(60, 44, 16)} fill={cosmos.sun} /><circle cx="60" cy="44" r="22" fill={cosmos.sun} opacity=".12" /><path d={star(28, 28, 6)} fill={cosmos.dust} opacity=".6" /><path d={star(92, 62, 7)} fill={cosmos.dust} opacity=".6" /><circle cx="30" cy="66" r="2" fill={cosmos.dust} /><circle cx="94" cy="24" r="2" fill={cosmos.dust} /></Frame>;
}

export function CometArt(p: Props) {
  return (
    <Frame {...p}>{dust}
      <defs><linearGradient id="comet-tail" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={cosmos.cyan} stopOpacity="0" /><stop offset="1" stopColor={cosmos.cyan} stopOpacity=".7" /></linearGradient></defs>
      <path d="M14 70 Q50 52 84 30 L88 36 Q54 58 14 70Z" fill="url(#comet-tail)" />
      <circle cx="88" cy="31" r="7" fill={cosmos.lavender} /><circle cx="88" cy="31" r="12" fill={cosmos.cyan} opacity=".18" />
    </Frame>
  );
}

export function OrbitWeekArt(p: Props) {
  return (
    <Frame {...p}>{dust}
      <ellipse cx="60" cy="46" rx="46" ry="22" stroke={cosmos.lavender} strokeOpacity=".35" strokeDasharray="2 4" />
      <circle cx="60" cy="46" r="8" fill={cosmos.sun} />
      {Array.from({ length: 7 }, (_, i) => { const a = (i / 7) * Math.PI * 2 - 1.2; return <circle key={i} cx={60 + 46 * Math.cos(a)} cy={46 + 22 * Math.sin(a)} r={i === 2 ? 4 : 2.4} fill={i === 2 ? cosmos.cyan : cosmos.lavender} opacity={i === 2 ? 1 : 0.6} />; })}
    </Frame>
  );
}

export function StationArt(p: Props) {
  return (
    <Frame {...p}>{dust}
      <ellipse cx="60" cy="46" rx="34" ry="12" stroke={cosmos.lavender} strokeOpacity=".6" strokeWidth="3" />
      <rect x="54" y="30" width="12" height="30" rx="4" fill={cosmos.nebula} />
      <rect x="24" y="42" width="16" height="8" fill={cosmos.cyan} opacity=".75" /><rect x="80" y="42" width="16" height="8" fill={cosmos.cyan} opacity=".75" />
      <circle cx="60" cy="38" r="2" fill={cosmos.sun} /><circle cx="60" cy="47" r="2" fill={cosmos.sun} opacity=".7" />
    </Frame>
  );
}

export function TelescopeArt(p: Props) {
  return (
    <Frame {...p}>{dust}
      <g transform="rotate(-28 50 56)"><rect x="30" y="50" width="44" height="10" rx="4" fill={cosmos.lavender} /><rect x="72" y="48" width="10" height="14" rx="2" fill={cosmos.nebula} /></g>
      <line x1="48" y1="62" x2="38" y2="82" stroke={cosmos.dust} strokeWidth="2" /><line x1="52" y1="62" x2="62" y2="82" stroke={cosmos.dust} strokeWidth="2" />
      <path d={star(98, 18, 7)} fill={cosmos.sun} /><line x1="80" y1="34" x2="94" y2="22" stroke={cosmos.sun} strokeOpacity=".35" strokeDasharray="2 3" />
    </Frame>
  );
}

export function LaunchWindowArt(p: Props) {
  return (
    <Frame {...p}>{dust}
      <path d="M20 20h8M20 20v8M100 20h-8M100 20v8M20 76h8M20 76v-8M100 76h-8M100 76v-8" stroke={cosmos.sun} strokeWidth="2" strokeLinecap="round" />
      <path d="M60 22c7 6 10 16 10 28H50c0-12 3-22 10-28Z" fill={cosmos.lavender} />
      <circle cx="60" cy="38" r="3.5" fill={cosmos.cyan} />
      <path d="M50 50l-6 8h6M70 50l6 8h-6" fill={cosmos.nebula} />
      <path d="M55 52c0 8 5 14 5 14s5-6 5-14Z" fill={cosmos.sun} opacity=".85" />
    </Frame>
  );
}

export function LogbookArt(p: Props) {
  return (
    <Frame {...p}>{dust}
      <rect x="34" y="18" width="52" height="58" rx="5" fill={cosmos.nebula} />
      <rect x="40" y="18" width="46" height="58" rx="4" fill="#A78BFA" />
      <path d={star(63, 40, 8)} fill={cosmos.sun} />
      <line x1="50" y1="58" x2="76" y2="58" stroke={cosmos.space} strokeOpacity=".5" strokeWidth="2" /><line x1="50" y1="65" x2="70" y2="65" stroke={cosmos.space} strokeOpacity=".5" strokeWidth="2" />
    </Frame>
  );
}

export function SignalArt(p: Props) {
  return (
    <Frame {...p}>{dust}
      <path d="M44 76l16-34 16 34" stroke={cosmos.lavender} strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="60" cy="38" r="5" fill={cosmos.cyan} />
      {[14, 24, 34].map((r, i) => <path key={r} d={`M${60 - r} ${38 - r * 0.6}A${r} ${r} 0 0 1 ${60 + r} ${38 - r * 0.6}`} stroke={cosmos.cyan} strokeOpacity={0.7 - i * 0.2} strokeWidth="2" />)}
    </Frame>
  );
}

export function EclipseArt(p: Props) {
  return <Frame {...p}>{dust}<circle cx="60" cy="45" r="24" fill={cosmos.sun} opacity=".2" /><circle cx="60" cy="45" r="18" fill={cosmos.sun} /><circle cx="68" cy="41" r="17" fill={cosmos.space} stroke={cosmos.lavender} strokeOpacity=".3" /></Frame>;
}

export function AsteroidsArt(p: Props) {
  const rocks: [number, number, number][] = [[18, 56, 4], [32, 48, 3], [46, 52, 5], [62, 44, 3], [76, 48, 4], [90, 40, 3], [104, 44, 4]];
  return <Frame {...p}>{dust}<path d="M8 62 Q60 30 114 46" stroke={cosmos.dust} strokeOpacity=".3" strokeDasharray="2 4" />{rocks.map(([x, y, r], i) => <ellipse key={i} cx={x} cy={y} rx={r + 1} ry={r} transform={`rotate(${i * 25} ${x} ${y})`} fill={cosmos.dust} opacity=".75" />)}</Frame>;
}

export function FuelArt(p: Props) {
  return (
    <Frame {...p}>{dust}
      <rect x="44" y="20" width="32" height="54" rx="8" stroke={cosmos.lavender} strokeWidth="2.5" />
      <rect x="52" y="14" width="16" height="7" rx="2" fill={cosmos.lavender} />
      <rect x="48" y="44" width="24" height="26" rx="5" fill={cosmos.aurora} />
      <rect x="48" y="40" width="24" height="3" rx="1.5" fill={cosmos.aurora} opacity=".5" />
    </Frame>
  );
}

export function LifeSupportArt(p: Props) {
  return (
    <Frame {...p}>{dust}
      <circle cx="60" cy="44" r="26" stroke={cosmos.lavender} strokeWidth="3" />
      <path d="M40 40a20 16 0 0 1 40 0v4H40Z" fill={cosmos.cyan} opacity=".3" />
      <path d="M30 56h14l5-10 7 18 6-14 4 6h24" stroke={cosmos.aurora} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

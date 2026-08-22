'use client';

import { motion } from 'motion/react';

export interface ConstellationPillar {
  id: string;
  name: string;
  icon: string;
  /** Tailwind-agnostic color token key, resolved by the caller (e.g. 'stellar', 'critical'). */
  colorHex: string;
  /** 0–100. Drives how bright/large the star is — a dim star is a pillar asking for attention. */
  strength: number;
}

interface PillarConstellationProps {
  pillars: ConstellationPillar[];
  onSelect?: (id: string) => void;
}

// Fixed layout — 6 points loosely tracing a hexagon/dipper shape rather than a
// perfect polygon, so it reads as a constellation rather than a logo.
const POSITIONS = [
  { x: 60, y: 92 },
  { x: 168, y: 40 },
  { x: 300, y: 64 },
  { x: 420, y: 30 },
  { x: 540, y: 88 },
  { x: 640, y: 56 },
];

// Small fixed scatter of background stars, purely decorative — hardcoded (not
// Math.random) so server/client markup always matches.
const BACKDROP_STARS = [
  { x: 24, y: 20, r: 1 }, { x: 110, y: 130, r: 1.2 }, { x: 210, y: 15, r: 0.8 },
  { x: 260, y: 120, r: 1 }, { x: 350, y: 100, r: 1.4 }, { x: 390, y: 140, r: 0.8 },
  { x: 470, y: 120, r: 1 }, { x: 510, y: 25, r: 0.9 }, { x: 590, y: 130, r: 1.2 },
  { x: 620, y: 15, r: 0.8 }, { x: 690, y: 90, r: 1 }, { x: 720, y: 40, r: 1.3 },
  { x: 15, y: 140, r: 0.9 }, { x: 750, y: 120, r: 1 },
];

export function PillarConstellation({ pillars, onSelect }: PillarConstellationProps) {
  const points = pillars.slice(0, 6).map((p, i) => ({ ...p, ...POSITIONS[i] }));

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-border/50 bg-gradient-to-b from-card/60 to-background/40 py-3">
      <svg viewBox="0 0 800 160" className="w-full h-[120px] sm:h-[140px]" preserveAspectRatio="xMidYMid meet">
        {BACKDROP_STARS.map((s, i) => (
          <motion.circle
            key={i}
            cx={s.x} cy={s.y} r={s.r}
            fill="currentColor"
            className="text-muted-foreground/40"
            animate={{ opacity: [0.15, 0.6, 0.15] }}
            transition={{ duration: 3 + (i % 4), repeat: Infinity, delay: (i * 0.4) % 3, ease: 'easeInOut' }}
          />
        ))}

        {points.map((p, i) => {
          if (i === points.length - 1) return null;
          const next = points[i + 1];
          return (
            <motion.line
              key={`line-${p.id}`}
              x1={p.x} y1={p.y} x2={next.x} y2={next.y}
              stroke="url(#constellation-gradient)"
              strokeWidth={1}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.5 }}
              transition={{ duration: 1.2, delay: i * 0.15, ease: 'easeOut' }}
            />
          );
        })}

        <defs>
          <linearGradient id="constellation-gradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.2" />
          </linearGradient>
          {points.map(p => (
            <radialGradient key={`glow-${p.id}`} id={`glow-${p.id}`}>
              <stop offset="0%" stopColor={p.colorHex} stopOpacity="0.55" />
              <stop offset="100%" stopColor={p.colorHex} stopOpacity="0" />
            </radialGradient>
          ))}
        </defs>

        {points.map((p, i) => {
          const radius = 3 + (p.strength / 100) * 4;
          return (
            <g
              key={p.id}
              className={onSelect ? 'cursor-pointer' : undefined}
              onClick={() => onSelect?.(p.id)}
            >
              <circle cx={p.x} cy={p.y} r={radius * 4} fill={`url(#glow-${p.id})`} />
              <motion.circle
                cx={p.x} cy={p.y} r={radius}
                fill={p.colorHex}
                animate={{ opacity: [0.7, 1, 0.7], scale: [1, 1.12, 1] }}
                transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.3, ease: 'easeInOut' }}
              />
            </g>
          );
        })}
      </svg>

      <div className="pointer-events-none absolute inset-0 grid grid-cols-6 px-2 sm:px-4">
        {points.map(p => (
          <div key={`label-${p.id}`} className="flex flex-col items-center justify-end pb-1">
            <span className="text-xs sm:text-[10px] text-muted-foreground/70 text-center leading-tight">
              {p.icon}
              <span className="hidden sm:inline"> {p.name.split(' ')[0].split('/')[0]}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

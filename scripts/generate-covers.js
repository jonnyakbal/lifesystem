// One-off generator for space-themed project cover placeholders (SVG).
// Run: node scripts/generate-covers.js
// Output: public/covers/<id>.svg — referenced by data/projects.json's coverUrl.
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'public', 'covers');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const W = 400, H = 180;

// Deterministic pseudo-random so every regeneration is stable (no visual diff noise).
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function starfield(rand, count, opts = {}) {
  const { minR = 0.5, maxR = 1.6, area = [0, 0, W, H] } = opts;
  let out = '';
  for (let i = 0; i < count; i++) {
    const x = (area[0] + rand() * (area[2] - area[0])).toFixed(1);
    const y = (area[1] + rand() * (area[3] - area[1])).toFixed(1);
    const r = (minR + rand() * (maxR - minR)).toFixed(2);
    const op = (0.25 + rand() * 0.65).toFixed(2);
    const dur = (2 + rand() * 3).toFixed(1);
    const delay = (rand() * 3).toFixed(1);
    out += `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${op}">
      <animate attributeName="opacity" values="${op};${(op * 0.25).toFixed(2)};${op}" dur="${dur}s" begin="${delay}s" repeatCount="indefinite" />
    </circle>\n`;
  }
  return out;
}

function base(seed, bgFrom, bgTo, glowColor, content, { nebula = true } = {}) {
  const rand = mulberry32(seed);
  const stars = starfield(rand, 26);
  const nebulaBlob = nebula
    ? `<ellipse cx="${(rand() * W).toFixed(0)}" cy="${(rand() * H).toFixed(0)}" rx="160" ry="70" fill="${glowColor}" opacity="0.12" filter="url(#blur)" />`
    : '';
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bgFrom}" />
      <stop offset="100%" stop-color="${bgTo}" />
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${glowColor}" stop-opacity="0.55" />
      <stop offset="100%" stop-color="${glowColor}" stop-opacity="0" />
    </radialGradient>
    <filter id="blur" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="18" />
    </filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)" />
  ${nebulaBlob}
  ${stars}
  ${content}
</svg>`;
}

// ─── Icon builders (all centered around cx,cy unless noted) ──────────────────

function rocket(cx, cy, scale, color, accent) {
  return `<g transform="translate(${cx} ${cy}) scale(${scale}) rotate(-28)">
    <circle cx="0" cy="0" r="46" fill="url(#glow)" />
    <path d="M0,-46 C16,-30 20,-6 20,18 L-20,18 C-20,-6 -16,-30 0,-46 Z" fill="${color}" />
    <path d="M-20,18 L-34,34 L-14,26 Z" fill="${accent}" />
    <path d="M20,18 L34,34 L14,26 Z" fill="${accent}" />
    <circle cx="0" cy="-6" r="8" fill="#0f1020" opacity="0.55" />
    <path d="M-10,18 L0,40 L10,18 Z" fill="#fbbf24">
      <animate attributeName="d" values="M-10,18 L0,40 L10,18 Z;M-10,18 L0,50 L10,18 Z;M-10,18 L0,40 L10,18 Z" dur="0.6s" repeatCount="indefinite" />
    </path>
  </g>`;
}

function ufo(cx, cy, scale, color, accent) {
  return `<g transform="translate(${cx} ${cy}) scale(${scale})">
    <circle cx="0" cy="-6" r="50" fill="url(#glow)" />
    <ellipse cx="0" cy="-4" rx="17" ry="14" fill="${accent}" opacity="0.9" />
    <ellipse cx="0" cy="8" rx="42" ry="11" fill="${color}" />
    <ellipse cx="0" cy="8" rx="42" ry="11" fill="none" stroke="${accent}" stroke-width="1.5" opacity="0.6" />
    <circle cx="-20" cy="9" r="2.4" fill="#fff" opacity="0.9" />
    <circle cx="0" cy="12" r="2.4" fill="#fff" opacity="0.9" />
    <circle cx="20" cy="9" r="2.4" fill="#fff" opacity="0.9" />
    <path d="M-14,17 L14,17 L24,44 L-24,44 Z" fill="${accent}" opacity="0.16">
      <animate attributeName="opacity" values="0.1;0.22;0.1" dur="2s" repeatCount="indefinite" />
    </path>
  </g>`;
}

function mothership(cx, cy, scale, color, accent) {
  return `<g transform="translate(${cx} ${cy}) scale(${scale})">
    <ellipse cx="0" cy="0" rx="70" ry="30" fill="url(#glow)" />
    <ellipse cx="0" cy="-4" rx="64" ry="18" fill="${color}" />
    <ellipse cx="0" cy="-14" rx="26" ry="12" fill="${accent}" opacity="0.85" />
    <ellipse cx="0" cy="-4" rx="64" ry="18" fill="none" stroke="${accent}" stroke-width="1.2" opacity="0.5" />
    <circle cx="-38" cy="-2" r="2" fill="#fff" opacity="0.9" />
    <circle cx="-14" cy="2" r="2" fill="#fff" opacity="0.9" />
    <circle cx="14" cy="2" r="2" fill="#fff" opacity="0.9" />
    <circle cx="38" cy="-2" r="2" fill="#fff" opacity="0.9" />
    <path d="M-30,12 L30,12 L44,40 L-44,40 Z" fill="${accent}" opacity="0.3">
      <animate attributeName="opacity" values="0.18;0.4;0.18" dur="2.4s" repeatCount="indefinite" />
    </path>
    <circle cx="80" cy="-30" r="5" fill="${accent}" opacity="0.8" />
    <circle cx="-88" cy="20" r="4" fill="${accent}" opacity="0.6" />
  </g>`;
}

function planetOrbit(cx, cy, scale, color, accent) {
  return `<g transform="translate(${cx} ${cy}) scale(${scale})">
    <circle cx="0" cy="0" r="50" fill="url(#glow)" />
    <circle cx="0" cy="0" r="26" fill="${color}" />
    <path d="M-26,-6 A26,10 0 0 0 26,-6" fill="none" stroke="${accent}" stroke-width="2" opacity="0.5" />
    <ellipse cx="0" cy="0" rx="44" ry="15" fill="none" stroke="${accent}" stroke-width="1.6" opacity="0.7" transform="rotate(-14)" />
    <circle r="3" fill="${accent}">
      <animateMotion dur="6s" repeatCount="indefinite" path="M0,0 A44,15 0 1 1 0,0.01" />
    </circle>
    <circle r="2.2" fill="#fff" opacity="0.9">
      <animateMotion dur="9s" repeatCount="indefinite" path="M0,0 A60,22 0 1 1 0.01,0" />
    </circle>
  </g>`;
}

function alienBoombox(cx, cy, scale, color, accent) {
  return `<g transform="translate(${cx} ${cy}) scale(${scale})">
    <circle cx="-16" cy="-6" r="42" fill="url(#glow)" />
    <ellipse cx="-16" cy="-10" rx="17" ry="20" fill="${color}" />
    <ellipse cx="-23" cy="-14" rx="5" ry="7" fill="#0f1020" />
    <ellipse cx="-9" cy="-14" rx="5" ry="7" fill="#0f1020" />
    <path d="M-16,-30 L-24,-42 M-16,-30 L-8,-42" stroke="${color}" stroke-width="2.5" stroke-linecap="round" />
    <circle cx="-24" cy="-43" r="2.4" fill="${accent}" />
    <circle cx="-8" cy="-43" r="2.4" fill="${accent}" />
    <rect x="14" y="-14" width="42" height="26" rx="4" fill="${accent}" />
    <circle cx="24" cy="0" r="7" fill="#0f1020" opacity="0.6" />
    <circle cx="46" cy="0" r="7" fill="#0f1020" opacity="0.6" />
    <path d="M60,-10 Q70,-2 60,6" stroke="${accent}" stroke-width="2" fill="none" opacity="0.8">
      <animate attributeName="opacity" values="0.3;0.9;0.3" dur="1.2s" repeatCount="indefinite" />
    </path>
    <path d="M66,-16 Q80,-2 66,12" stroke="${accent}" stroke-width="2" fill="none" opacity="0.5">
      <animate attributeName="opacity" values="0.15;0.6;0.15" dur="1.2s" begin="0.3s" repeatCount="indefinite" />
    </path>
  </g>`;
}

function vinylDisc(cx, cy, scale, color, accent) {
  return `<g transform="translate(${cx} ${cy}) scale(${scale})">
    <circle cx="0" cy="0" r="52" fill="url(#glow)" />
    <circle cx="0" cy="0" r="42" fill="${color}" />
    <circle cx="0" cy="0" r="34" fill="none" stroke="${accent}" stroke-width="1.2" opacity="0.5" />
    <circle cx="0" cy="0" r="26" fill="none" stroke="${accent}" stroke-width="1.2" opacity="0.5" />
    <circle cx="0" cy="0" r="18" fill="none" stroke="${accent}" stroke-width="1.2" opacity="0.5" />
    <circle cx="0" cy="0" r="9" fill="${accent}" />
    <circle cx="0" cy="0" r="2.6" fill="#0f1020" />
    <g opacity="0.9">
      <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="8s" repeatCount="indefinite" />
      <circle cx="34" cy="0" r="2.2" fill="#fff" />
    </g>
  </g>`;
}

function heartOrbit(cx, cy, scale, color, accent) {
  return `<g transform="translate(${cx} ${cy}) scale(${scale})">
    <circle cx="0" cy="0" r="48" fill="url(#glow)" />
    <circle cx="-13" cy="0" r="14" fill="${color}" opacity="0.9" />
    <circle cx="13" cy="0" r="14" fill="${accent}" opacity="0.9" />
    <ellipse cx="0" cy="0" rx="42" ry="16" fill="none" stroke="${accent}" stroke-width="1.4" opacity="0.55" transform="rotate(-10)" />
    <path d="M0,-30 C10,-40 26,-34 26,-20 C26,-6 10,4 0,16 C-10,4 -26,-6 -26,-20 C-26,-34 -10,-40 0,-30 Z"
      fill="none" stroke="#fff" stroke-width="1.6" opacity="0.75" />
  </g>`;
}

function gradCapSatellite(cx, cy, scale, color, accent) {
  return `<g transform="translate(${cx} ${cy}) scale(${scale})">
    <circle cx="0" cy="8" r="30" fill="url(#glow)" />
    <circle cx="0" cy="8" r="20" fill="${color}" />
    <g transform="translate(-6 -30) rotate(-18)">
      <polygon points="0,-10 34,0 0,10 -34,0" fill="${accent}" />
      <rect x="-6" y="9" width="12" height="10" fill="${accent}" />
      <line x1="20" y1="4" x2="20" y2="22" stroke="${accent}" stroke-width="2" />
      <circle cx="20" cy="24" r="2.4" fill="${accent}" />
    </g>
    <ellipse cx="0" cy="8" rx="40" ry="12" fill="none" stroke="${accent}" stroke-width="1.3" opacity="0.5" transform="rotate(8 0 8)" />
  </g>`;
}

// ─── Project → cover config ───────────────────────────────────────────────────

const covers = [
  {
    file: 'project-dona-maria',
    seed: 101, from: '#1a0f2e', to: '#0c0716', glow: '#f472b6',
    icon: (c) => alienBoombox(200 + 30, 96, 1.05, '#22c55e', '#f472b6'),
  },
  {
    file: 'project-arco-pass',
    seed: 202, from: '#0b1330', to: '#050814', glow: '#8b5cf6',
    icon: () => rocket(190, 100, 1.1, '#e5e7eb', '#8b5cf6'),
  },
  {
    file: 'project-arco-labs',
    seed: 303, from: '#0a1a2e', to: '#050b16', glow: '#3b82f6',
    icon: () => ufo(200, 88, 1.15, '#94a3b8', '#3b82f6'),
  },
  {
    file: 'project-navemae',
    seed: 404, from: '#0d1a12', to: '#04100a', glow: '#22c55e',
    icon: () => mothership(200, 80, 1.25, '#475569', '#4ade80'),
  },
  {
    file: 'project-orbita',
    seed: 505, from: '#0a1730', to: '#040a18', glow: '#06b6d4',
    icon: () => planetOrbit(200, 92, 1.15, '#0891b2', '#06b6d4'),
  },
  {
    file: 'project-rataria',
    seed: 606, from: '#1c0f12', to: '#0e0608', glow: '#f59e0b',
    icon: () => alienBoombox(180, 96, 1.15, '#22c55e', '#f59e0b'),
  },
  {
    file: 'project-atelie',
    seed: 707, from: '#1a0e22', to: '#0c0712', glow: '#ec4899',
    icon: () => heartOrbit(200, 92, 1.2, '#ec4899', '#a78bfa'),
  },
  {
    file: 'project-edital',
    seed: 808, from: '#150e24', to: '#080513', glow: '#eab308',
    icon: () => vinylDisc(200, 90, 1.1, '#1f1330', '#eab308'),
  },
  {
    file: '53274a55-21a4-4608-b1de-be166c3fb91e', // TCC - ADM UFSM
    seed: 909, from: '#0a1024', to: '#050712', glow: '#a78bfa',
    icon: () => gradCapSatellite(200, 92, 1.25, '#3b82f6', '#a78bfa'),
  },
];

for (const cfg of covers) {
  const svg = base(cfg.seed, cfg.from, cfg.to, cfg.glow, cfg.icon());
  fs.writeFileSync(path.join(OUT_DIR, `${cfg.file}.svg`), svg);
  console.log(`✅ ${cfg.file}.svg`);
}

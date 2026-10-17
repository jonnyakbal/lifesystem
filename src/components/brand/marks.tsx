// Single-colour versions of the approved "L solar" mark (public/icons/solar.svg)
// for places where the full-colour icon does not fit: one-colour print,
// small UI sizes, light backgrounds. They follow the same geometry: the L
// (direction), the solar core (the centre, purpose) and one orbit.
export function SolarMono({ size = 64, color = 'currentColor', title }: { size?: number; color?: string; title?: string }) {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true} fill="none">
      <ellipse cx="280" cy="232" rx="172" ry="104" transform="rotate(28 280 232)" stroke={color} strokeOpacity=".45" strokeWidth="14" />
      <circle cx="280" cy="232" r="56" fill={color} />
      <circle cx="430" cy="312" r="18" fill={color} />
      <path d="M126 126v214c0 38 23 61 62 61h128" stroke={color} strokeWidth="52" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 16-32 px: only the L and the core survive at that size. */
export function SolarGlyph({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} aria-hidden="true" fill="none">
      <circle cx="320" cy="210" r="88" fill={color} />
      <path d="M140 110v240c0 40 24 64 64 64h170" stroke={color} strokeWidth="80" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark({ className = '' }: { className?: string }) {
  return <span className={`font-display uppercase tracking-[0.22em] ${className}`}>Lifesystem</span>;
}

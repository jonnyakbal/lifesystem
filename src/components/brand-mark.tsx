import type { SVGProps } from 'react';

/** The LIFESYSTEM mark: an orbital L that represents direction, motion and a
 * small system of connected parts. It stays crisp at favicon and UI sizes. */
export function BrandMark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" className={className} {...props}>
      <image href="/icons/solar.svg" width="64" height="64" />
      {/* The external SVG isolates gradient IDs across repeated marks. */}
    </svg>
  );
}

import type { SVGProps } from 'react';

// Sprites 16×16 desenhados à mão para o visual Retrô. Cada caractere é um pixel:
// "." vazio, "a" cor de ação, "b" acento, "c" texto, "d" brilho.
const sprites = {
  planet: [
    '................',
    '.....aaaaaa.....',
    '...aaaaaaaaaa...',
    '..aadaaaaaaaaa..',
    '..adaaaaaaaaaa..',
    'bbbbbbbbbbbbbbbb',
    '.aaaaaaaaaaaaab.',
    '.aaaaaaaaaaaab..',
    '.aaaaaaaaaaaba..',
    '.bbbbbbbbbbbaa..',
    'b.aaaaaaaaaaa...',
    '..aaaaaaaaaaa...',
    '...aaaaaaaaa....',
    '.....aaaaa......',
    '................',
    '................',
  ],
  rocket: [
    '.......dd.......',
    '......dccd......',
    '......cccc......',
    '.....cccccc.....',
    '.....ccaacc.....',
    '.....caaaac.....',
    '.....ccaacc.....',
    '.....cccccc.....',
    '....bcccccb.....',
    '...bbcccccbb....',
    '...bb.cccc.bb...',
    '......b..b......',
    '.....d.dd.d.....',
    '......d..d......',
    '.......dd.......',
    '................',
  ],
  star: [
    '.......a........',
    '.......a........',
    '......aaa.......',
    '......ada.......',
    'aaaaaaadaaaaaaa.',
    '.aaaaaddaaaaaa..',
    '...aaadddaaa....',
    '....aaaaaaa.....',
    '....aaa.aaa.....',
    '...aaa...aaa....',
    '...aa.....aa....',
    '..a.........a...',
    '................',
    '................',
    '................',
    '................',
  ],
} as const;

export type SpriteName = keyof typeof sprites;
const fills: Record<string, string> = { a: 'var(--color-primary)', b: 'var(--color-stellar)', c: 'var(--color-foreground)', d: 'var(--retro-glow, #fff6b0)' };

export function PixelSprite({ name, className, ...props }: { name: SpriteName } & SVGProps<SVGSVGElement>) {
  const rects: React.ReactElement[] = [];
  sprites[name].forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== '.') rects.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={fills[ch]} />);
  }));
  return <svg viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true" className={className} {...props}>{rects}</svg>;
}

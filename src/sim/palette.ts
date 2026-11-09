import { cssVar } from '../app/theme.svelte';

/** Resolved theme colours for canvas drawing (canvas can't use CSS variables directly). */
export interface Palette {
  bg: string;
  surface: string;
  ink: string;
  text2: string;
  text3: string;
  grid: string;
  gridStrong: string;
  accent: string;
  accentSoft: string;
  positive: string;
  negative: string;
  hl: string;
  series: string[];
  dark: boolean;
}

export function readPalette(): Palette {
  const v = (n: string) => cssVar(n);
  const bg = v('--canvas-bg');
  return {
    bg,
    surface: v('--surface'),
    ink: v('--ink'),
    text2: v('--text-2'),
    text3: v('--text-3'),
    grid: v('--grid'),
    gridStrong: v('--grid-strong'),
    accent: v('--accent'),
    accentSoft: v('--accent-soft'),
    positive: v('--positive'),
    negative: v('--negative'),
    hl: v('--hl'),
    series: [1, 2, 3, 4, 5, 6].map((i) => v(`--series-${i}`)),
    dark: isDark(bg),
  };
}

function isDark(color: string): boolean {
  const m = color.match(/^#([0-9a-f]{6})$/i);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const lum = 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
  return lum < 128;
}

/** Hex colour with alpha (0–1) → rgba() string. */
export function alpha(hex: string, a: number): string {
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

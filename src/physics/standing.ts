/**
 * Standing waves.
 *  String fixed at both ends (length L, speed v = √(T/μ)): f_n = n v / 2L, shape sin(nπx/L).
 *  Pipe open at both ends: f_n = n v / 2L; displacement ∝ cos(nπx/L) (antinodes at the open ends),
 *    pressure variation ∝ sin(nπx/L) (nodes at the open ends).
 *  Pipe open at x = 0 and closed at x = L: f_n = (2n − 1) v / 4L (odd harmonics only);
 *    displacement ∝ cos((2n − 1)πx/2L) (node at the closed end), pressure ∝ sin((2n − 1)πx/2L).
 *  A standing wave is the sum of two equal waves travelling in opposite directions:
 *    A sin(ωt − kx) + A sin(ωt + kx) = 2A cos(kx) sin(ωt).
 */
export type PipeKind = 'open' | 'closed';

export const stringFreq = (n: number, L: number, v: number) => (n * v) / (2 * L);

export function pipeFreq(kind: PipeKind, n: number, L: number, v: number): number {
  return kind === 'open' ? (n * v) / (2 * L) : ((2 * n - 1) * v) / (4 * L);
}

export const stringShape = (n: number, x: number, L: number) => Math.sin((n * Math.PI * x) / L);

export function pipeDisplacement(kind: PipeKind, n: number, x: number, L: number): number {
  return kind === 'open' ? Math.cos((n * Math.PI * x) / L) : Math.cos(((2 * n - 1) * Math.PI * x) / (2 * L));
}
export function pipePressure(kind: PipeKind, n: number, x: number, L: number): number {
  return kind === 'open' ? Math.sin((n * Math.PI * x) / L) : Math.sin(((2 * n - 1) * Math.PI * x) / (2 * L));
}

/** nodes of a string harmonic: x = mL/n, m = 0…n */
export const stringNodes = (n: number, L: number) => Array.from({ length: n + 1 }, (_, m) => (m * L) / n);

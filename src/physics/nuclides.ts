/**
 * E.3 (extra) Nuclide chart and decay modes, from NUBASE2020 ground states.
 *
 * Each decay changes (Z, N) in a fixed way, conserving nucleon number and charge:
 *   α:        (Z, N) → (Z − 2, N − 2)  + ⁴₂He
 *   β⁻:       (Z, N) → (Z + 1, N − 1)  + e⁻ + antineutrino
 *   β⁺ / EC:  (Z, N) → (Z − 1, N + 1)  + e⁺ + neutrino (or an electron captured)
 *   γ:        same (Z, N), the nucleus only loses energy
 * Decay chains follow the main (first listed) mode until a stable nuclide is reached.
 */
import { A as NA, Z as NZ, LOGT, MODES, MODE } from '../data/nubase2020';

export interface NuclideInfo {
  Z: number;
  N: number;
  A: number;
  logT: number; // log10(half-life/s), 99 = stable
  mode: string;
}

export const ALL: NuclideInfo[] = NA.map((a, i) => ({ Z: NZ[i], N: a - NZ[i], A: a, logT: LOGT[i], mode: MODES[MODE[i]] }));
const idx = new Map<number, NuclideInfo>();
for (const n of ALL) idx.set(n.Z * 1000 + n.N, n);
export const get = (Z: number, N: number) => idx.get(Z * 1000 + N);
export const isStable = (n: NuclideInfo) => n.logT >= 99;

/** change of (Z, N) for a decay mode, or null if the mode does not lead to a single daughter */
export function shift(mode: string): [number, number] | null {
  switch (mode) {
    case 'A':
      return [-2, -2];
    case 'B-':
      return [1, -1];
    case 'B+':
    case 'EC':
      return [-1, 1];
    case '2B-':
      return [2, -2];
    case 'p':
      return [-1, 0];
    case '2p':
      return [-2, 0];
    case '3p':
      return [-3, 0];
    case 'n':
      return [0, -1];
    case '2n':
      return [0, -2];
    default:
      return null; // stable, SF (fission: many possible products)
  }
}

export function daughter(n: NuclideInfo): NuclideInfo | undefined {
  const s = shift(n.mode);
  return s ? get(n.Z + s[0], n.N + s[1]) : undefined;
}

/** follow the main decay mode until a stable (or unknown) nuclide; returns the whole chain */
export function chain(start: NuclideInfo, max = 60): NuclideInfo[] {
  const out = [start];
  let cur = start;
  for (let i = 0; i < max && !isStable(cur); i++) {
    const d = daughter(cur);
    if (!d) break;
    out.push(d);
    cur = d;
  }
  return out;
}

export const MODE_NAME: Record<string, string> = {
  stable: 'stable',
  A: 'α decay',
  'B-': 'β⁻ decay',
  'B+': 'β⁺ decay',
  EC: 'electron capture',
  '2B-': 'double β⁻ decay',
  SF: 'spontaneous fission',
  p: 'proton emission',
  '2p': 'two-proton emission',
  '3p': 'three-proton emission',
  n: 'neutron emission',
  '2n': 'two-neutron emission',
};

/** half-life in readable units */
export function formatHalfLife(logT: number): string {
  if (logT >= 99) return 'stable';
  const t = 10 ** logT;
  const units: [number, string][] = [
    [3.15576e16, 'billion years'],
    [3.15576e13, 'million years'],
    [3.15576e7, 'years'],
    [86400, 'days'],
    [3600, 'hours'],
    [60, 'minutes'],
    [1, 's'],
    [1e-3, 'ms'],
    [1e-6, 'µs'],
    [1e-9, 'ns'],
  ];
  for (const [f, name] of units) if (t >= f) return `${+(t / f).toPrecision(3)} ${name}`;
  return `${t.toExponential(2)} s`;
}

import type { NumberParamDef } from '../../sim/params.svelte';
import type { SimInfo } from '../../sim/types';
import type { ChannelDef } from '../../core/recorder';

/** Charges are stored in the URL as "x,y,q;x,y,q" with x, y in m and q in nC. */
export interface UiCharge {
  x: number;
  y: number;
  q: number; // nC
}

export function parseCharges(s: string): UiCharge[] {
  if (!s) return [];
  return s
    .split(';')
    .map((part) => part.split(',').map(Number))
    .filter((a) => a.length === 3 && a.every(Number.isFinite))
    .slice(0, 30)
    .map(([x, y, q]) => ({ x, y, q }));
}

export function formatCharges(c: UiCharge[]): string {
  return c.map((k) => `${+k.x.toFixed(2)},${+k.y.toFixed(2)},${+k.q.toFixed(1)}`).join(';');
}

export const defaults = {
  c: '-0.8,0,1;0.8,0,-1',
  plates: false,
  sigma: 1, // nC m^-2
  d: 1.2, // m
  w: 3.2, // m
  lines: true,
  equip: true,
  heat: false,
  vectors: false,
  grid: true,
  spacing: 5, // V
  probeE: false,
  probeV: false,
};
export type Params = typeof defaults;

export const sliders: NumberParamDef[] = [
  { key: 'q', label: 'Selected charge', symbol: 'q', unit: 'nC', min: -10, max: 10, step: 0.1 },
  { key: 'sigma', label: 'Surface charge density', symbol: 'σ', unit: 'nC m⁻²', min: 0.1, max: 5, step: 0.05 },
  { key: 'd', label: 'Plate separation', symbol: 'd', unit: 'm', min: 0.2, max: 2.4, step: 0.05 },
  { key: 'w', label: 'Plate width', unit: 'm', min: 0.5, max: 4.6, step: 0.1 },
  {
    key: 'spacing',
    label: 'Equipotential spacing',
    symbol: 'ΔV',
    unit: 'V',
    min: 1,
    max: 100,
    step: 1,
    log: true,
    hl: true,
  },
];

export const presets: { id: string; label: string; values: Partial<Params> }[] = [
  { id: 'single', label: 'Single positive charge', values: { c: '0,0,2', plates: false } },
  { id: 'dipole', label: 'Dipole', values: { c: '-0.8,0,1;0.8,0,-1', plates: false } },
  { id: 'like', label: 'Two like charges', values: { c: '-0.8,0,1;0.8,0,1', plates: false } },
  { id: 'unequal', label: 'Unequal charges (+2, −1)', values: { c: '-0.7,0,2;0.7,0,-1', plates: false } },
  {
    id: 'quadrupole',
    label: 'Quadrupole',
    values: { c: '-0.6,0.6,1;0.6,0.6,-1;0.6,-0.6,1;-0.6,-0.6,-1', plates: false },
  },
  {
    id: 'capacitor',
    label: 'Parallel plates (capacitor)',
    values: { c: '', plates: true, sigma: 1, d: 1.2, w: 3.2, spacing: 10 },
  },
  {
    id: 'capacitor-charge',
    label: 'Capacitor + point charge',
    values: { c: '0,0,0.5', plates: true, sigma: 1, d: 1.6, w: 3.6, spacing: 10 },
  },
];

/** Recorded probe readings (exported to CSV). */
export const channels: ChannelDef[] = [
  { key: 'n', label: 'reading', unit: '' },
  { key: 'x', label: 'x', unit: 'm' },
  { key: 'y', label: 'y', unit: 'm' },
  { key: 'E', label: 'E', unit: 'N C⁻¹' },
  { key: 'Ex', label: 'Ex', unit: 'N C⁻¹' },
  { key: 'Ey', label: 'Ey', unit: 'N C⁻¹' },
  { key: 'V', label: 'V', unit: 'V' },
];

export const info: SimInfo = {
  about: [
    'Every charge creates an electric field: the force per unit charge that a small positive test charge would feel. Field lines start on positive charges and end on negative charges; their direction at any point is the direction of the force on a positive charge.',
    'Equipotentials (HL) join points at the same electric potential. They are always perpendicular to the field lines, and the field is strongest where they are closest together, because E = −ΔV/Δr.',
    'Between two large parallel plates the field is uniform: the field lines are parallel and equally spaced, and E = V/d. Near the edges the field bulges outwards (the fringe field).',
    'Drag charges to move them. Use the probes to measure the field and potential anywhere, record readings and export them.',
  ],
  formulas: [
    { label: "Coulomb's law", tex: 'F = k\\dfrac{q_1 q_2}{r^{2}}, \\qquad k = \\dfrac{1}{4\\pi\\varepsilon_0}' },
    { label: 'Electric field strength', tex: 'E = \\dfrac{F}{q}' },
    { label: 'Field between parallel plates', tex: 'E = \\dfrac{V}{d}' },
    { label: 'Electric potential of a point charge', tex: 'V_e = \\dfrac{kQ}{r}', hl: true },
    { label: 'Field and potential gradient', tex: 'E = -\\dfrac{\\Delta V_e}{\\Delta r}', hl: true },
    { label: 'Electric potential energy', tex: 'E_p = k\\dfrac{q_1 q_2}{r}', hl: true },
    { label: 'Work done moving a charge', tex: 'W = q\\,\\Delta V_e', hl: true },
    { label: 'Field near a large charged plate', tex: 'E = \\dfrac{\\sigma}{\\varepsilon_0}\\ \\text{(between oppositely charged plates)}', beyond: true },
  ],
  assumptions: [
    'Charges are fixed point charges in a vacuum, all lying in the plane of the screen; the field shown is the true 3D Coulomb field in that plane.',
    'Because only one plane of a 3D field is drawn, the density of field lines is not exactly proportional to the field strength. Use the probe for values.',
    'Plates are uniformly charged strips that extend infinitely far into and out of the screen (a cross-section of a parallel-plate capacitor). Their charge does not redistribute (they are not modelled as conductors).',
    'Potential is zero at infinity. The potential colour map uses a non-linear (asinh) scale; vector arrows all have the same length, brightness shows field strength on a log scale.',
    'Numerics: field lines traced with adaptive RK45; equipotentials by marching squares on a grid (cells right next to a point charge are skipped).',
  ],
  tryThis: [
    'Place the voltage probe midway between a dipole: why is V = 0 there but E is not?',
    'In the capacitor preset, measure V at both plates and check E = V/d with the field probe.',
    'Double one charge and watch how the field lines rearrange.',
    'Record E at several distances from a single charge and plot E against 1/r² from the CSV.',
  ],
};

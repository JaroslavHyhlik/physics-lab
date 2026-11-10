import type { NumberParamDef } from '../../sim/params.svelte';
import type { GraphDef, Preset, SimInfo } from '../../sim/types';
import type { ChannelDef } from '../../core/recorder';
import { g } from '../../core/constants';
import { shapes } from '../../physics/rolling';

export const defaults = { theta: 20, L: 3, muS: 0.6, muD: 0.4, m: 2, r: 0.1, g, energy: true };
export type Params = typeof defaults;

export const sliders: NumberParamDef[] = [
  { key: 'theta', label: 'Angle of the slope', symbol: 'θ', unit: '°', min: 2, max: 60, step: 1 },
  { key: 'L', label: 'Length of the slope', symbol: 'L', unit: 'm', min: 0.5, max: 10, step: 0.1 },
  { key: 'muS', label: 'Static friction', symbol: 'μ_s', unit: '', min: 0, max: 1, step: 0.01 },
  { key: 'muD', label: 'Dynamic friction', symbol: 'μ_d', unit: '', min: 0, max: 1, step: 0.01 },
  { key: 'm', label: 'Mass (each object)', symbol: 'm', unit: 'kg', min: 0.1, max: 20, step: 0.1 },
  { key: 'r', label: 'Radius (each object)', symbol: 'r', unit: 'm', min: 0.02, max: 0.5, step: 0.01 },
  { key: 'g', label: 'Gravitational field strength', symbol: 'g', unit: 'm s⁻²', min: 1, max: 25, step: 0.01 },
];

export const presets: Preset<Params>[] = [
  { id: 'race', label: 'Classic race (20°)', values: { theta: 20, muS: 0.6, muD: 0.4 } },
  { id: 'steep', label: 'Steep and slippery: slipping', values: { theta: 50, muS: 0.2, muD: 0.15 } },
  { id: 'heavy', label: 'Heavier, bigger objects (same result!)', values: { m: 15, r: 0.4 } },
  { id: 'moon', label: 'On the Moon', values: { g: 1.62, theta: 20 } },
];

export const channels: ChannelDef[] = [
  { key: 't', label: 't', unit: 's' },
  ...shapes.map((s, i) => ({ key: s.id, label: `v (${s.label.split(' (')[0].toLowerCase()})`, unit: 'm s⁻¹', color: `--series-${i + 1}` })),
];

export const graphs: GraphDef[] = [{ id: 'v', title: 'Velocity v–t', series: shapes.map((s) => s.id) }];

export const info: SimInfo = {
  about: [
    'All the objects have the same mass and radius and start from rest at the same height, so they all lose the same gravitational potential energy. But a rolling object must share that energy between moving along (½mv²) and spinning (½Iω²).',
    'The larger the moment of inertia I compared with mr², the more energy goes into spinning and the less into speed: a hoop (all its mass at the rim) loses to a solid sphere (mass concentrated near the centre). A frictionless sliding block puts everything into ½mv² and wins.',
    'Mass and radius cancel out of a = g sinθ/(1 + I/mr²), so a heavier or bigger ball of the same shape finishes in exactly the same time.',
    'Rolling without slipping needs static friction. On a steep, slippery slope the friction needed is more than μ_s F_N: the objects slide while they turn, and some energy is lost as heat.',
  ],
  formulas: [
    { label: 'Moment of inertia', tex: 'I = \\Sigma mr^{2}', hl: true },
    { label: 'Rotational kinetic energy', tex: 'E_k = \\tfrac{1}{2}I\\omega^{2} = \\dfrac{L^{2}}{2I}', hl: true },
    { label: 'Rolling without slipping', tex: 'v = \\omega r', beyond: true },
    { label: 'Acceleration down the slope', tex: 'a = \\dfrac{g\\sin\\theta}{1 + I/mr^{2}}', beyond: true },
    { label: 'Energy at the bottom', tex: 'mgh = \\tfrac{1}{2}mv^{2} + \\tfrac{1}{2}I\\omega^{2}' },
    { label: 'Moments of inertia used', tex: 'I_{\\text{sphere}} = \\tfrac{2}{5}mr^{2},\\; I_{\\text{cyl}} = \\tfrac{1}{2}mr^{2},\\; I_{\\text{shell}} = \\tfrac{2}{3}mr^{2},\\; I_{\\text{hoop}} = mr^{2}', beyond: true },
  ],
  assumptions: [
    'Rigid, perfectly round objects; no rolling resistance and no air resistance; the block slides without friction.',
    'Static friction allows rolling without slipping when the friction needed is at most μ_s F_N; otherwise dynamic friction μ_d F_N acts while the object slips.',
    'Objects are drawn at a fixed size (not to scale); lanes are shown one above the other for clarity.',
    'Numerics: exact — each object has constant linear and angular acceleration.',
  ],
  tryThis: [
    'Predict the finishing order before you press play.',
    'Change the mass or radius: does the order or the time change?',
    'Make the slope steep and slippery: which objects start to slip first?',
    'Compare the energy bars: what fraction of the energy of the hoop is rotational?',
  ],
};

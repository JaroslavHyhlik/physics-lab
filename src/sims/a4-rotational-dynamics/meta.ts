import type { NumberParamDef } from '../../sim/params.svelte';
import type { GraphDef, Preset, SimInfo } from '../../sim/types';
import type { ChannelDef } from '../../core/recorder';
import { g } from '../../core/constants';

export const defaults = { I: 0.05, r: 0.02, m: 0.5, h: 1, tauF: 0, g };
export type Params = typeof defaults;

export const sliders: NumberParamDef[] = [
  { key: 'I', label: 'Moment of inertia of the flywheel', symbol: 'I', unit: 'kg m²', min: 0.001, max: 0.5, step: 0.001, log: true },
  { key: 'r', label: 'Radius of the axle', symbol: 'r', unit: 'm', min: 0.005, max: 0.1, step: 0.001 },
  { key: 'm', label: 'Hanging mass', symbol: 'm', unit: 'kg', min: 0.05, max: 5, step: 0.05 },
  { key: 'h', label: 'Height of fall', symbol: 'h', unit: 'm', min: 0.2, max: 2, step: 0.05 },
  { key: 'tauF', label: 'Friction torque in the bearing', symbol: 'τ_f', unit: 'N m', min: 0, max: 0.02, step: 0.0005, decimals: 4 },
  { key: 'g', label: 'Gravitational field strength', symbol: 'g', unit: 'm s⁻²', min: 1, max: 25, step: 0.01 },
];

export const presets: Preset<Params>[] = [
  { id: 'lab', label: 'Lab flywheel, no friction', values: { I: 0.05, r: 0.02, m: 0.5, h: 1, tauF: 0 } },
  { id: 'friction', label: 'With bearing friction', values: { I: 0.05, r: 0.02, m: 0.5, h: 1, tauF: 0.002 } },
  { id: 'wide', label: 'Wider axle', values: { I: 0.05, r: 0.05, m: 0.5, h: 1, tauF: 0 } },
  { id: 'light', label: 'Light wheel (almost free fall)', values: { I: 0.001, r: 0.05, m: 1, h: 1, tauF: 0 } },
];

export const channels: ChannelDef[] = [
  { key: 't', label: 't', unit: 's' },
  { key: 'v', label: 'v of the mass', unit: 'm s⁻¹', color: '--series-2' },
  { key: 'w', label: 'ω of the wheel', unit: 'rad s⁻¹', color: '--series-1' },
  { key: 'T', label: 'tension T', unit: 'N', color: '--series-3' },
  { key: 'Ep', label: 'Eₚ lost (mgh)', unit: 'J', color: '--series-5' },
  { key: 'Ekm', label: '½mv²', unit: 'J', color: '--series-2' },
  { key: 'Ekr', label: '½Iω²', unit: 'J', color: '--series-1' },
  { key: 'Q', label: 'heat', unit: 'J', color: '--series-4' },
];

export const graphs: GraphDef[] = [
  { id: 'w', title: 'Angular velocity ω–t', series: ['w'] },
  { id: 'v', title: 'Velocity of the mass', series: ['v'] },
  { id: 'E', title: 'Energy', series: ['Ep', 'Ekm', 'Ekr', 'Q'] },
  { id: 'T', title: 'Tension', series: ['T'] },
];

export const info: SimInfo = {
  about: [
    'Newton’s second law for rotation: a resultant torque τ gives an angular acceleration α = τ/I. Here the torque comes from the tension in the string, which pulls at the edge of the axle (τ = Tr).',
    'The falling mass and the wheel are linked by the string: a = αr. Writing F = ma for the mass and τ = Iα for the wheel gives a = mg/(m + I/r²) — the bigger the moment of inertia, the slower everything moves. The tension is less than the weight mg because the mass accelerates.',
    'The gravitational energy released, mgh, becomes kinetic energy of the mass (½mv²) and of the wheel (½Iω²), plus heat if the bearing has friction. Measure a (time the fall with the stopwatch, h with the ruler) to find I — a classic lab method.',
  ],
  formulas: [
    { label: "Newton's second law for rotation", tex: '\\tau = I\\alpha', hl: true },
    { label: 'Torque', tex: '\\tau = Fr\\sin\\theta', hl: true },
    { label: 'Rotational kinematics', tex: '\\omega_f = \\omega_i + \\alpha t, \\qquad \\Delta\\theta = \\omega_i t + \\tfrac{1}{2}\\alpha t^{2}', hl: true },
    { label: 'Rotational kinetic energy', tex: 'E_k = \\tfrac{1}{2}I\\omega^{2}', hl: true },
    { label: 'String on the axle', tex: 'a = \\alpha r', beyond: true },
    { label: 'Acceleration of the falling mass', tex: 'a = \\dfrac{mg}{m + I/r^{2}} \\quad (\\tau_f = 0)', beyond: true },
  ],
  assumptions: [
    'Light, inextensible string that does not slip on the axle; it comes off when the mass lands.',
    'Constant friction torque in the bearing; no air resistance.',
    'The wheel and axle are drawn schematically (not to scale).',
    'Numerics: exact — constant angular acceleration in each phase.',
  ],
  tryThis: [
    'Time the fall and use h = ½at² to find a, then find I from a = mg/(m + I/r²).',
    'Double the axle radius: does the mass fall faster or slower? Why?',
    'Add bearing friction: measure how quickly the wheel slows after the mass lands to find τ_f.',
  ],
};

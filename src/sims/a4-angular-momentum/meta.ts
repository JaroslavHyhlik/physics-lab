import type { NumberParamDef } from '../../sim/params.svelte';
import type { GraphDef, Preset, SimInfo } from '../../sim/types';
import type { ChannelDef } from '../../core/recorder';

export const defaults = {
  mode: 'spinner',
  I0: 2,
  sm: 3,
  w0: 2,
  r: 0.9,
  I1: 0.4,
  I2: 0.6,
  dw1: 10,
  tau: 0.5,
  Ip: 300,
  pm: 60,
  R: 2,
  u: 1.2,
};
export type Params = typeof defaults;

export const sliders: NumberParamDef[] = [
  { key: 'I0', label: 'Moment of inertia of person + chair', symbol: 'I₀', unit: 'kg m²', min: 0.5, max: 6, step: 0.1 },
  { key: 'sm', label: 'Mass in each hand', symbol: 'm', unit: 'kg', min: 0, max: 6, step: 0.1 },
  { key: 'w0', label: 'Starting angular velocity (arms out)', symbol: 'ω₀', unit: 'rad s⁻¹', min: 0.2, max: 6, step: 0.1 },
  { key: 'r', label: 'Arm radius (pull in / stretch out)', symbol: 'r', unit: 'm', min: 0.15, max: 0.9, step: 0.01 },
  { key: 'I1', label: 'Moment of inertia of disc 1', symbol: 'I₁', unit: 'kg m²', min: 0.05, max: 2, step: 0.01 },
  { key: 'I2', label: 'Moment of inertia of disc 2', symbol: 'I₂', unit: 'kg m²', min: 0.05, max: 2, step: 0.01 },
  { key: 'dw1', label: 'Angular velocity of disc 1', symbol: 'ω₁', unit: 'rad s⁻¹', min: 1, max: 20, step: 0.5 },
  { key: 'tau', label: 'Friction torque between the discs', symbol: 'τ', unit: 'N m', min: 0.05, max: 3, step: 0.05 },
  { key: 'Ip', label: 'Moment of inertia of the platform', symbol: 'I_p', unit: 'kg m²', min: 50, max: 1000, step: 10 },
  { key: 'pm', label: 'Mass of the person', symbol: 'm', unit: 'kg', min: 20, max: 120, step: 1 },
  { key: 'R', label: 'Radius of the platform', symbol: 'R', unit: 'm', min: 1, max: 3, step: 0.1 },
  { key: 'u', label: 'Walking speed (relative to the platform)', symbol: 'u', unit: 'm s⁻¹', min: -2, max: 2, step: 0.1 },
];

export const presets: Preset<Params>[] = [
  { id: 'spinner', label: 'Spinning chair with dumbbells', values: { mode: 'spinner', I0: 2, sm: 3, w0: 2, r: 0.9 } },
  { id: 'skater', label: 'Ice skater (no dumbbells)', values: { mode: 'spinner', I0: 1.2, sm: 2.5, w0: 3, r: 0.75 } },
  { id: 'discs', label: 'Disc dropped onto a spinning disc', values: { mode: 'discs', I1: 0.4, I2: 0.6, dw1: 10, tau: 0.5 } },
  { id: 'discs-eq', label: 'Two equal discs', values: { mode: 'discs', I1: 0.5, I2: 0.5, dw1: 10, tau: 0.5 } },
  { id: 'mgr', label: 'Walking on a merry-go-round', values: { mode: 'mgr', Ip: 300, pm: 60, R: 2, u: 1.2 } },
];

export const channels: ChannelDef[] = [
  { key: 't', label: 't', unit: 's' },
  { key: 'w1', label: 'ω (spinner / disc 1 / platform)', unit: 'rad s⁻¹', color: '--series-1' },
  { key: 'w2', label: 'ω (disc 2 / person)', unit: 'rad s⁻¹', color: '--series-2' },
  { key: 'L1', label: 'L part 1', unit: 'kg m² s⁻¹', color: '--series-1' },
  { key: 'L2', label: 'L part 2', unit: 'kg m² s⁻¹', color: '--series-2' },
  { key: 'L', label: 'total L', unit: 'kg m² s⁻¹', color: '--series-5', dash: [6, 4] },
  { key: 'E', label: 'kinetic energy', unit: 'J', color: '--series-4' },
];

export const graphs: GraphDef[] = [
  { id: 'L', title: 'Angular momentum', series: ['L1', 'L2', 'L'] },
  { id: 'w', title: 'Angular velocity', series: ['w1', 'w2'] },
  { id: 'E', title: 'Rotational kinetic energy', series: ['E'] },
];

export const info: SimInfo = {
  about: [
    'Angular momentum L = Iω is the rotational version of linear momentum. If no external torque acts on a system, its total angular momentum stays constant — even when parts of the system move or rub against each other.',
    'Spinning chair: pulling the masses in reduces the moment of inertia I, so ω must increase to keep Iω constant. The rotational kinetic energy L²/2I increases: the arms do work to pull the masses in.',
    'Dropped disc: friction between the discs is an internal torque. It slows disc 1 and speeds up disc 2 by exactly the same amount of angular momentum, until they turn together. Kinetic energy is lost as heat — the rotational version of a perfectly inelastic collision.',
    'Merry-go-round: if you walk one way around the edge, the platform turns the other way, so the total angular momentum stays zero.',
  ],
  formulas: [
    { label: 'Angular momentum', tex: 'L = I\\omega', hl: true },
    { label: 'Change of angular momentum', tex: '\\Delta L = \\tau\\Delta t = \\Delta(I\\omega)', hl: true },
    { label: 'Rotational kinetic energy', tex: 'E_k = \\tfrac{1}{2}I\\omega^{2} = \\dfrac{L^{2}}{2I}', hl: true },
    { label: 'Moment of inertia', tex: 'I = \\Sigma mr^{2}', hl: true },
    { label: 'Conservation (no external torque)', tex: 'I_1\\omega_1 = I_2\\omega_2', beyond: true },
    { label: 'Angular momentum of a point mass', tex: 'L = mvr', beyond: true },
  ],
  assumptions: [
    'Frictionless axles; no air resistance; no external torque about the axis.',
    'Spinning chair: the arms move the masses radially; the body’s own moment of inertia I₀ stays the same.',
    'Discs: a constant kinetic-friction torque acts between them until they turn together.',
    'Merry-go-round: the person is a point mass at the edge, walking at a constant speed relative to the platform.',
    'Numerics: exact formulas; the angles advance with the exact angular velocity.',
  ],
  tryThis: [
    'Halve the arm radius: does ω double? (Look at I₀ — it does not change.)',
    'Calculate the energy lost when two equal discs join. What fraction of E_k remains?',
    'On the merry-go-round, walk with u = 2 m s⁻¹, then make the platform heavier: what changes?',
  ],
};

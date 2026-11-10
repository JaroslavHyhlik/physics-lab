import type { NumberParamDef } from '../../sim/params.svelte';
import type { Preset, SimInfo, GraphDef } from '../../sim/types';
import type { ChannelDef } from '../../core/recorder';
import { g } from '../../core/constants';

export const defaults = {
  mode: 'beam',
  m1: 3,
  x1: -1,
  m2: 2,
  x2: 1.5,
  m3: 0,
  x3: 0.5,
  xp: 0,
  mb: 0,
  lL: 5,
  lth: 60,
  lm: 10,
  lM: 70,
  ld: 3,
  lmu: 0.3,
  g,
};
export type Params = typeof defaults;

export const sliders: NumberParamDef[] = [
  { key: 'm1', label: 'Mass 1', symbol: 'm₁', unit: 'kg', min: 0, max: 10, step: 0.1 },
  { key: 'm2', label: 'Mass 2', symbol: 'm₂', unit: 'kg', min: 0, max: 10, step: 0.1 },
  { key: 'm3', label: 'Mass 3', symbol: 'm₃', unit: 'kg', min: 0, max: 10, step: 0.1 },
  { key: 'xp', label: 'Pivot position', unit: 'm', min: -1.5, max: 1.5, step: 0.05 },
  { key: 'mb', label: 'Mass of the beam', unit: 'kg', min: 0, max: 10, step: 0.1 },
  { key: 'lL', label: 'Ladder length', symbol: 'L', unit: 'm', min: 2, max: 8, step: 0.1 },
  { key: 'lth', label: 'Angle with the floor', symbol: 'θ', unit: '°', min: 30, max: 85, step: 1 },
  { key: 'lm', label: 'Mass of the ladder', symbol: 'm', unit: 'kg', min: 1, max: 40, step: 1 },
  { key: 'lM', label: 'Mass of the person', symbol: 'M', unit: 'kg', min: 0, max: 120, step: 1 },
  { key: 'ld', label: 'Distance climbed', symbol: 'd', unit: 'm', min: 0, max: 8, step: 0.05 },
  { key: 'lmu', label: 'Floor friction', symbol: 'μ_s', unit: '', min: 0, max: 1, step: 0.01 },
  { key: 'g', label: 'Gravitational field strength', symbol: 'g', unit: 'm s⁻²', min: 1, max: 25, step: 0.01 },
];

export const presets: Preset<Params>[] = [
  { id: 'balance', label: 'See-saw: balanced (3 × 1 = 2 × 1.5)', values: { mode: 'beam', m1: 3, x1: -1, m2: 2, x2: 1.5, m3: 0, xp: 0, mb: 0 } },
  { id: 'unbalanced', label: 'See-saw: not balanced', values: { mode: 'beam', m1: 3, x1: -1, m2: 1, x2: 1, m3: 0, xp: 0, mb: 0 } },
  { id: 'three', label: 'Three masses', values: { mode: 'beam', m1: 2, x1: -1.5, m2: 1, x2: 0.5, m3: 2, x3: 1, xp: 0, mb: 0 } },
  { id: 'heavybeam', label: 'Heavy beam, pivot off centre', values: { mode: 'beam', m1: 0, m2: 4, x2: 1.5, m3: 0, xp: 0.75, mb: 4 } },
  { id: 'ladder', label: 'Ladder against a wall', values: { mode: 'ladder', lL: 5, lth: 60, lm: 10, lM: 70, ld: 3, lmu: 0.3 } },
  { id: 'ladder-slip', label: 'Ladder: climbing too high', values: { mode: 'ladder', lL: 5, lth: 60, lm: 10, lM: 70, ld: 4.5, lmu: 0.3 } },
];

export const channels: ChannelDef[] = [
  { key: 't', label: 't', unit: 's' },
  { key: 'theta', label: 'beam angle', unit: '°', color: '--series-1' },
  { key: 'tau', label: 'resultant torque', unit: 'N m', color: '--series-4' },
];

export const graphs: GraphDef[] = [
  { id: 'theta', title: 'Beam angle', series: ['theta'] },
  { id: 'tau', title: 'Resultant torque', series: ['tau'] },
];

export const info: SimInfo = {
  about: [
    'A force can make an object turn. Its turning effect, the torque, depends on the size of the force and how far from the pivot it acts: τ = Fr sinθ, where θ is the angle between the force and the line from the pivot.',
    'An object is in equilibrium only if both the resultant force and the resultant torque are zero. For a see-saw this is the principle of moments: the sum of the clockwise moments equals the sum of the anticlockwise moments. The pivot then pushes up with the total weight.',
    'If the torques do not balance, the beam has an angular acceleration α = τ/I, where I is its moment of inertia about the pivot.',
    'A ladder leaning on a smooth wall needs friction from the floor. The higher you climb, the larger the torque of your weight about the foot, the harder the wall pushes — and the more friction is needed. When it exceeds μ_s F_N the ladder slips.',
  ],
  formulas: [
    { label: 'Torque', tex: '\\tau = Fr\\sin\\theta', hl: true },
    { label: 'Equilibrium', tex: '\\Sigma F = 0, \\qquad \\Sigma\\tau = 0', hl: true },
    { label: "Newton's second law for rotation", tex: '\\tau = I\\alpha', hl: true },
    { label: 'Moment of inertia of point masses', tex: 'I = \\Sigma mr^{2}', hl: true },
    { label: 'Static friction', tex: 'F_f \\le \\mu_s F_N' },
    { label: 'Uniform rod about its centre', tex: 'I = \\tfrac{1}{12}mL^{2}', beyond: true },
  ],
  assumptions: [
    'Rigid beam of length 4 m and point masses; the beam’s weight acts at its centre. Frictionless pivot.',
    'Out of balance, the beam rotates freely until it touches the ground at 15°.',
    'Ladder: uniform, leaning on a smooth (frictionless) wall; only the floor provides friction.',
    'Force arrows are proportional to the forces; objects are not drawn to scale.',
    'Numerics: torques are exact; the rotation uses the Yoshida 4th-order method with a 1 ms step.',
  ],
  tryThis: [
    'Drag the masses until the beam balances. Check: sum of clockwise moments = sum of anticlockwise moments.',
    'Give the beam a mass and move the pivot off centre: where must a counterweight go?',
    'Ladder: find the highest point you can climb. Does it change if the ladder is steeper?',
  ],
};

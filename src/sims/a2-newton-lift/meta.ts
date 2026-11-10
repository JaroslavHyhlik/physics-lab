import type { NumberParamDef } from '../../sim/params.svelte';
import type { GraphDef, Preset, SimInfo } from '../../sim/types';
import type { ChannelDef } from '../../core/recorder';
import { g } from '../../core/constants';

export const defaults = {
  mode: 'lift',
  m: 70,
  a: 1.5,
  t1: 2,
  t2: 4,
  up: true,
  freeFall: false,
  m1: 3,
  m2: 2,
  muS: 0.4,
  muD: 0.3,
  g,
  forces: true,
};
export type Params = typeof defaults;

export const sliders: NumberParamDef[] = [
  { key: 'm', label: 'Mass of the person', symbol: 'm', unit: 'kg', min: 20, max: 150, step: 1 },
  { key: 'a', label: 'Acceleration of the lift', symbol: 'a', unit: 'm s⁻²', min: 0.1, max: 5, step: 0.1 },
  { key: 't1', label: 'Time speeding up (and slowing down)', unit: 's', min: 0.5, max: 5, step: 0.1 },
  { key: 't2', label: 'Time at constant speed', unit: 's', min: 0, max: 10, step: 0.5 },
  { key: 'm1', label: 'Mass (left / on the table)', symbol: 'm₁', unit: 'kg', min: 0.1, max: 10, step: 0.1 },
  { key: 'm2', label: 'Hanging mass (right)', symbol: 'm₂', unit: 'kg', min: 0.1, max: 10, step: 0.1 },
  { key: 'muS', label: 'Coefficient of static friction', symbol: 'μ_s', unit: '', min: 0, max: 1.2, step: 0.01 },
  { key: 'muD', label: 'Coefficient of dynamic friction', symbol: 'μ_d', unit: '', min: 0, max: 1.2, step: 0.01 },
  { key: 'g', label: 'Gravitational field strength', symbol: 'g', unit: 'm s⁻²', min: 1, max: 25, step: 0.01 },
];

export const presets: Preset<Params>[] = [
  { id: 'up', label: 'Lift going up', values: { mode: 'lift', up: true, freeFall: false, a: 1.5, t1: 2, t2: 4 } },
  { id: 'down', label: 'Lift going down', values: { mode: 'lift', up: false, freeFall: false, a: 1.5, t1: 2, t2: 4 } },
  { id: 'snap', label: 'Cable snaps: free fall', values: { mode: 'lift', freeFall: true } },
  { id: 'atwood', label: 'Atwood machine', values: { mode: 'atwood', m1: 3, m2: 2 } },
  { id: 'atwood-near', label: 'Atwood, nearly equal masses', values: { mode: 'atwood', m1: 2.1, m2: 2 } },
  { id: 'table', label: 'Block on a table pulled by a hanging mass', values: { mode: 'table', m1: 2, m2: 1.5, muS: 0.4, muD: 0.3 } },
  { id: 'table-stuck', label: 'Table: friction holds it', values: { mode: 'table', m1: 4, m2: 1.5, muS: 0.4, muD: 0.3 } },
];

export const channels: ChannelDef[] = [
  { key: 't', label: 't', unit: 's' },
  { key: 's', label: 'displacement', unit: 'm', color: '--series-1' },
  { key: 'v', label: 'v', unit: 'm s⁻¹', color: '--series-2' },
  { key: 'a', label: 'a', unit: 'm s⁻²', color: '--series-3' },
  { key: 'F', label: 'scales reading N / tension T', unit: 'N', color: '--series-4' },
  { key: 'W', label: 'weight', unit: 'N', color: '--series-5', dash: [6, 4] },
];

export const graphs: GraphDef[] = [
  { id: 'F', title: 'Force (N or T) and weight', series: ['F', 'W'] },
  { id: 'a', title: 'Acceleration a–t', series: ['a'] },
  { id: 'v', title: 'Velocity v–t', series: ['v'] },
  { id: 's', title: 'Displacement s–t', series: ['s'] },
];

export const info: SimInfo = {
  about: [
    'Newton’s second law, F = ma, uses the resultant force. Draw a free-body diagram for each object, choose a positive direction and add up the forces.',
    'In a lift the scales measure the normal force N, not your weight. Speeding up while going up (or slowing down while going down) the resultant force must point up, so N > mg and you feel heavier. In free fall N = 0: you feel weightless even though gravity still acts.',
    'Connected bodies move with the same acceleration because the string does not stretch. Writing F = ma for each mass separately gives the acceleration and the tension in the string.',
  ],
  formulas: [
    { label: "Newton's second law", tex: 'F = ma = \\dfrac{\\Delta p}{\\Delta t}' },
    { label: 'Weight', tex: 'F_g = mg' },
    { label: 'Scales reading in a lift (up positive)', tex: 'N - mg = ma \\;\\Rightarrow\\; N = m(g + a)', beyond: true },
    { label: 'Atwood machine', tex: 'a = \\dfrac{(m_1 - m_2)g}{m_1 + m_2}, \\qquad T = \\dfrac{2m_1m_2g}{m_1 + m_2}', beyond: true },
    { label: 'Block on a table + hanging mass', tex: 'a = \\dfrac{(m_2 - \\mu_d m_1)g}{m_1 + m_2}', beyond: true },
    { label: 'Friction', tex: 'F_f \\le \\mu_s F_N, \\qquad F_f = \\mu_d F_N' },
    { label: 'Uniform acceleration', tex: 'v = u + at, \\qquad s = ut + \\tfrac{1}{2}at^{2}' },
  ],
  assumptions: [
    'Strings are light and inextensible; pulleys are light and frictionless; no air resistance.',
    'The lift’s acceleration changes instantly between phases (in a real lift it changes smoothly).',
    'The motion stops when a mass reaches the pulley or the floor.',
    'Objects are not drawn to scale; force arrows are proportional to the forces.',
    'Numerics: exact — each phase has constant acceleration, so the suvat equations are used directly.',
  ],
  tryThis: [
    'Read the scales during each phase of the lift trip and check N = m(g + a).',
    'In the Atwood machine, make the masses nearly equal: a is small, so you can measure it accurately — that is how g was once measured.',
    'Is the tension in the Atwood string equal to m₂g? Why not?',
    'On the table, increase m₂ slowly: at what value does the block start to move?',
  ],
};

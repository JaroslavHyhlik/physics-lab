import type { NumberParamDef } from '../../sim/params.svelte';
import type { GraphDef, Preset, SimInfo } from '../../sim/types';
import type { ChannelDef } from '../../core/recorder';
import { g } from '../../core/constants';

export const defaults = {
  theta: 30,
  m: 2,
  muS: 0.5,
  muD: 0.4,
  F: 0,
  u: 0,
  L: 4,
  g,
  friction: true,
  components: true,
  fbd: true,
};
export type Params = typeof defaults;

export const sliders: NumberParamDef[] = [
  { key: 'theta', label: 'Angle of slope', symbol: 'θ', unit: '°', min: 0, max: 80, step: 0.5, decimals: 1 },
  { key: 'm', label: 'Mass', symbol: 'm', unit: 'kg', min: 0.1, max: 20, step: 0.1 },
  { key: 'muS', label: 'Coefficient of static friction', symbol: 'μ_s', unit: '', min: 0, max: 1.5, step: 0.01 },
  { key: 'muD', label: 'Coefficient of dynamic friction', symbol: 'μ_d', unit: '', min: 0, max: 1.5, step: 0.01 },
  { key: 'F', label: 'Applied force (up the slope +)', symbol: 'F', unit: 'N', min: -100, max: 100, step: 0.5 },
  { key: 'u', label: 'Initial velocity (up the slope +)', symbol: 'u', unit: 'm s⁻¹', min: -8, max: 8, step: 0.1 },
  { key: 'L', label: 'Length of slope', symbol: 'L', unit: 'm', min: 1, max: 10, step: 0.1 },
  { key: 'g', label: 'Gravitational field strength', symbol: 'g', unit: 'm s⁻²', min: 1, max: 25, step: 0.01 },
];

export const presets: Preset<Params>[] = [
  { id: 'rest', label: 'Block stays at rest (θ < critical)', values: { theta: 20, m: 2, muS: 0.5, muD: 0.4, F: 0, u: 0, friction: true } },
  { id: 'slide', label: 'Block slides down', values: { theta: 35, m: 2, muS: 0.5, muD: 0.4, F: 0, u: 0, friction: true } },
  { id: 'push', label: 'Pushed up, then stops', values: { theta: 20, m: 2, muS: 0.5, muD: 0.4, F: 0, u: 5, friction: true } },
  { id: 'back', label: 'Pushed up, then slides back', values: { theta: 40, m: 2, muS: 0.5, muD: 0.4, F: 0, u: 5, friction: true } },
  { id: 'pull', label: 'Pulled up the slope', values: { theta: 25, m: 2, muS: 0.5, muD: 0.4, F: 25, u: 0, friction: true } },
  { id: 'ice', label: 'Ice (μ ≈ 0.03)', values: { theta: 10, m: 2, muS: 0.04, muD: 0.03, F: 0, u: 0, friction: true } },
  { id: 'none', label: 'Frictionless', values: { theta: 30, m: 2, F: 0, u: 0, friction: false } },
];

export const channels: ChannelDef[] = [
  { key: 't', label: 't', unit: 's' },
  { key: 's', label: 's (along slope)', unit: 'm', color: '--series-1' },
  { key: 'v', label: 'v', unit: 'm s⁻¹', color: '--series-2' },
  { key: 'a', label: 'a', unit: 'm s⁻²', color: '--series-3' },
  { key: 'Ff', label: 'friction (+ up the slope)', unit: 'N', color: '--series-4' },
  { key: 'Wpar', label: 'weight component −mg sinθ', unit: 'N', color: '--series-5' },
  { key: 'Fnet', label: 'net force', unit: 'N', color: '--series-3' },
  { key: 'Ek', label: 'Eₖ', unit: 'J', color: '--series-2' },
  { key: 'Ep', label: 'Eₚ', unit: 'J', color: '--series-3' },
  { key: 'Q', label: 'thermal', unit: 'J', color: '--series-4' },
];

export const graphs: GraphDef[] = [
  { id: 's', title: 'Position s–t', series: ['s'] },
  { id: 'v', title: 'Velocity v–t', series: ['v'] },
  { id: 'a', title: 'Acceleration a–t', series: ['a'] },
  { id: 'F', title: 'Forces along the slope', series: ['Ff', 'Wpar', 'Fnet'] },
  { id: 'E', title: 'Energy', series: ['Ek', 'Ep', 'Q'] },
];

export const info: SimInfo = {
  about: [
    'The weight mg of the block can be split into two components: mg sinθ down the slope and mg cosθ into the slope. The normal force balances the second one, F_N = mg cosθ.',
    'While the block is at rest, static friction adjusts itself to stop it sliding — but only up to a maximum μ_s F_N. If mg sinθ is larger than that (tanθ > μ_s), the block starts to slide. Once it moves, dynamic friction μ_d F_N acts opposite to the velocity; usually μ_d < μ_s, so a block that has just started to slide keeps sliding.',
    'Friction turns kinetic and potential energy into thermal energy, shown in the energy graph.',
  ],
  formulas: [
    { label: 'Static friction (maximum value μ_s F_N)', tex: 'F_f \\le \\mu_s F_N' },
    { label: 'Dynamic friction', tex: 'F_f = \\mu_d F_N' },
    { label: 'Weight', tex: 'F_g = mg' },
    { label: 'Components of the weight on a slope', tex: 'mg\\sin\\theta \\ \\text{(along)}, \\qquad mg\\cos\\theta = F_N \\ \\text{(perpendicular)}' },
    { label: "Newton's second law", tex: 'F = ma' },
    { label: 'Sliding down from rest', tex: 'a = g(\\sin\\theta - \\mu_d\\cos\\theta)' },
    { label: 'Condition for sliding to start', tex: '\\tan\\theta > \\mu_s' },
    { label: 'Work done against friction', tex: 'W = F_f\\, s' },
  ],
  assumptions: [
    'The block is a rigid body that slides without tipping or rolling; it is drawn as a square, not to scale.',
    'Friction coefficients are constant (independent of speed and contact area); μ_d ≤ μ_s is enforced.',
    'The applied force acts parallel to the slope; no air resistance.',
    'The block stops when it reaches either end of the slope.',
    'Force arrows: lengths proportional to the forces (the weight mg sets the scale).',
    'Numerics: exact — the forces are constant between changes of direction, so suvat is applied exactly, and the moment the block stops is found analytically.',
  ],
  tryThis: [
    'Increase θ slowly from 0 with the block at rest. At what angle does it start to slide? Compare with tan⁻¹ μ_s.',
    'Once it slides, decrease θ a little: it keeps sliding. Why? (μ_d < μ_s)',
    'Push the block up the slope: is the deceleration going up the same as the acceleration coming down?',
    'Check in the energy graph that Eₖ + Eₚ + thermal energy stays constant.',
  ],
};

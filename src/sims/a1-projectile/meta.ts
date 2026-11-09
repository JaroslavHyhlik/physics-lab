import type { NumberParamDef } from '../../sim/params.svelte';
import type { GraphDef, Preset, SimInfo } from '../../sim/types';
import type { ChannelDef } from '../../core/recorder';
import { g } from '../../core/constants';

export const defaults = {
  u: 20,
  angle: 45,
  h0: 0,
  m: 0.145,
  d: 0.074,
  Cd: 0.47,
  rho: 1.2,
  g,
  vacuum: true,
  air: true,
  components: false,
  dots: true,
};
export type Params = typeof defaults;

export const sliders: NumberParamDef[] = [
  { key: 'u', label: 'Launch speed', symbol: 'u', unit: 'm s⁻¹', min: 1, max: 100, step: 0.5 },
  { key: 'angle', label: 'Launch angle', symbol: 'θ', unit: '°', min: -30, max: 90, step: 0.5, decimals: 1 },
  { key: 'h0', label: 'Launch height', symbol: 'h', unit: 'm', min: 0, max: 100, step: 0.5 },
  { key: 'm', label: 'Mass', symbol: 'm', unit: 'kg', min: 0.002, max: 20, step: 0.001, log: true },
  { key: 'd', label: 'Diameter', symbol: 'd', unit: 'm', min: 0.01, max: 0.5, step: 0.001, log: true },
  { key: 'Cd', label: 'Drag coefficient', symbol: 'C_d', unit: '', min: 0.05, max: 1.5, step: 0.01 },
  { key: 'rho', label: 'Air density', symbol: 'ρ', unit: 'kg m⁻³', min: 0, max: 1.5, step: 0.01 },
  { key: 'g', label: 'Gravitational field strength', symbol: 'g', unit: 'm s⁻²', min: 1, max: 25, step: 0.01 },
];

export const presets: Preset<Params>[] = [
  { id: 'textbook', label: 'Textbook ball (20 m s⁻¹, 45°)', values: { u: 20, angle: 45, h0: 0, m: 0.145, d: 0.074, Cd: 0.47, rho: 1.2, g } },
  { id: 'baseball', label: 'Baseball hit (45 m s⁻¹)', values: { u: 45, angle: 35, h0: 1, m: 0.145, d: 0.074, Cd: 0.35, rho: 1.2, g } },
  { id: 'football', label: 'Football long kick', values: { u: 28, angle: 40, h0: 0, m: 0.43, d: 0.22, Cd: 0.25, rho: 1.2, g } },
  { id: 'golf', label: 'Golf drive (70 m s⁻¹)', values: { u: 70, angle: 12, h0: 0, m: 0.0459, d: 0.0427, Cd: 0.25, rho: 1.2, g } },
  { id: 'shot', label: 'Shot put (7.26 kg)', values: { u: 13.7, angle: 38, h0: 2.1, m: 7.26, d: 0.12, Cd: 0.47, rho: 1.2, g } },
  { id: 'pingpong', label: 'Table-tennis ball', values: { u: 15, angle: 45, h0: 0, m: 0.0027, d: 0.04, Cd: 0.47, rho: 1.2, g } },
  { id: 'cliff', label: 'Horizontal throw off a cliff', values: { u: 15, angle: 0, h0: 40, m: 0.145, d: 0.074, Cd: 0.47, rho: 1.2, g } },
  { id: 'moon', label: 'Golf on the Moon (no air)', values: { u: 30, angle: 45, h0: 0, m: 0.0459, d: 0.0427, Cd: 0.25, rho: 0, g: 1.62 } },
];

export const channels: ChannelDef[] = [
  { key: 't', label: 't', unit: 's' },
  { key: 'xv', label: 'x (vacuum)', unit: 'm', color: '--series-5', dash: [6, 4] },
  { key: 'xa', label: 'x (air)', unit: 'm', color: '--series-1' },
  { key: 'yv', label: 'y (vacuum)', unit: 'm', color: '--series-5', dash: [6, 4] },
  { key: 'ya', label: 'y (air)', unit: 'm', color: '--series-1' },
  { key: 'vxv', label: 'vₓ (vacuum)', unit: 'm s⁻¹', color: '--series-5', dash: [6, 4] },
  { key: 'vxa', label: 'vₓ (air)', unit: 'm s⁻¹', color: '--series-1' },
  { key: 'vyv', label: 'v_y (vacuum)', unit: 'm s⁻¹', color: '--series-5', dash: [6, 4] },
  { key: 'vya', label: 'v_y (air)', unit: 'm s⁻¹', color: '--series-1' },
  { key: 'axa', label: 'aₓ (air)', unit: 'm s⁻²', color: '--series-2' },
  { key: 'aya', label: 'a_y (air)', unit: 'm s⁻²', color: '--series-1' },
  { key: 'ayv', label: 'a_y (vacuum)', unit: 'm s⁻²', color: '--series-5', dash: [6, 4] },
];

export const graphs: GraphDef[] = [
  { id: 'y', title: 'Height y–t', series: ['yv', 'ya'] },
  { id: 'x', title: 'Horizontal x–t', series: ['xv', 'xa'] },
  { id: 'vy', title: 'Vertical velocity v_y–t', series: ['vyv', 'vya'] },
  { id: 'vx', title: 'Horizontal velocity vₓ–t', series: ['vxv', 'vxa'] },
  { id: 'a', title: 'Acceleration a–t', series: ['ayv', 'aya', 'axa'] },
];

export const info: SimInfo = {
  about: [
    'Two identical balls are launched together: one in a vacuum (dashed) and one through air. In a vacuum the only force is gravity, so the horizontal velocity stays constant and the vertical velocity changes uniformly — the path is a parabola and the horizontal and vertical motions can be treated separately.',
    'Air resistance acts opposite to the velocity and grows with speed (∝ v²). It reduces both components of the velocity, so the ball goes less high and less far, and the path is no longer symmetric: it comes down more steeply than it went up.',
    'Without air resistance the greatest range on level ground is at 45°. With air resistance the best angle is smaller — use the “Best angle” button to find it.',
  ],
  formulas: [
    { label: 'Uniform acceleration (each component separately)', tex: 'v = u + at \\qquad s = ut + \\tfrac{1}{2}at^{2}' },
    { tex: 'v^{2} = u^{2} + 2as \\qquad s = \\dfrac{(u+v)t}{2}' },
    { label: 'Components of the launch velocity', tex: 'u_x = u\\cos\\theta \\qquad u_y = u\\sin\\theta' },
    { label: 'Range on level ground (no air resistance)', tex: 'R = \\dfrac{u^{2}\\sin 2\\theta}{g}', beyond: true },
    { label: 'Maximum height (no air resistance)', tex: 'H = \\dfrac{u^{2}\\sin^{2}\\theta}{2g}', beyond: true },
    { label: 'Air resistance (quadratic drag)', tex: 'F_{\\text{drag}} = \\tfrac{1}{2}\\rho C_d A v^{2}', beyond: true },
    { label: 'Terminal speed', tex: 'v_t = \\sqrt{\\dfrac{2mg}{\\rho C_d A}}', beyond: true },
  ],
  assumptions: [
    'The ball is a smooth sphere (A = πd²/4) that does not spin: no Magnus lift; C_d is constant (in reality it changes with speed).',
    'Uniform gravitational field; no wind; constant air density; flat ground at y = 0.',
    'Balls are drawn larger than to scale. Dots mark positions every 0.1 s (or 0.5 s for long flights).',
    'Numerics: RK4 with a 1 ms step; the landing point is found inside the last step (exact in a vacuum).',
  ],
  tryThis: [
    'In a vacuum, check that the dots are equally spaced horizontally: vₓ is constant.',
    'Compare 30° and 60° in a vacuum: same range. Now switch on air resistance — which one wins?',
    'Throw a table-tennis ball: the air path is far from a parabola. Why does mass matter here?',
    'Read the gradient of the y–t graph at the top of the flight. What is v_y there?',
  ],
};

import type { NumberParamDef } from '../../sim/params.svelte';
import type { GraphDef, Preset, SimInfo } from '../../sim/types';
import type { ChannelDef } from '../../core/recorder';
import { g } from '../../core/constants';

export const defaults = {
  v: 15,
  r: 50,
  theta: 15,
  mu: 0.6,
  m: 1200,
  g,
  fbd: true,
  components: false,
};
export type Params = typeof defaults;

export const sliders: NumberParamDef[] = [
  { key: 'v', label: 'Speed', symbol: 'v', unit: 'm s⁻¹', min: 0.5, max: 60, step: 0.1 },
  { key: 'r', label: 'Radius of the curve', symbol: 'r', unit: 'm', min: 5, max: 300, step: 1 },
  { key: 'theta', label: 'Banking angle', symbol: 'θ', unit: '°', min: 0, max: 60, step: 0.5, decimals: 1 },
  { key: 'mu', label: 'Coefficient of static friction', symbol: 'μ_s', unit: '', min: 0, max: 1.2, step: 0.01 },
  { key: 'm', label: 'Mass of the car', symbol: 'm', unit: 'kg', min: 500, max: 3000, step: 10 },
  { key: 'g', label: 'Gravitational field strength', symbol: 'g', unit: 'm s⁻²', min: 1, max: 25, step: 0.01 },
];

export const presets: Preset<Params>[] = [
  { id: 'flat', label: 'Flat road (friction only)', values: { theta: 0, mu: 0.7, r: 40, v: 12 } },
  { id: 'ideal', label: 'Banked at the ideal speed', values: { theta: 20, mu: 0.6, r: 80, v: 16.9 } },
  { id: 'fast', label: 'Too fast: slides outwards', values: { theta: 10, mu: 0.3, r: 40, v: 18 } },
  { id: 'slow', label: 'Steep and icy: slides inwards', values: { theta: 35, mu: 0.1, r: 60, v: 8 } },
  { id: 'track', label: 'Race track (30° banking)', values: { theta: 30, mu: 0.9, r: 150, v: 45 } },
  { id: 'ice', label: 'Icy flat road', values: { theta: 0, mu: 0.1, r: 40, v: 7 } },
];

export const channels: ChannelDef[] = [
  { key: 't', label: 't', unit: 's' },
  { key: 'v', label: 'v', unit: 'm s⁻¹', color: '--series-2' },
  { key: 'a', label: 'centripetal a', unit: 'm s⁻²', color: '--series-3' },
  { key: 'N', label: 'normal force F_N', unit: 'N', color: '--series-3' },
  { key: 'f', label: 'friction (+ down the bank)', unit: 'N', color: '--series-4' },
  { key: 'fmax', label: 'μ_s F_N', unit: 'N', color: '--series-5', dash: [6, 4] },
];

export const graphs: GraphDef[] = [
  { id: 'F', title: 'Forces', series: ['N', 'f', 'fmax'] },
  { id: 'a', title: 'Centripetal acceleration', series: ['a'] },
  { id: 'v', title: 'Speed', series: ['v'] },
];

export const info: SimInfo = {
  about: [
    'A car moving in a circle at constant speed is accelerating: its velocity keeps changing direction. The acceleration v²/r points towards the centre, so a resultant force mv²/r towards the centre is needed — the centripetal force. It is not a new kind of force: here it is provided by friction and by the normal force.',
    'On a flat road only friction can push the car towards the centre, so the speed is limited by F_f ≤ μ_s F_N: v_max = √(μ_s g r). On a banked road the normal force is tilted towards the centre and helps. At one speed — the ideal speed √(rg tanθ) — no friction is needed at all.',
    'Faster than that, friction must act down the bank; slower, it must act up the bank. If the friction needed is more than μ_s F_N, the car slides outwards (too fast) or down the bank (too slow).',
  ],
  formulas: [
    { label: 'Centripetal acceleration', tex: 'a = \\dfrac{v^{2}}{r} = \\omega^{2}r = \\dfrac{4\\pi^{2}r}{T^{2}}' },
    { label: 'Speed in circular motion', tex: 'v = \\dfrac{2\\pi r}{T} = \\omega r' },
    { label: "Newton's second law", tex: 'F = ma' },
    { label: 'Static friction limit', tex: 'F_f \\le \\mu_s F_N' },
    { label: 'Ideal speed on a banked curve (no friction)', tex: 'v = \\sqrt{rg\\tan\\theta}', beyond: true },
    { label: 'Maximum speed on a flat curve', tex: 'v_{\\max} = \\sqrt{\\mu_s g r}', beyond: true },
  ],
  assumptions: [
    'The car is treated as a particle moving at constant speed on a horizontal circle; no air resistance; tyres do not slip unless the limit is exceeded.',
    'Forces are found from Newton’s second law for steady circular motion (exact algebra). The simulation shows when sliding would start but does not animate the slide itself.',
    'The car is not drawn to scale; force arrows are proportional to the forces (the weight sets the scale).',
  ],
  tryThis: [
    'Flat road: find the fastest speed for μ_s = 0.7 and r = 40 m, then check v_max = √(μ_s g r).',
    'Set the speed to the ideal speed: what happens to the friction arrow?',
    'Double the radius at the same speed: how does the centripetal acceleration change?',
    'Make the road icy (μ_s = 0.1) and steep: can the car still stop on the bank?',
  ],
};

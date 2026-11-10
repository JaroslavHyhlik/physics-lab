import type { NumberParamDef } from '../../sim/params.svelte';
import type { GraphDef, Preset, SimInfo } from '../../sim/types';
import type { ChannelDef } from '../../core/recorder';
import { g } from '../../core/constants';

export const defaults = { track: 'hills', m: 500, mu: 0, u: 0, g, bars: true, gforce: true };
export type Params = typeof defaults;

export const sliders: NumberParamDef[] = [
  { key: 'm', label: 'Mass of the car', symbol: 'm', unit: 'kg', min: 50, max: 2000, step: 10 },
  { key: 'mu', label: 'Friction coefficient', symbol: 'μ', unit: '', min: 0, max: 0.1, step: 0.001, decimals: 3 },
  { key: 'u', label: 'Initial speed', symbol: 'u', unit: 'm s⁻¹', min: 0, max: 20, step: 0.5 },
  { key: 'g', label: 'Gravitational field strength', symbol: 'g', unit: 'm s⁻²', min: 1, max: 25, step: 0.01 },
];

export const presets: Preset<Params>[] = [
  { id: 'hills', label: 'Drop and hills (no friction)', values: { track: 'hills', mu: 0, u: 0 } },
  { id: 'loop', label: 'Vertical loop', values: { track: 'loop', mu: 0, u: 0 } },
  { id: 'valley', label: 'Valley: oscillation', values: { track: 'valley', mu: 0, u: 0 } },
  { id: 'valley-f', label: 'Valley with friction', values: { track: 'valley', mu: 0.02, u: 0 } },
  { id: 'camel', label: 'Camel back: airtime', values: { track: 'camel', mu: 0, u: 0 } },
  { id: 'loop-f', label: 'Loop with friction', values: { track: 'loop', mu: 0.03, u: 0 } },
];

export const channels: ChannelDef[] = [
  { key: 't', label: 't', unit: 's' },
  { key: 'Ek', label: 'Eₖ', unit: 'kJ', color: '--series-2' },
  { key: 'Ep', label: 'Eₚ', unit: 'kJ', color: '--series-3' },
  { key: 'Q', label: 'thermal', unit: 'kJ', color: '--series-4' },
  { key: 'E', label: 'total', unit: 'kJ', color: '--series-5', dash: [6, 4] },
  { key: 'v', label: 'speed', unit: 'm s⁻¹', color: '--series-2' },
  { key: 'h', label: 'height', unit: 'm', color: '--series-1' },
  { key: 'n', label: 'g-force N/mg', unit: '', color: '--series-4' },
];

export const graphs: GraphDef[] = [
  { id: 'E', title: 'Energy', series: ['Ek', 'Ep', 'Q', 'E'] },
  { id: 'v', title: 'Speed', series: ['v'] },
  { id: 'h', title: 'Height', series: ['h'] },
  { id: 'n', title: 'g-force felt by riders', series: ['n'] },
];

export const info: SimInfo = {
  about: [
    'Without friction the total energy of the car stays constant: every metre it drops turns gravitational potential energy into kinetic energy, mgΔh = ½mv². The speed at any point depends only on how far below the start it is — not on the shape of the track.',
    'The car can never climb higher than it started (unless it is given an initial speed). With friction some energy becomes thermal energy, so each hill reached is lower.',
    'On curves the track must also provide the centripetal force. The riders feel the normal force: more than their weight at the bottom of a dip, less over a crest. If N would become negative the car would leave the track — only its safety wheels hold it on (shown in red).',
  ],
  formulas: [
    { label: 'Kinetic energy', tex: 'E_k = \\tfrac{1}{2}mv^{2}' },
    { label: 'Gravitational potential energy', tex: '\\Delta E_p = mg\\Delta h' },
    { label: 'Conservation of energy (no friction)', tex: '\\tfrac{1}{2}mv^{2} + mgh = \\text{constant}' },
    { label: 'Centripetal acceleration', tex: 'a = \\dfrac{v^{2}}{r}' },
    { label: 'Work done against friction', tex: 'W = F_f s, \\quad F_f = \\mu F_N' },
    { label: 'Normal force on a curve of radius r (bottom of a dip)', tex: 'F_N = m\\left(g + \\dfrac{v^{2}}{r}\\right)', beyond: true },
  ],
  assumptions: [
    'The car is a particle held on the track (safety wheels); it never leaves it. Where the needed normal force would be negative, the track is marked red.',
    'Friction is a single coefficient μ times the normal force; no air resistance.',
    'The track is a smooth spline through control points. Drawn to scale; the car is drawn larger.',
    'Numerics: RK4 along the arc length with a 1 ms step; energy drifts by less than 0.001 % without friction.',
  ],
  tryThis: [
    'Check the speed at the lowest point against v = √(2gΔh).',
    'Vertical loop: the riders feel heaviest at the bottom (about 7 g in a circular loop!). Why are real loops teardrop-shaped, tighter at the top?',
    'Add friction in the valley and watch the thermal energy grow while the swings get smaller.',
    'Give the car an initial speed: can it now climb higher than the start?',
  ],
};

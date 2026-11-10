import type { NumberParamDef } from '../../sim/params.svelte';
import type { GraphDef, SimInfo } from '../../sim/types';
import type { ChannelDef } from '../../core/recorder';
import { scripts } from '../../physics/motion';

export const defaults = {
  mode: 'script',
  script: 'trip',
  acc: 0.5,
  vel: 1.5,
  amax: 3,
  tools: true,
};
export type Params = typeof defaults;

export const sliders: NumberParamDef[] = [
  { key: 'acc', label: 'Acceleration', symbol: 'a', unit: 'm s⁻²', min: -3, max: 3, step: 0.1 },
  { key: 'vel', label: 'Target velocity', symbol: 'v', unit: 'm s⁻¹', min: -4, max: 4, step: 0.1 },
  { key: 'amax', label: 'Largest acceleration allowed', unit: 'm s⁻²', min: 0.5, max: 6, step: 0.1 },
];

export const presets = Object.entries(scripts).map(([id, s]) => ({ id, label: s.label, values: { mode: 'script', script: id } }));

export const channels: ChannelDef[] = [
  { key: 't', label: 't', unit: 's' },
  { key: 'x', label: 'x', unit: 'm', color: '--series-1' },
  { key: 'v', label: 'v', unit: 'm s⁻¹', color: '--series-2' },
  { key: 'a', label: 'a', unit: 'm s⁻²', color: '--series-3' },
];

export const graphs: GraphDef[] = [
  { id: 'x', title: 'Position x–t', series: ['x'] },
  { id: 'v', title: 'Velocity v–t', series: ['v'] },
  { id: 'a', title: 'Acceleration a–t', series: ['a'] },
];

export const info: SimInfo = {
  about: [
    'The three graphs describe the same motion. The gradient of the x–t graph is the velocity; the gradient of the v–t graph is the acceleration.',
    'Going the other way, the area under the v–t graph is the displacement, and the area under the a–t graph is the change in velocity. Areas below the time axis count as negative.',
    'Drag the time cursor across the graphs to see the tangent lines and the shaded areas, with their values. Then drive the motion yourself: choose the acceleration, the velocity, or drag the walker, and predict the shape of the graphs before you look.',
  ],
  formulas: [
    { label: 'Equations of uniformly accelerated motion', tex: 'v = u + at \\qquad s = ut + \\tfrac{1}{2}at^{2}' },
    { tex: 'v^{2} = u^{2} + 2as \\qquad s = \\dfrac{(u+v)t}{2}' },
    { label: 'Velocity = gradient of x–t; acceleration = gradient of v–t', tex: 'v = \\dfrac{\\Delta x}{\\Delta t}, \\qquad a = \\dfrac{\\Delta v}{\\Delta t}' },
    { label: 'Displacement = area under v–t; Δv = area under a–t', tex: 's = \\textstyle\\int v\\,dt, \\qquad \\Delta v = \\textstyle\\int a\\,dt', beyond: true },
  ],
  assumptions: [
    'Motion along a straight line between walls at x = ±10 m (the walker stops dead at a wall).',
    'Within each 1 ms step the acceleration is constant, so x and v are exact.',
    'Velocity and position control change the velocity smoothly, never faster than the largest acceleration allowed.',
    'Areas are calculated from the recorded points with the trapezium rule.',
  ],
  tryThis: [
    'Choose “Uniform acceleration from rest”: what shape is the x–t graph? Read the gradient at two times.',
    'In “Slows down, turns round”, where is v = 0 on the x–t graph?',
    'Check that the area under the v–t graph equals the change in x shown on the x–t graph.',
    'Drive the walker with the velocity control and try to make the x–t graph a straight line, then a curve.',
  ],
};

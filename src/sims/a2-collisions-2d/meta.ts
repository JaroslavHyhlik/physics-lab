import type { NumberParamDef } from '../../sim/params.svelte';
import type { GraphDef, Preset, SimInfo } from '../../sim/types';
import type { ChannelDef } from '../../core/recorder';

export const defaults = {
  m1: 1,
  m2: 1,
  u1: 1.2,
  u2: 0,
  b: 0.1,
  e: 1,
  r: 0.1,
  trails: true,
  arrows: true,
  pdiagram: true,
  cmframe: false,
};
export type Params = typeof defaults;

export const sliders: NumberParamDef[] = [
  { key: 'm1', label: 'Mass of puck 1', symbol: 'm₁', unit: 'kg', min: 0.1, max: 5, step: 0.1 },
  { key: 'm2', label: 'Mass of puck 2', symbol: 'm₂', unit: 'kg', min: 0.1, max: 5, step: 0.1 },
  { key: 'u1', label: 'Initial velocity of puck 1', symbol: 'u₁', unit: 'm s⁻¹', min: 0.1, max: 2.5, step: 0.05 },
  { key: 'u2', label: 'Initial velocity of puck 2', symbol: 'u₂', unit: 'm s⁻¹', min: -1.5, max: 1.5, step: 0.05 },
  {
    key: 'b',
    label: 'Impact parameter (sideways offset)',
    symbol: 'b',
    unit: 'm',
    min: 0,
    max: 0.25,
    step: 0.005,
    decimals: 3,
    hint: '0 = head-on; when b ≥ 2r the pucks miss.',
  },
  { key: 'e', label: 'Coefficient of restitution', symbol: 'e', unit: '', min: 0, max: 1, step: 0.01 },
  { key: 'r', label: 'Puck radius', symbol: 'r', unit: 'm', min: 0.04, max: 0.15, step: 0.005, decimals: 3 },
];

export const presets: Preset<Params>[] = [
  { id: 'glancing', label: 'Equal masses, glancing, elastic (90°)', values: { m1: 1, m2: 1, u1: 1.2, u2: 0, b: 0.1, e: 1 } },
  { id: 'headon', label: 'Head-on, equal masses (velocities swap)', values: { m1: 1, m2: 1, u1: 1.2, u2: 0, b: 0, e: 1 } },
  { id: 'heavy', label: 'Heavy puck hits a light one', values: { m1: 4, m2: 1, u1: 1.2, u2: 0, b: 0.12, e: 1 } },
  { id: 'light', label: 'Light puck hits a heavy one', values: { m1: 0.5, m2: 4, u1: 1.5, u2: 0, b: 0.1, e: 1 } },
  { id: 'inelastic', label: 'Inelastic glancing collision', values: { m1: 1, m2: 1.5, u1: 1.2, u2: 0, b: 0.08, e: 0.3 } },
  { id: 'both', label: 'Both pucks moving', values: { m1: 1, m2: 2, u1: 1.4, u2: -0.6, b: 0.07, e: 0.9 } },
];

export const channels: ChannelDef[] = [
  { key: 't', label: 't', unit: 's' },
  { key: 'v1x', label: 'v₁ₓ', unit: 'm s⁻¹', color: '--series-1' },
  { key: 'v1y', label: 'v₁ᵧ', unit: 'm s⁻¹', color: '--series-1', dash: [6, 4] },
  { key: 'v2x', label: 'v₂ₓ', unit: 'm s⁻¹', color: '--series-2' },
  { key: 'v2y', label: 'v₂ᵧ', unit: 'm s⁻¹', color: '--series-2', dash: [6, 4] },
  { key: 'px', label: 'total pₓ', unit: 'kg m s⁻¹', color: '--series-5' },
  { key: 'py', label: 'total pᵧ', unit: 'kg m s⁻¹', color: '--series-3' },
  { key: 'K', label: 'total Eₖ', unit: 'J', color: '--series-4' },
];

export const graphs: GraphDef[] = [
  { id: 'v', title: 'Velocity components', series: ['v1x', 'v1y', 'v2x', 'v2y'] },
  { id: 'p', title: 'Total momentum (components)', series: ['px', 'py'] },
  { id: 'K', title: 'Total kinetic energy', series: ['K'] },
];

export const info: SimInfo = {
  about: [
    'Momentum is a vector. In a two-dimensional collision the total momentum is conserved in every direction separately: the x-components add up to the same total before and after, and so do the y-components.',
    'The pucks push on each other only along the line joining their centres at the moment of contact, so that is the direction of the impulse. Seen in the momentum diagram, p₁ + p₂ after the collision forms a triangle that closes on the same total p as before.',
    'A special case worth knowing: when two equal masses collide elastically and one was at rest, they move off at 90° to each other.',
  ],
  formulas: [
    { label: 'Momentum (vector)', tex: '\\vec p = m\\vec v' },
    { label: 'Conservation of momentum, by components', tex: 'm_1u_{1x} + m_2u_{2x} = m_1v_{1x} + m_2v_{2x}' },
    { tex: 'm_1u_{1y} + m_2u_{2y} = m_1v_{1y} + m_2v_{2y}' },
    { label: 'Impulse', tex: 'J = F\\Delta t = \\Delta p' },
    { label: 'Kinetic energy', tex: 'E_k = \\tfrac{1}{2}mv^{2} = \\dfrac{p^{2}}{2m}' },
    { label: 'Coefficient of restitution (along the line of centres)', tex: 'e = \\dfrac{v_{\\text{separation}}}{u_{\\text{approach}}}', beyond: true },
  ],
  assumptions: [
    'Frictionless air table; pucks are smooth rigid discs, so the impulse acts only along the line of centres and the pucks do not spin.',
    'The collision is instantaneous (no contact time is modelled here — see Collisions 1D for a force–time graph).',
    'Drawn to scale; velocity arrows and the momentum diagram are proportional to the quantities shown.',
    'Numerics: exact. Between collisions the motion is uniform, and the moment of contact is the root of a quadratic equation.',
  ],
  tryThis: [
    'Equal masses, target at rest, elastic: measure the angle between the final velocities for different b.',
    'Turn on the centre-of-mass frame: the pucks come in and leave with opposite momenta.',
    'Check in the graph that total pₓ and pᵧ are flat lines through the collision.',
    'Increase b until the pucks just miss. What is that value compared with the radii?',
  ],
};

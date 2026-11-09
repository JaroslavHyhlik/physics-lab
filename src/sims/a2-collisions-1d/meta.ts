import type { NumberParamDef } from '../../sim/params.svelte';
import type { GraphDef, Preset, SimInfo } from '../../sim/types';
import type { ChannelDef } from '../../core/recorder';

export const defaults = {
  m1: 1,
  m2: 2,
  u1: 1.5,
  u2: -0.5,
  e: 1,
  k: 400,
  arrows: true,
  bars: true,
  cm: false,
};
export type Params = typeof defaults;

export const sliders: NumberParamDef[] = [
  { key: 'm1', label: 'Mass of cart 1', symbol: 'm₁', unit: 'kg', min: 0.1, max: 10, step: 0.1 },
  { key: 'm2', label: 'Mass of cart 2', symbol: 'm₂', unit: 'kg', min: 0.1, max: 10, step: 0.1 },
  { key: 'u1', label: 'Initial velocity of cart 1', symbol: 'u₁', unit: 'm s⁻¹', min: -3, max: 3, step: 0.05 },
  { key: 'u2', label: 'Initial velocity of cart 2', symbol: 'u₂', unit: 'm s⁻¹', min: -3, max: 3, step: 0.05 },
  {
    key: 'e',
    label: 'Coefficient of restitution',
    symbol: 'e',
    unit: '',
    min: 0,
    max: 1,
    step: 0.01,
    hint: '1 = elastic, 0 = perfectly inelastic (carts stick together)',
  },
  { key: 'k', label: 'Bumper stiffness', symbol: 'k', unit: 'N m⁻¹', min: 50, max: 20000, step: 1, log: true, hint: 'Stiffer bumper → shorter contact, larger force, same impulse.' },
];

export const presets: Preset<Params>[] = [
  { id: 'swap', label: 'Equal masses, elastic (velocities swap)', values: { m1: 1, m2: 1, u1: 1.5, u2: 0, e: 1 } },
  { id: 'heavy', label: 'Heavy hits light (elastic)', values: { m1: 5, m2: 1, u1: 1.2, u2: 0, e: 1 } },
  { id: 'light', label: 'Light hits heavy (bounces back)', values: { m1: 1, m2: 5, u1: 1.5, u2: 0, e: 1 } },
  { id: 'stick', label: 'Perfectly inelastic (stick together)', values: { m1: 1, m2: 2, u1: 1.5, u2: 0, e: 0 } },
  { id: 'headon', label: 'Head-on, equal and opposite', values: { m1: 2, m2: 2, u1: 1, u2: -1, e: 0.6 } },
  { id: 'catchup', label: 'Fast cart catches a slow one', values: { m1: 1, m2: 1.5, u1: 2, u2: 0.5, e: 0.8 } },
];

export const channels: ChannelDef[] = [
  { key: 't', label: 't', unit: 's' },
  { key: 'x1', label: 'x₁', unit: 'm', color: '--series-1' },
  { key: 'x2', label: 'x₂', unit: 'm', color: '--series-2' },
  { key: 'v1', label: 'v₁', unit: 'm s⁻¹', color: '--series-1' },
  { key: 'v2', label: 'v₂', unit: 'm s⁻¹', color: '--series-2' },
  { key: 'vcm', label: 'v (centre of mass)', unit: 'm s⁻¹', color: '--series-5', dash: [6, 4] },
  { key: 'F', label: 'F (on cart 2)', unit: 'N', color: '--series-4' },
  { key: 'p1', label: 'p₁', unit: 'kg m s⁻¹', color: '--series-1' },
  { key: 'p2', label: 'p₂', unit: 'kg m s⁻¹', color: '--series-2' },
  { key: 'p', label: 'total p', unit: 'kg m s⁻¹', color: '--series-5' },
  { key: 'K1', label: 'Eₖ₁', unit: 'J', color: '--series-1' },
  { key: 'K2', label: 'Eₖ₂', unit: 'J', color: '--series-2' },
  { key: 'K', label: 'total Eₖ', unit: 'J', color: '--series-5' },
];

export const graphs: GraphDef[] = [
  { id: 'v', title: 'Velocity v–t', series: ['v1', 'v2', 'vcm'] },
  { id: 'F', title: 'Force F–t (area = impulse)', series: ['F'] },
  { id: 'p', title: 'Momentum p–t', series: ['p1', 'p2', 'p'] },
  { id: 'K', title: 'Kinetic energy', series: ['K1', 'K2', 'K'] },
  { id: 'x', title: 'Position x–t', series: ['x1', 'x2'] },
];

export const info: SimInfo = {
  about: [
    'When the carts collide, each pushes on the other with an equal and opposite force (Newton’s third law) for the same time. So the impulses FΔt are equal and opposite, and the total momentum of the two carts is the same before and after the collision.',
    'Kinetic energy is conserved only in an elastic collision (e = 1). In an inelastic collision some kinetic energy becomes internal energy (heat, sound, deformation); when the carts stick together (e = 0) the loss is the largest possible — but momentum is still conserved.',
    'The force–time graph shows the collision in slow motion: the area under it is the impulse, equal to the change of momentum of a cart. A stiffer bumper gives a shorter, taller force peak with the same area.',
  ],
  formulas: [
    { label: 'Momentum', tex: 'p = mv' },
    { label: 'Impulse', tex: 'J = F\\Delta t = \\Delta p' },
    { label: "Newton's second law", tex: 'F = ma = \\dfrac{\\Delta p}{\\Delta t}' },
    { label: 'Conservation of momentum', tex: 'm_1u_1 + m_2u_2 = m_1v_1 + m_2v_2' },
    { label: 'Kinetic energy', tex: 'E_k = \\tfrac{1}{2}mv^{2} = \\dfrac{p^{2}}{2m}' },
    { label: 'Coefficient of restitution', tex: 'e = \\dfrac{v_2 - v_1}{u_1 - u_2}', beyond: true },
  ],
  assumptions: [
    'Frictionless, level track; no air resistance; carts are rigid apart from their bumpers.',
    'Bumpers are modelled as a spring with a damper that can only push. The damping is chosen so that the collision has exactly the coefficient of restitution e. With e = 0 the carts lock together at maximum compression.',
    'Bumper compression is drawn to scale; velocity arrows and momentum bars are proportional to the quantities they show.',
    'Numerics: RK4 with a 0.1 ms step; the moment of first contact is found exactly.',
  ],
  tryThis: [
    'Check in the momentum graph that the total p is a flat line, even during the collision.',
    'Equal masses, elastic: the carts swap velocities — like Newton’s cradle.',
    'Make the bumper stiffer: what happens to the peak force and to the area under the F–t graph?',
    'For e = 0, calculate the loss of kinetic energy and compare with the energy graph.',
  ],
};

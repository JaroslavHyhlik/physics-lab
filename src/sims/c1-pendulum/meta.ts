import type { NumberParamDef } from '../../sim/params.svelte';
import type { GraphDef, Preset, SimInfo } from '../../sim/types';
import type { ChannelDef } from '../../core/recorder';
import { g, surfaceGravity } from '../../core/constants';

export const defaults = {
  l: 1.0,
  m: 1.0,
  theta0: 30, // degrees in the UI
  g,
  b: 0,
  ghost: true,
  vectors: false,
  trail: true,
};
export type Params = typeof defaults;

export const sliders: NumberParamDef[] = [
  { key: 'l', label: 'Length', symbol: 'l', unit: 'm', min: 0.1, max: 10, step: 0.01 },
  { key: 'theta0', label: 'Release angle', symbol: 'θ₀', unit: '°', min: -179, max: 179, step: 1, hint: 'Or drag the bob.' },
  { key: 'm', label: 'Mass', symbol: 'm', unit: 'kg', min: 0.05, max: 10, step: 0.05 },
  { key: 'g', label: 'Gravitational field strength', symbol: 'g', unit: 'm s⁻²', min: 1, max: 25, step: 0.01 },
  {
    key: 'b',
    label: 'Damping coefficient',
    symbol: 'b',
    unit: 'kg s⁻¹',
    min: 0,
    max: 2,
    step: 0.01,
    hint: 'Linear drag force F = −bv on the bob.',
  },
];

export const presets: Preset<Params>[] = [
  { id: 'small', label: 'Small swing (10°)', values: { theta0: 10, b: 0, l: 1, g } },
  { id: 'large', label: 'Large swing (90°)', values: { theta0: 90, b: 0, l: 1, g } },
  { id: 'inverted', label: 'Nearly inverted (170°)', values: { theta0: 170, b: 0, l: 1, g } },
  { id: 'seconds', label: 'Seconds pendulum (T = 2 s)', values: { theta0: 5, b: 0, l: g / (Math.PI * Math.PI), g } },
  { id: 'moon', label: 'On the Moon', values: { theta0: 20, b: 0, l: 1, g: surfaceGravity.Moon } },
  { id: 'jupiter', label: 'On Jupiter', values: { theta0: 20, b: 0, l: 1, g: surfaceGravity.Jupiter } },
  { id: 'damped', label: 'Damped oscillation', values: { theta0: 40, b: 0.25, l: 1, g } },
];

export const channels: ChannelDef[] = [
  { key: 't', label: 't', unit: 's' },
  { key: 'theta', label: 'θ', unit: 'rad', color: '--series-1' },
  { key: 'thetaSmall', label: 'θ (small-angle)', unit: 'rad', color: '--series-5' },
  { key: 's', label: 'arc displacement s', unit: 'm', color: '--series-1' },
  { key: 'v', label: 'v', unit: 'm s⁻¹', color: '--series-2' },
  { key: 'a', label: 'tangential a', unit: 'm s⁻²', color: '--series-3' },
  { key: 'Ek', label: 'Eₖ', unit: 'J', color: '--series-2' },
  { key: 'Ep', label: 'Eₚ', unit: 'J', color: '--series-3' },
  { key: 'E', label: 'E total', unit: 'J', color: '--series-4' },
];

export const graphs: GraphDef[] = [
  { id: 'theta', title: 'Angle θ–t', series: ['theta', 'thetaSmall'] },
  { id: 's', title: 'Displacement s–t', series: ['s'] },
  { id: 'v', title: 'Velocity v–t', series: ['v'] },
  { id: 'a', title: 'Acceleration a–t', series: ['a'] },
  { id: 'E', title: 'Energy', series: ['Ek', 'Ep', 'E'] },
];

export const info: SimInfo = {
  about: [
    'A bob on a string swings under gravity. For small angles the restoring acceleration is proportional to the displacement, so the motion is simple harmonic and the period depends only on l and g — not on the mass or (almost) the amplitude.',
    'For large angles sin θ is no longer ≈ θ: the restoring force is weaker than SHM predicts and the period grows. This simulation solves the exact equation, and the faint “ghost” pendulum shows what the small-angle approximation would predict.',
    'Energy flows between kinetic and gravitational potential energy. With damping, the total energy is dissipated and the amplitude decays.',
  ],
  formulas: [
    { label: 'Period of a simple pendulum (small angles)', tex: 'T = 2\\pi\\sqrt{\\dfrac{l}{g}}' },
    { label: 'Defining equation of SHM', tex: 'a = -\\omega^2 x' },
    { label: 'Period and angular frequency', tex: 'T = \\dfrac{1}{f} = \\dfrac{2\\pi}{\\omega}' },
    { label: 'Displacement in SHM', tex: 'x = x_0 \\sin(\\omega t + \\phi)', hl: true },
    { label: 'Velocity in SHM', tex: 'v = \\pm\\,\\omega\\sqrt{x_0^{2} - x^{2}}', hl: true },
    { label: 'Total energy in SHM', tex: 'E_T = \\tfrac{1}{2} m \\omega^2 x_0^{2}', hl: true },
    { label: 'Change in gravitational potential energy', tex: '\\Delta E_p = mg\\Delta h' },
    {
      label: 'Exact period for any amplitude (K = complete elliptic integral)',
      tex: 'T = 4\\sqrt{\\dfrac{l}{g}}\\;K\\!\\left(\\sin\\dfrac{\\theta_0}{2}\\right)',
      beyond: true,
    },
    {
      label: 'Equation of motion solved here',
      tex: '\\ddot{\\theta} = -\\dfrac{g}{l}\\sin\\theta - \\dfrac{b}{m}\\,\\dot{\\theta}',
      beyond: true,
    },
  ],
  assumptions: [
    'Point-mass bob on a massless, inextensible string; the frictionless pivot is fixed.',
    'The bob is drawn larger than a point for visibility (not to scale).',
    'Air resistance is modelled only by the optional linear damping force F = −bv.',
    'Uniform gravitational field g.',
    'Numerics: Yoshida 4th-order symplectic integrator without damping, RK4 with damping, fixed step 1 ms. Period is measured between successive upward zero crossings.',
  ],
  tryThis: [
    'Use the stopwatch to time 10 swings, like in the lab, and compare with T = 2π√(l/g).',
    'Increase θ₀ to 90° and watch the real pendulum fall behind the small-angle ghost.',
    'Change the mass: the motion does not change, but the energy does.',
    'Set the length to make a “seconds pendulum” with T = 2.00 s.',
  ],
};

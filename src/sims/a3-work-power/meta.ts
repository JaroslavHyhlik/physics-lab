import type { NumberParamDef } from '../../sim/params.svelte';
import type { GraphDef, Preset, SimInfo } from '../../sim/types';
import type { ChannelDef } from '../../core/recorder';
import { g } from '../../core/constants';

export const defaults = { Pin: 2000, eta: 0.8, Fmax: 3000, m: 100, theta: 30, mu: 0.2, L: 10, g, sankey: true };
export type Params = typeof defaults;

export const sliders: NumberParamDef[] = [
  { key: 'Pin', label: 'Input power of the motor', symbol: 'P_in', unit: 'W', min: 50, max: 100000, step: 1, log: true },
  { key: 'eta', label: 'Efficiency of the motor', symbol: 'η', unit: '', min: 0.05, max: 1, step: 0.01 },
  { key: 'Fmax', label: 'Maximum pulling force', symbol: 'F_max', unit: 'N', min: 10, max: 100000, step: 1, log: true },
  { key: 'm', label: 'Mass of the load', symbol: 'm', unit: 'kg', min: 1, max: 5000, step: 1, log: true },
  { key: 'theta', label: 'Angle of the slope', symbol: 'θ', unit: '°', min: 0, max: 90, step: 1 },
  { key: 'mu', label: 'Coefficient of friction', symbol: 'μ', unit: '', min: 0, max: 1, step: 0.01 },
  { key: 'L', label: 'Length of the slope', symbol: 'L', unit: 'm', min: 2, max: 50, step: 1 },
  { key: 'g', label: 'Gravitational field strength', symbol: 'g', unit: 'm s⁻²', min: 1, max: 25, step: 0.01 },
];

export const presets: Preset<Params>[] = [
  { id: 'crane', label: 'Crane lifting a load', values: { Pin: 5000, eta: 0.75, Fmax: 8000, m: 300, theta: 90, mu: 0, L: 15 } },
  { id: 'slope', label: 'Winch pulling a crate up a slope', values: { Pin: 2000, eta: 0.8, Fmax: 3000, m: 100, theta: 30, mu: 0.2, L: 10 } },
  { id: 'floor', label: 'Dragging a crate along the floor', values: { Pin: 1000, eta: 0.85, Fmax: 2000, m: 150, theta: 0, mu: 0.4, L: 10 } },
  { id: 'ideal', label: 'Ideal motor, no friction', values: { Pin: 2000, eta: 1, Fmax: 5000, m: 100, theta: 30, mu: 0, L: 10 } },
  { id: 'weak', label: 'Force too small to move it', values: { Pin: 2000, eta: 0.8, Fmax: 400, m: 100, theta: 30, mu: 0.2, L: 10 } },
];

export const channels: ChannelDef[] = [
  { key: 't', label: 't', unit: 's' },
  { key: 'v', label: 'v', unit: 'm s⁻¹', color: '--series-2' },
  { key: 'F', label: 'rope force F', unit: 'N', color: '--series-3' },
  { key: 'Pin', label: 'input power', unit: 'W', color: '--series-1' },
  { key: 'Pr', label: 'power delivered Fv', unit: 'W', color: '--series-3' },
  { key: 'Pu', label: 'useful power (rate of Eₚ)', unit: 'W', color: '--series-5' },
  { key: 'Ein', label: 'input energy', unit: 'J', color: '--series-1' },
  { key: 'W', label: 'work done by rope', unit: 'J', color: '--series-3' },
  { key: 'Ep', label: 'Eₚ gained', unit: 'J', color: '--series-5' },
  { key: 'Q', label: 'heat (motor + friction)', unit: 'J', color: '--series-4' },
];

export const graphs: GraphDef[] = [
  { id: 'P', title: 'Power', series: ['Pin', 'Pr', 'Pu'] },
  { id: 'E', title: 'Energy', series: ['Ein', 'W', 'Ep', 'Q'] },
  { id: 'v', title: 'Velocity v–t', series: ['v'] },
  { id: 'F', title: 'Rope force', series: ['F'] },
];

export const info: SimInfo = {
  about: [
    'Work is done when a force moves its point of application: W = Fs cosθ. Power is the rate of doing work, so for a force pulling at speed v, P = Fv.',
    'The motor can only deliver a certain power. At the start the speed is small and the force is limited by F_max; as the speed rises the force has to fall (F = P/v), until it just balances the weight component and friction. Then the load moves at a constant speed v = P/F.',
    'Not all the input energy is useful. Some is lost as heat in the motor (its efficiency η) and some as heat due to friction. The Sankey diagram shows where every watt goes.',
  ],
  formulas: [
    { label: 'Work done', tex: 'W = Fs\\cos\\theta' },
    { label: 'Power', tex: 'P = \\dfrac{\\Delta W}{\\Delta t} = Fv' },
    { label: 'Efficiency', tex: '\\eta = \\dfrac{\\text{useful work out}}{\\text{total work in}} = \\dfrac{\\text{useful power out}}{\\text{total power in}}' },
    { label: 'Gravitational potential energy', tex: '\\Delta E_p = mg\\Delta h' },
    { label: 'Kinetic energy', tex: 'E_k = \\tfrac{1}{2}mv^{2}' },
    { label: 'Dynamic friction', tex: 'F_f = \\mu_d F_N' },
  ],
  assumptions: [
    'The motor delivers a constant output power ηP_in, but never more force than F_max.',
    'Light, inextensible rope parallel to the slope; one constant coefficient of friction; no air resistance.',
    '“Useful” output means the gain in gravitational potential energy; on a level floor nothing useful is stored, so all the work ends up as heat.',
    'The load stops at the top of the slope. Drawn to scale except the crate and winch.',
    'Numerics: RK4 with a 1 ms step; energies are integrated alongside the motion.',
  ],
  tryThis: [
    'Check P = Fv at the final steady speed using the readouts.',
    'Double the input power: what happens to the final speed?',
    'Compare the overall efficiency (useful power / input power) with η for different slopes and friction.',
    'Drag the crate along the floor: where does all the energy go?',
  ],
};

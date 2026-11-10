import type { NumberParamDef } from '../../sim/params.svelte';
import type { GraphDef, Preset, SimInfo } from '../../sim/types';
import type { ChannelDef } from '../../core/recorder';
import { g, surfaceGravity } from '../../core/constants';

export const defaults = { k: 400, dx: 0.1, m: 0.05, g, bars: true };
export type Params = typeof defaults;

export const sliders: NumberParamDef[] = [
  { key: 'k', label: 'Spring constant', symbol: 'k', unit: 'N m⁻¹', min: 10, max: 2000, step: 1, log: true },
  { key: 'dx', label: 'Compression', symbol: 'Δx', unit: 'm', min: 0.01, max: 0.3, step: 0.005, decimals: 3 },
  { key: 'm', label: 'Mass of the ball', symbol: 'm', unit: 'kg', min: 0.005, max: 1, step: 0.001, log: true },
  { key: 'g', label: 'Gravitational field strength', symbol: 'g', unit: 'm s⁻²', min: 1, max: 25, step: 0.01 },
];

export const presets: Preset<Params>[] = [
  { id: 'toy', label: 'Toy launcher', values: { k: 400, dx: 0.1, m: 0.05, g } },
  { id: 'stiff', label: 'Stiff spring, heavy ball', values: { k: 2000, dx: 0.08, m: 0.5, g } },
  { id: 'weak', label: 'Too weak to launch', values: { k: 15, dx: 0.05, m: 0.05, g } },
  { id: 'moon', label: 'Same launcher on the Moon', values: { k: 400, dx: 0.1, m: 0.05, g: surfaceGravity.Moon } },
];

export const channels: ChannelDef[] = [
  { key: 't', label: 't', unit: 's' },
  { key: 'y', label: 'height y', unit: 'm', color: '--series-1' },
  { key: 'v', label: 'v', unit: 'm s⁻¹', color: '--series-2' },
  { key: 'a', label: 'a', unit: 'm s⁻²', color: '--series-3' },
  { key: 'EH', label: 'E_H (elastic)', unit: 'J', color: '--series-5' },
  { key: 'Ek', label: 'Eₖ', unit: 'J', color: '--series-2' },
  { key: 'Ep', label: 'Eₚ', unit: 'J', color: '--series-3' },
  { key: 'E', label: 'total', unit: 'J', color: '--series-4' },
  { key: 'F', label: 'spring force F_H', unit: 'N', color: '--series-5' },
];

export const graphs: GraphDef[] = [
  { id: 'E', title: 'Energy', series: ['EH', 'Ek', 'Ep', 'E'] },
  { id: 'y', title: 'Height y–t', series: ['y'] },
  { id: 'v', title: 'Velocity v–t', series: ['v'] },
  { id: 'F', title: 'Spring force', series: ['F'] },
];

export const info: SimInfo = {
  about: [
    'A compressed spring stores elastic potential energy E_H = ½kΔx². When released, it does work on the ball: the elastic energy becomes kinetic energy (and a little gravitational energy while the spring extends).',
    'Once the ball leaves the spring it rises until all its kinetic energy has become gravitational potential energy. With no friction or air resistance the total energy never changes, so the height reached follows directly from ½kΔx² = mgH.',
    'The spring force obeys Hooke’s law: it is proportional to the compression. Doubling Δx doubles the force but quadruples the stored energy.',
  ],
  formulas: [
    { label: "Hooke's law", tex: 'F_H = -kx' },
    { label: 'Elastic potential energy', tex: 'E_H = \\tfrac{1}{2}k\\Delta x^{2}' },
    { label: 'Kinetic energy', tex: 'E_k = \\tfrac{1}{2}mv^{2}' },
    { label: 'Gravitational potential energy', tex: '\\Delta E_p = mg\\Delta h' },
    { label: 'Height gained above the release point', tex: '\\tfrac{1}{2}k\\Delta x^{2} = mgH', beyond: true },
  ],
  assumptions: [
    'Light (massless) spring; the ball is not attached and leaves when the spring reaches its natural length.',
    'No air resistance and no energy lost in the spring.',
    'Heights are measured from the bottom of the ball; the drawing is to scale, the ball is drawn at a fixed size.',
    'Numerics: exact — SHM while on the spring, uniform acceleration in the air, with the switching moments solved analytically.',
  ],
  tryThis: [
    'Double the compression: how much higher does the ball go? (4×)',
    'Check in the energy graph that the total stays constant.',
    'Find the smallest compression that still launches the ball (kΔx = 2mg).',
    'Take the launcher to the Moon: how much higher?',
  ],
};

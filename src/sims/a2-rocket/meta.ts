import type { NumberParamDef } from '../../sim/params.svelte';
import type { GraphDef, Preset, SimInfo } from '../../sim/types';
import type { ChannelDef } from '../../core/recorder';

export const defaults = {
  dry: 300,
  fuel: 700,
  mdot: 25,
  ve: 2200,
  Cd: 0.4,
  d: 0.4,
  drag: true,
  gravity: true,
  variableG: true,
  forces: true,
};
export type Params = typeof defaults;

export const sliders: NumberParamDef[] = [
  { key: 'dry', label: 'Dry mass (rocket without fuel)', symbol: 'm_f', unit: 'kg', min: 0.05, max: 50000, step: 0.01, log: true },
  { key: 'fuel', label: 'Fuel mass', unit: 'kg', min: 0.005, max: 500000, step: 0.001, log: true },
  { key: 'mdot', label: 'Burn rate', symbol: 'Δm/Δt', unit: 'kg s⁻¹', min: 0.001, max: 5000, step: 0.001, log: true },
  { key: 've', label: 'Exhaust speed', symbol: 'v_e', unit: 'm s⁻¹', min: 300, max: 4500, step: 10 },
  { key: 'Cd', label: 'Drag coefficient', symbol: 'C_d', unit: '', min: 0.1, max: 1.2, step: 0.01 },
  { key: 'd', label: 'Diameter', symbol: 'd', unit: 'm', min: 0.01, max: 5, step: 0.01, log: true },
];

export const presets: Preset<Params>[] = [
  { id: 'model', label: 'Model rocket (C motor)', values: { dry: 0.1, fuel: 0.0123, mdot: 0.00665, ve: 813, Cd: 0.75, d: 0.025, drag: true, gravity: true } },
  { id: 'sounding', label: 'Sounding rocket', values: { dry: 300, fuel: 700, mdot: 25, ve: 2200, Cd: 0.4, d: 0.4, drag: true, gravity: true } },
  { id: 'falcon', label: 'Large first stage (≈ Falcon 9)', values: { dry: 25600, fuel: 395700, mdot: 2500, ve: 2770, Cd: 0.3, d: 3.7, drag: true, gravity: true } },
  { id: 'space', label: 'Deep space: no gravity, no air', values: { dry: 300, fuel: 700, mdot: 25, ve: 2200, drag: false, gravity: false } },
  { id: 'weak', label: 'Thrust < weight: no lift-off', values: { dry: 300, fuel: 700, mdot: 3, ve: 2200, drag: true, gravity: true } },
];

export const channels: ChannelDef[] = [
  { key: 't', label: 't', unit: 's' },
  { key: 'h', label: 'altitude h', unit: 'm', color: '--series-1' },
  { key: 'v', label: 'v', unit: 'm s⁻¹', color: '--series-2' },
  { key: 'a', label: 'a', unit: 'm s⁻²', color: '--series-3' },
  { key: 'm', label: 'mass m', unit: 'kg', color: '--series-5' },
  { key: 'F', label: 'thrust', unit: 'N', color: '--series-3' },
  { key: 'W', label: 'weight', unit: 'N', color: '--series-2' },
  { key: 'D', label: 'drag', unit: 'N', color: '--series-4' },
];

export const graphs: GraphDef[] = [
  { id: 'h', title: 'Altitude h–t', series: ['h'] },
  { id: 'v', title: 'Velocity v–t', series: ['v'] },
  { id: 'a', title: 'Acceleration a–t', series: ['a'] },
  { id: 'm', title: 'Mass m–t', series: ['m'] },
  { id: 'F', title: 'Forces', series: ['F', 'W', 'D'] },
];

export const info: SimInfo = {
  about: [
    'A rocket pushes exhaust gas backwards. By Newton’s third law the gas pushes the rocket forwards: the thrust equals the rate of change of momentum of the exhaust, F = v_e Δm/Δt.',
    'As fuel burns the mass falls, so the same thrust gives a growing acceleration. Watch the a–t graph rise during the burn — until air resistance (largest low down, where the air is dense) and the end of the fuel take over.',
    'Without gravity and air the speed gained depends only on the exhaust speed and the mass ratio (Tsiolkovsky’s equation) — try the “Deep space” preset and compare. High up, gravity is weaker (inverse-square law), so the rocket climbs higher than a constant-g estimate.',
  ],
  formulas: [
    { label: "Newton's second law (momentum form)", tex: 'F = \\dfrac{\\Delta p}{\\Delta t}' },
    { label: 'Thrust', tex: 'F = v_e\\,\\dfrac{\\Delta m}{\\Delta t}', beyond: true },
    { label: 'Equation of motion (up +)', tex: 'ma = F - mg - F_{\\text{drag}}' },
    { label: 'Gravitational field strength', tex: 'g = \\dfrac{GM}{r^{2}}' },
    { label: 'Tsiolkovsky rocket equation', tex: '\\Delta v = v_e \\ln\\dfrac{m_0}{m_f}', beyond: true },
    { label: 'Air resistance', tex: 'F_{\\text{drag}} = \\tfrac{1}{2}\\rho C_d A v^{2}, \\quad \\rho = \\rho_0 e^{-h/H}', beyond: true },
  ],
  assumptions: [
    'Vertical flight only; constant burn rate and exhaust speed; thrust does not change with air pressure.',
    'Earth is a sphere of radius 6370 km with g = 9.8 m s⁻² at the surface; g falls as 1/r² (switchable); Earth’s rotation is ignored.',
    'Air density falls exponentially with altitude (scale height 8.5 km); C_d is constant.',
    'A single stage: for the large first stage, the upper stage and payload are left out. The rocket is drawn at a fixed size (not to scale) while the view zooms out.',
    'Numerics: RK4 with a 1 ms step; the moment of burnout is found exactly.',
  ],
  tryThis: [
    'In the “Deep space” preset compare the final speed with v_e ln(m₀/m_f).',
    'Why does the acceleration keep increasing during the burn?',
    'Reduce the burn rate until the rocket no longer lifts off: then thrust < weight.',
    'Switch off “g decreases with height” and compare the maximum altitude.',
  ],
};

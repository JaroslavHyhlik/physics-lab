import type { NumberParamDef } from '../../sim/params.svelte';
import type { GraphDef, Preset, SimInfo } from '../../sim/types';
import type { ChannelDef } from '../../core/recorder';
import { g } from '../../core/constants';

export const fluids = [
  { id: 'glycerol', label: 'Glycerol', rho: 1260, eta: 1.41 },
  { id: 'honey', label: 'Honey', rho: 1420, eta: 10 },
  { id: 'oil', label: 'Olive oil', rho: 910, eta: 0.084 },
  { id: 'water', label: 'Water', rho: 1000, eta: 1.0e-3 },
  { id: 'air', label: 'Air', rho: 1.2, eta: 1.8e-5 },
];
export const materials = [
  { id: 'steel', label: 'Steel', rho: 7850 },
  { id: 'glass', label: 'Glass', rho: 2500 },
  { id: 'aluminium', label: 'Aluminium', rho: 2700 },
  { id: 'nylon', label: 'Nylon', rho: 1150 },
  { id: 'cork', label: 'Cork', rho: 240 },
];

export const defaults = {
  r: 2, // mm in the UI
  rhoS: 7850,
  rhoF: 1260,
  eta: 1.41,
  H: 0.5,
  u: 0,
  g,
  forces: true,
};
export type Params = typeof defaults;

export const sliders: NumberParamDef[] = [
  { key: 'r', label: 'Radius of the sphere', symbol: 'r', unit: 'mm', min: 0.3, max: 15, step: 0.1 },
  { key: 'rhoS', label: 'Density of the sphere', symbol: 'ρ_s', unit: 'kg m⁻³', min: 100, max: 11000, step: 10 },
  { key: 'rhoF', label: 'Density of the fluid', symbol: 'ρ_f', unit: 'kg m⁻³', min: 1, max: 2000, step: 1 },
  { key: 'eta', label: 'Viscosity of the fluid', symbol: 'η', unit: 'Pa s', min: 1e-5, max: 20, step: 1e-5, log: true },
  { key: 'H', label: 'Depth of the fluid', unit: 'm', min: 0.1, max: 2, step: 0.05 },
  { key: 'u', label: 'Initial velocity (down +)', symbol: 'u', unit: 'm s⁻¹', min: -0.5, max: 0.5, step: 0.01 },
  { key: 'g', label: 'Gravitational field strength', symbol: 'g', unit: 'm s⁻²', min: 1, max: 25, step: 0.01 },
];

export const presets: Preset<Params>[] = [
  { id: 'lab', label: 'Lab: steel ball in glycerol', values: { r: 2, rhoS: 7850, rhoF: 1260, eta: 1.41, H: 0.5, u: 0 } },
  { id: 'honey', label: 'Glass bead in honey', values: { r: 3, rhoS: 2500, rhoF: 1420, eta: 10, H: 0.3, u: 0 } },
  { id: 'oil', label: 'Small steel ball in olive oil', values: { r: 0.5, rhoS: 7850, rhoF: 910, eta: 0.084, H: 0.5, u: 0 } },
  { id: 'cork', label: 'Cork rising in water', values: { r: 1, rhoS: 240, rhoF: 1000, eta: 1e-3, H: 0.5, u: 0 } },
  { id: 'fast', label: 'Thrown in faster than v_t', values: { r: 2, rhoS: 7850, rhoF: 1260, eta: 1.41, H: 0.5, u: 0.3 } },
  { id: 'water', label: 'Steel ball in water (Stokes fails!)', values: { r: 2, rhoS: 7850, rhoF: 1000, eta: 1e-3, H: 1, u: 0 } },
];

export const channels: ChannelDef[] = [
  { key: 't', label: 't', unit: 's' },
  { key: 'y', label: 'depth fallen', unit: 'm', color: '--series-1' },
  { key: 'v', label: 'v', unit: 'm s⁻¹', color: '--series-2' },
  { key: 'vt', label: 'v_t', unit: 'm s⁻¹', color: '--series-5', dash: [6, 4] },
  { key: 'a', label: 'a', unit: 'm s⁻²', color: '--series-3' },
  { key: 'W', label: 'weight', unit: 'N', color: '--series-2' },
  { key: 'Fb', label: 'buoyancy', unit: 'N', color: '--series-3' },
  { key: 'Fd', label: 'drag', unit: 'N', color: '--series-4' },
];

export const graphs: GraphDef[] = [
  { id: 'v', title: 'Velocity v–t', series: ['v', 'vt'] },
  { id: 'y', title: 'Depth–time', series: ['y'] },
  { id: 'a', title: 'Acceleration a–t', series: ['a'] },
  { id: 'F', title: 'Forces', series: ['W', 'Fb', 'Fd'] },
];

export const info: SimInfo = {
  about: [
    'Three forces act on a sphere in a fluid: its weight, the upward buoyancy force (the weight of fluid it pushes aside, Archimedes’ principle), and viscous drag opposite to its velocity.',
    'At first the sphere is slow, the drag is small and it accelerates. Stokes’ law says the drag grows in proportion to the speed, so the acceleration falls until drag + buoyancy = weight. From then on the sphere moves at a constant terminal velocity.',
    'This is a classic lab experiment: time the ball between two marks after it reaches terminal velocity and use v_t to find the viscosity of the fluid.',
    'Stokes’ law only describes slow, smooth (laminar) flow. The Reynolds number Re shows whether this is true: Re ≲ 1 is fine; for Re ≫ 1 (a steel ball in water) the real drag is much larger and the real terminal velocity smaller than shown.',
  ],
  formulas: [
    { label: "Stokes' law (viscous drag on a sphere)", tex: 'F_d = 6\\pi\\eta r v' },
    { label: 'Buoyancy', tex: 'F_b = \\rho V g' },
    { label: 'Weight', tex: 'F_g = mg' },
    { label: 'Density', tex: '\\rho = \\dfrac{m}{V}, \\qquad V = \\tfrac{4}{3}\\pi r^{3}' },
    { label: 'Terminal velocity (from F_g = F_b + F_d)', tex: 'v_t = \\dfrac{2r^{2}g(\\rho_s - \\rho_f)}{9\\eta}', beyond: true },
    { label: 'Approach to terminal velocity', tex: 'v = v_t\\left(1 - e^{-t/\\tau}\\right), \\qquad \\tau = \\dfrac{m}{6\\pi\\eta r}', beyond: true },
    { label: 'Reynolds number', tex: 'Re = \\dfrac{\\rho_f v\\, 2r}{\\eta}', beyond: true },
  ],
  assumptions: [
    'Drag is given by Stokes’ law only (valid for Re ≲ 1). No quadratic drag, no wall effects from the cylinder, no added-mass effect.',
    'The sphere starts fully submerged; it stops when it reaches the bottom (or the surface if it rises).',
    'The sphere is drawn larger than to scale when it is very small; force arrows are proportional to the forces.',
    'Numerics: RK4 with substeps much shorter than the time constant τ; tests compare with the exact exponential solution.',
  ],
  tryThis: [
    'Use the stopwatch and ruler to measure v_t between two marks, then calculate η from v_t.',
    'Double the radius: by what factor does v_t change? (v_t ∝ r²)',
    'Choose the steel ball in water and read the Reynolds number. Why are the results unrealistic there?',
    'Make the sphere less dense than the fluid: what happens?',
  ],
};

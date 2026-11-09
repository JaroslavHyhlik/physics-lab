import type { NumberParamDef } from '../../sim/params.svelte';
import type { GraphDef, SimInfo } from '../../sim/types';
import type { ChannelDef } from '../../core/recorder';
import { vehicles } from './vehicles';

const sports = vehicles.find((v) => v.id === 'sports')!.params;

export const defaults = {
  vehicle: 'sports',
  m: sports.m,
  P: sports.Pmax / 1000, // kW in the UI
  Cd: sports.Cd,
  A: sports.A,
  rho: sports.rho,
  Crr: sports.Crr,
  mu: sports.mu,
  eta: sports.eta,
  shiftTime: sports.shiftTime,
  u: sports.u,
  drag: true,
  roll: true,
  grip: true,
  forces: true,
};
export type Params = typeof defaults;

/** UI values from a vehicle preset. */
export function fromVehicle(id: string): Partial<Params> {
  const v = vehicles.find((x) => x.id === id) ?? vehicles[1];
  const p = v.params;
  return {
    vehicle: v.id,
    m: p.m,
    P: p.Pmax / 1000,
    Cd: p.Cd,
    A: p.A,
    rho: p.rho,
    Crr: p.Crr,
    mu: p.mu,
    eta: p.eta,
    shiftTime: p.shiftTime,
    u: p.u,
    drag: p.drag,
    roll: p.roll,
    grip: p.grip,
  };
}

export const sliders: NumberParamDef[] = [
  { key: 'm', label: 'Mass', symbol: 'm', unit: 'kg', min: 300, max: 40000, step: 10, log: true },
  { key: 'P', label: 'Maximum power', symbol: 'P', unit: 'kW', min: 5, max: 1500, step: 1, log: true },
  { key: 'u', label: 'Initial speed', symbol: 'u', unit: 'm s⁻¹', min: 0, max: 40, step: 0.5 },
  { key: 'mu', label: 'Tyre grip (static friction)', symbol: 'μ_s', unit: '', min: 0.05, max: 1.5, step: 0.01 },
  { key: 'Cd', label: 'Drag coefficient', symbol: 'C_d', unit: '', min: 0.15, max: 1.2, step: 0.01 },
  { key: 'A', label: 'Frontal area', symbol: 'A', unit: 'm²', min: 0.5, max: 12, step: 0.1 },
  { key: 'rho', label: 'Air density', symbol: 'ρ', unit: 'kg m⁻³', min: 0, max: 1.5, step: 0.01 },
  { key: 'Crr', label: 'Rolling resistance coefficient', symbol: 'C_rr', unit: '', min: 0, max: 0.05, step: 0.001 },
  { key: 'eta', label: 'Drivetrain efficiency', symbol: 'η', unit: '', min: 0.5, max: 1, step: 0.01 },
  { key: 'shiftTime', label: 'Gear shift time', unit: 's', min: 0, max: 1.5, step: 0.05 },
];

export const channels: ChannelDef[] = [
  { key: 't', label: 't', unit: 's' },
  { key: 'x', label: 'x', unit: 'm', color: '--series-1' },
  { key: 'v', label: 'v', unit: 'm s⁻¹', color: '--series-2' },
  { key: 'a', label: 'a', unit: 'm s⁻²', color: '--series-3' },
  { key: 'Fd', label: 'driving force', unit: 'N', color: '--series-3' },
  { key: 'Fa', label: 'air resistance', unit: 'N', color: '--series-4' },
  { key: 'Fr', label: 'rolling resistance', unit: 'N', color: '--series-2' },
  { key: 'P', label: 'power at wheels', unit: 'kW', color: '--series-5' },
  { key: 'rpm', label: 'engine speed', unit: 'rpm', color: '--series-6' },
  { key: 'gear', label: 'gear', unit: '', color: '--series-1' },
];

export const graphs: GraphDef[] = [
  { id: 'x', title: 'Position x–t', series: ['x'] },
  { id: 'v', title: 'Velocity v–t', series: ['v'] },
  { id: 'a', title: 'Acceleration a–t', series: ['a'] },
  { id: 'F', title: 'Forces', series: ['Fd', 'Fa', 'Fr'] },
  { id: 'P', title: 'Power', series: ['P'] },
  { id: 'rpm', title: 'Engine speed', series: ['rpm'] },
];

export const info: SimInfo = {
  about: [
    'A car accelerates from rest on a flat road. The engine delivers power through the gearbox to the wheels; the force that pushes the car forward is the friction force of the road on the tyres.',
    'At low speed the tyres limit the force (they would spin), so the acceleration is nearly constant. Later the engine power limits it: since P = Fv, the driving force falls as the speed rises. Air resistance grows with v², so eventually the driving force equals the resistive forces and the car reaches its top speed — the v–t graph levels off and a → 0.',
    'The x–t graph is the area under the v–t graph; the a–t graph is the gradient of the v–t graph. Each gear change shows as a dip in the a–t graph.',
  ],
  formulas: [
    { label: 'Equations of motion for uniform acceleration', tex: 'v = u + at \\qquad s = ut + \\tfrac{1}{2}at^{2}' },
    { tex: 'v^{2} = u^{2} + 2as \\qquad s = \\dfrac{(u+v)t}{2}' },
    { label: "Newton's second law", tex: 'F = ma' },
    { label: 'Power', tex: 'P = \\dfrac{\\Delta W}{\\Delta t} = Fv' },
    { label: 'Efficiency', tex: '\\eta = \\dfrac{\\text{useful power out}}{\\text{total power in}}' },
    { label: 'Static friction (tyre grip limit)', tex: 'F_f \\le \\mu_s F_N' },
    { label: 'Kinetic energy and work', tex: 'E_k = \\tfrac{1}{2}mv^{2} \\qquad W = Fs\\cos\\theta' },
    { label: 'Air resistance (quadratic drag)', tex: 'F_{\\text{drag}} = \\tfrac{1}{2}\\rho C_d A v^{2}', beyond: true },
    { label: 'Rolling resistance', tex: 'F_{\\text{roll}} = C_{rr}\\, m g', beyond: true },
  ],
  assumptions: [
    'Flat, straight road; no wind; constant air density.',
    'Driving force is limited to μ_s × (weight on the driven wheels). Weight transfer to the rear axle during acceleration is ignored, and during wheelspin the force stays at this limit (real spinning tyres grip slightly less).',
    'Rotational inertia of wheels, gears and engine is ignored (the car is a single rigid mass).',
    'Petrol/diesel engines use a smooth polynomial power curve; a slipping clutch holds the engine at launch rpm until the wheels catch up. No driving force during a gear change.',
    'Electric motor: constant maximum torque up to the base speed, then constant power.',
    'Car drawn to scale; force arrows are proportional to the forces they show.',
    'Numerics: RK4 with a fixed step of 1 ms; gear changes happen between steps.',
  ],
  tryThis: [
    'Read the gradient of the v–t graph at two moments and compare with the a–t graph.',
    'Switch off air resistance: does the car still have a top speed? Why does a still fall?',
    'Choose “Ideal: constant power” and check v = √(u² + 2Pt/m) at t = 10 s.',
    'Reduce the tyre grip to 0.3 (ice) and watch the 0–100 km/h time.',
  ],
};

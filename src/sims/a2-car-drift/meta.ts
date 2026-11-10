import type { NumberParamDef } from '../../sim/params.svelte';
import type { GraphDef, Preset, SimInfo } from '../../sim/types';
import type { ChannelDef } from '../../core/recorder';

export const defaults = { muS: 1.0, muD: 0.8, P: 200, m: 1300, front: 46, Ck: 12, forces: true, circles: true };
export type Params = typeof defaults;

export const sliders: NumberParamDef[] = [
  { key: 'muS', label: 'Tyre static friction', symbol: 'μ_s', unit: '', min: 0.05, max: 1.5, step: 0.01 },
  { key: 'muD', label: 'Tyre dynamic (sliding) friction', symbol: 'μ_d', unit: '', min: 0.04, max: 1.5, step: 0.01 },
  { key: 'P', label: 'Engine power (rear wheels)', symbol: 'P', unit: 'kW', min: 20, max: 600, step: 5 },
  { key: 'm', label: 'Mass', symbol: 'm', unit: 'kg', min: 800, max: 2500, step: 10 },
  { key: 'front', label: 'Weight on the front axle', unit: '%', min: 30, max: 70, step: 1 },
  { key: 'Ck', label: 'Tyre cornering stiffness', unit: 'rad⁻¹', min: 4, max: 25, step: 0.5, hint: 'Sideways force per unit normal force per radian of slip angle.' },
];

export const presets: Preset<Params>[] = [
  { id: 'dry', label: 'Dry asphalt', values: { muS: 1.0, muD: 0.8, P: 200 } },
  { id: 'wet', label: 'Wet road', values: { muS: 0.6, muD: 0.45, P: 200 } },
  { id: 'snow', label: 'Snow', values: { muS: 0.3, muD: 0.22, P: 150 } },
  { id: 'ice', label: 'Ice', values: { muS: 0.1, muD: 0.07, P: 100 } },
  { id: 'drift', label: 'Drift car (450 kW, rear-biased)', values: { muS: 1.0, muD: 0.75, P: 450, front: 44 } },
];

export const channels: ChannelDef[] = [
  { key: 't', label: 't', unit: 's' },
  { key: 'v', label: 'speed', unit: 'm s⁻¹', color: '--series-2' },
  { key: 'beta', label: 'drift angle β', unit: '°', color: '--series-4' },
  { key: 'ay', label: 'sideways acceleration', unit: 'g', color: '--series-3' },
  { key: 'r', label: 'yaw rate', unit: '° s⁻¹', color: '--series-5' },
];

export const graphs: GraphDef[] = [
  { id: 'beta', title: 'Drift angle', series: ['beta'] },
  { id: 'ay', title: 'Sideways acceleration', series: ['ay'] },
  { id: 'v', title: 'Speed', series: ['v'] },
  { id: 'r', title: 'Yaw rate', series: ['r'] },
];

export const info: SimInfo = {
  about: [
    'Every force that steers, accelerates or brakes a car is a friction force between the tyres and the road. Each tyre can provide at most μ_s F_N in total — whether you use it for turning, accelerating or braking (the “friction circle”).',
    'While the tyre grips, the contact patch does not slide: static friction acts. Ask for more than μ_s F_N — too much throttle in a corner, or the handbrake — and the tyre starts to slide. Now dynamic friction acts, and μ_d < μ_s, so the grip suddenly drops.',
    'If the rear tyres slide while the fronts still grip, the back of the car swings out: oversteer, or a drift. Because sliding friction is smaller, the tyres only grip again once you ask for much less force — so a drift is easy to start and hard to stop.',
    'Controls: arrow keys or W A S D to drive, H for the handbrake, or use the on-screen buttons.',
  ],
  formulas: [
    { label: 'Static friction (tyre gripping)', tex: 'F_f \\le \\mu_s F_N' },
    { label: 'Dynamic friction (tyre sliding)', tex: 'F_f = \\mu_d F_N' },
    { label: 'Centripetal acceleration', tex: 'a = \\dfrac{v^{2}}{r}' },
    { label: "Newton's second law", tex: 'F = ma' },
    { label: 'Friction circle', tex: '\\sqrt{F_x^{2} + F_y^{2}} \\le \\mu_s F_N', beyond: true },
    { label: 'Yaw (rotation) about the centre of mass', tex: 'I\\alpha = aF_{y,\\text{front}} - bF_{y,\\text{rear}}', beyond: true },
  ],
  assumptions: [
    '“Bicycle model”: the two front wheels and the two rear wheels are each combined into one axle; no body roll and no weight transfer between axles.',
    'Tyres: sideways force ∝ slip angle up to the static limit μ_s F_N (friction circle); beyond it the tyre slides with μ_d F_N. Real tyres change more gradually (e.g. Pacejka’s “magic formula”).',
    'Rear-wheel drive with a constant power limit; brakes on both axles; the handbrake locks the rear wheels.',
    'Flat road, no air resistance. The car is drawn to scale; force arrows are proportional to the tyre forces.',
    'Numerics: RK4 with a 1 ms step; whether each tyre grips or slides is decided at the start of each step.',
  ],
  tryThis: [
    'Drive in a steady circle and slowly add speed: which end of the car lets go first?',
    'On ice, try to brake in a straight line: compare the stopping distance with v²/(2μ_d g).',
    'Start a drift with throttle in a turn (power oversteer), then catch it by steering the other way.',
    'Watch the friction circles: the arrow can never leave the outer circle.',
  ],
};

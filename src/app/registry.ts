import type { Component } from 'svelte';

export type TopicId = 'A' | 'B' | 'C' | 'D' | 'E';
/** 'full' = whole simulation is HL, 'part' = contains HL features, 'none' = SL. */
export type HlLevel = 'none' | 'part' | 'full';

export interface SimEntry {
  id: string;
  code: string; // syllabus subtopic, e.g. "A.1"
  title: string;
  blurb: string;
  hl: HlLevel;
  /** Added beyond the user's minimum list (still syllabus content unless stated). */
  extra?: boolean;
  keywords?: string[];
  load?: () => Promise<{ default: Component<{ entry: SimEntry }> }>;
}

export interface Subtopic {
  code: string;
  title: string;
  hlOnly: boolean;
}

export const topics: { id: TopicId; title: string }[] = [
  { id: 'A', title: 'Space, time and motion' },
  { id: 'B', title: 'The particulate nature of matter' },
  { id: 'C', title: 'Wave behaviour' },
  { id: 'D', title: 'Fields' },
  { id: 'E', title: 'Nuclear and quantum physics' },
];

export const subtopics: Subtopic[] = [
  { code: 'A.1', title: 'Kinematics', hlOnly: false },
  { code: 'A.2', title: 'Forces and momentum', hlOnly: false },
  { code: 'A.3', title: 'Work, energy and power', hlOnly: false },
  { code: 'A.4', title: 'Rigid body mechanics', hlOnly: true },
  { code: 'A.5', title: 'Galilean and special relativity', hlOnly: true },
  { code: 'B.1', title: 'Thermal energy transfers', hlOnly: false },
  { code: 'B.2', title: 'Greenhouse effect', hlOnly: false },
  { code: 'B.3', title: 'Gas laws', hlOnly: false },
  { code: 'B.4', title: 'Thermodynamics', hlOnly: true },
  { code: 'B.5', title: 'Current and circuits', hlOnly: false },
  { code: 'C.1', title: 'Simple harmonic motion', hlOnly: false },
  { code: 'C.2', title: 'Wave model', hlOnly: false },
  { code: 'C.3', title: 'Wave phenomena', hlOnly: false },
  { code: 'C.4', title: 'Standing waves and resonance', hlOnly: false },
  { code: 'C.5', title: 'Doppler effect', hlOnly: false },
  { code: 'D.1', title: 'Gravitational fields', hlOnly: false },
  { code: 'D.2', title: 'Electric and magnetic fields', hlOnly: false },
  { code: 'D.3', title: 'Motion in electromagnetic fields', hlOnly: false },
  { code: 'D.4', title: 'Induction', hlOnly: true },
  { code: 'E.1', title: 'Structure of the atom', hlOnly: false },
  { code: 'E.2', title: 'Quantum physics', hlOnly: true },
  { code: 'E.3', title: 'Radioactive decay', hlOnly: false },
  { code: 'E.4', title: 'Fission', hlOnly: false },
  { code: 'E.5', title: 'Fusion and stars', hlOnly: false },
];

const s = (
  id: string,
  title: string,
  blurb: string,
  hl: HlLevel = 'none',
  keywords: string[] = [],
  extra = false,
): SimEntry => ({ id, code: `${id[0].toUpperCase()}.${id[1]}`, title, blurb, hl, keywords, extra });

export const sims: SimEntry[] = [
  // A.1
  {
    ...s('a1-car-acceleration', 'Car acceleration', 'Engine power, gears, grip and air resistance — x–t, v–t and a–t graphs.', 'none', ['power', 'drag', 'gears', 'suvat', 'P = Fv']),
    load: () => import('../sims/a1-car-acceleration/Sim.svelte'),
  },
  {
    ...s('a1-projectile', 'Projectile motion', 'Launch in a vacuum and with air resistance side by side.', 'none', ['range', 'drag', 'trajectory', 'parabola']),
    load: () => import('../sims/a1-projectile/Sim.svelte'),
  },
  {
    ...s('a1-motion-graphs', 'Motion graphs lab', 'Drive the motion and read gradients and areas of x–t, v–t, a–t.', 'none', ['gradient', 'area', 'suvat', 'tangent', 'displacement'], true),
    load: () => import('../sims/a1-motion-graphs/Sim.svelte'),
  },
  // A.2
  {
    ...s('a2-inclined-plane', 'Inclined plane with friction', 'Static and dynamic friction, free-body diagram, slipping.', 'none', ['friction', 'μ', 'free-body', 'slope']),
    load: () => import('../sims/a2-inclined-plane/Sim.svelte'),
  },
  {
    ...s('a2-newton-lift', "Newton's laws: lift & connected bodies", 'Apparent weight in a lift and the Atwood machine.', 'none', ['atwood', 'apparent weight', 'tension', 'pulley', 'weightless'], true),
    load: () => import('../sims/a2-newton-lift/Sim.svelte'),
  },
  {
    ...s('a2-drag-buoyancy', 'Drag, buoyancy & terminal velocity', "Stokes' law and Archimedes' principle in fluids.", 'none', ['stokes', 'viscosity', 'terminal', 'archimedes', 'fluid'], true),
    load: () => import('../sims/a2-drag-buoyancy/Sim.svelte'),
  },
  {
    ...s('a2-collisions-1d', 'Collisions 1D', 'Elastic and inelastic collisions, momentum and impulse.', 'none', ['momentum', 'impulse', 'restitution', 'elastic', 'inelastic']),
    load: () => import('../sims/a2-collisions-1d/Sim.svelte'),
  },
  {
    ...s('a2-collisions-2d', 'Collisions 2D', 'Air-table pucks, momentum vectors, centre-of-mass frame.', 'none', ['momentum', 'vector', 'glancing', 'air table']),
    load: () => import('../sims/a2-collisions-2d/Sim.svelte'),
  },
  {
    ...s('a2-rocket', 'Rocket with variable mass', 'Thrust, drag in a thinning atmosphere, gravity falling with height.', 'none', ['thrust', 'tsiolkovsky', 'momentum', 'launch']),
    load: () => import('../sims/a2-rocket/Sim.svelte'),
  },
  {
    ...s('a2-banked-curve', 'Circular motion & banked curve', 'Centripetal force, banking angle and the limits of grip.', 'none', ['centripetal', 'banked', 'circular motion', 'curve']),
    load: () => import('../sims/a2-banked-curve/Sim.svelte'),
  },
  {
    ...s('a2-car-drift', 'Car drift', 'Drive it yourself: static vs dynamic tyre friction and the friction circle.', 'none', ['tyre', 'friction', 'drift', 'oversteer', 'game']),
    load: () => import('../sims/a2-car-drift/Sim.svelte'),
  },
  // A.3
  {
    ...s('a3-roller-coaster', 'Roller coaster energy', 'Energy bars, a vertical loop and the g-force felt by the riders.', 'none', ['energy', 'conservation', 'loop', 'g-force']),
    load: () => import('../sims/a3-roller-coaster/Sim.svelte'),
  },
  {
    ...s('a3-work-power', 'Work, power & efficiency', 'W = Fs cosθ, P = Fv and a live Sankey diagram.', 'none', ['sankey', 'efficiency', 'power', 'work', 'motor']),
    load: () => import('../sims/a3-work-power/Sim.svelte'),
  },
  {
    ...s('a3-spring-launcher', 'Spring launcher & elastic energy', "Hooke's law and elastic potential energy.", 'none', ['hooke', 'elastic', 'spring', 'energy'], true),
    load: () => import('../sims/a3-spring-launcher/Sim.svelte'),
  },
  // A.4 (HL)
  {
    ...s('a4-torque-equilibrium', 'Torque & equilibrium', 'Beams, see-saws and ladders in rotational equilibrium.', 'full', ['torque', 'moment', 'see-saw', 'ladder', 'principle of moments']),
    load: () => import('../sims/a4-torque-equilibrium/Sim.svelte'),
  },
  {
    ...s('a4-rolling-race', 'Rolling race', 'Sphere, cylinder and hoop race down a slope.', 'full', ['moment of inertia', 'rolling', 'rotational kinetic energy']),
    load: () => import('../sims/a4-rolling-race/Sim.svelte'),
  },
  {
    ...s('a4-angular-momentum', 'Conservation of angular momentum', 'Spinning skater, merry-go-round and rotational collisions.', 'full', ['angular momentum', 'skater', 'L = Iω']),
    load: () => import('../sims/a4-angular-momentum/Sim.svelte'),
  },
  {
    ...s('a4-rotational-dynamics', 'Rotational dynamics', 'τ = Iα with a flywheel and a falling mass.', 'full', ['torque', 'flywheel', 'angular acceleration', 'moment of inertia'], true),
    load: () => import('../sims/a4-rotational-dynamics/Sim.svelte'),
  },
  // A.5 (HL)
  {
    ...s('a5-galilean', 'Galilean transformation', 'A ball thrown in a moving train, seen from the train and from the platform.', 'full', ['frames', 'relative velocity', 'reference frame']),
    load: () => import('../sims/a5-galilean/Sim.svelte'),
  },
  {
    ...s('a5-spacetime-diagram', 'Spacetime diagram', 'Interactive Minkowski diagram with worldlines and light cones.', 'full', ['minkowski', 'simultaneity', 'interval', 'twin paradox', 'light cone']),
    load: () => import('../sims/a5-spacetime-diagram/Sim.svelte'),
  },
  {
    ...s('a5-time-dilation', 'Time dilation', 'Light clocks and muons reaching the ground.', 'full', ['muon', 'gamma', 'light clock', 'proper time']),
    load: () => import('../sims/a5-time-dilation/Sim.svelte'),
  },
  {
    ...s('a5-length-contraction', 'Length contraction', 'A train in a tunnel and the pole-barn paradox.', 'full', ['contraction', 'simultaneity', 'ladder paradox']),
    load: () => import('../sims/a5-length-contraction/Sim.svelte'),
  },
  {
    ...s('a5-lorentz', 'Lorentz transformation', 'Transform events and add velocities relativistically.', 'full', ['lorentz', 'interval', 'velocity addition', 'simultaneity']),
    load: () => import('../sims/a5-lorentz/Sim.svelte'),
  },
  // B.1
  {
    ...s('b1-particle-model', 'Particle model of matter', 'Solids, liquids and gases from interacting particles.', 'none', ['states', 'molecular dynamics', 'internal energy', 'kinetic theory']),
    load: () => import('../sims/b1-particle-model/Sim.svelte'),
  },
  {
    ...s('b1-heating-curve', 'Heating curve', 'Specific heat capacity and latent heat from ice to steam.', 'none', ['latent heat', 'specific heat', 'melting', 'boiling']),
    load: () => import('../sims/b1-heating-curve/Sim.svelte'),
  },
  {
    ...s('b1-black-body', 'Black-body radiation', "Planck curves, Wien's law and the Stefan–Boltzmann law.", 'none', ['wien', 'stefan', 'planck', 'star colour']),
    load: () => import('../sims/b1-black-body/Sim.svelte'),
  },
  {
    ...s('b1-conduction', 'Thermal conduction', 'Heat flow through a slab: ΔQ/Δt = kAΔT/Δx.', 'none', ['conductivity', 'insulation', 'heat flow'], true),
    load: () => import('../sims/b1-conduction/Sim.svelte'),
  },
  {
    ...s('b1-calorimetry', 'Calorimetry', 'Method of mixtures for specific heat capacity.', 'none', ['mixtures', 'specific heat', 'equilibrium'], true),
    load: () => import('../sims/b1-calorimetry/Sim.svelte'),
  },
  // B.2
  {
    ...s('b2-energy-balance', 'Planetary energy balance', 'Albedo, emissivity and equilibrium temperature.', 'none', ['albedo', 'emissivity', 'climate', 'greenhouse', 'solar constant']),
    load: () => import('../sims/b2-energy-balance/Sim.svelte'),
  },
  {
    ...s('b2-greenhouse-photons', 'Greenhouse photons', 'Visible and infrared photons meet greenhouse molecules.', 'none', ['infrared', 'CO2', 'greenhouse effect', 'methane'], true),
    load: () => import('../sims/b2-greenhouse-photons/Sim.svelte'),
  },
  // B.3
  {
    ...s('b3-gas-container', 'Gas in a container', 'Particles colliding, pressure from wall impacts, a piston.', 'none', ['pressure', 'kinetic theory', 'piston', 'ideal gas']),
    load: () => import('../sims/b3-gas-container/Sim.svelte'),
  },
  {
    ...s('b3-maxwell-boltzmann', 'Maxwell–Boltzmann distribution', 'Speed histogram of a simulated gas against theory.', 'none', ['speed distribution', 'rms speed', 'mean speed']),
    load: () => import('../sims/b3-maxwell-boltzmann/Sim.svelte'),
  },
  {
    ...s('b3-gas-laws', 'Gas laws lab', "Boyle's, Charles's and Gay-Lussac's laws with graphs.", 'none', ['boyle', 'charles', 'gay-lussac', 'absolute zero', 'van der waals']),
    load: () => import('../sims/b3-gas-laws/Sim.svelte'),
  },
  // B.4 (HL)
  {
    ...s('b4-pv-processes', 'p–V diagram & processes', 'Isobaric, isochoric, isothermal and adiabatic processes.', 'full', ['first law', 'adiabatic', 'isothermal', 'isobaric', 'work']),
    load: () => import('../sims/b4-pv-processes/Sim.svelte'),
  },
  {
    ...s('b4-heat-engines', 'Heat engines & Carnot cycle', 'Build cycles and compare efficiencies.', 'full', ['carnot', 'efficiency', 'otto', 'stirling', 'second law']),
    load: () => import('../sims/b4-heat-engines/Sim.svelte'),
  },
  {
    ...s('b4-entropy', 'Entropy', 'Microstates, S = k ln Ω and irreversible processes.', 'full', ['microstates', 'second law', 'free expansion', 'irreversible']),
    load: () => import('../sims/b4-entropy/Sim.svelte'),
  },
  // B.5
  s('b5-circuit-kit', 'Circuit construction kit', 'Build DC circuits with meters, lamps, LDRs and thermistors.', 'none', ['kirchhoff', 'voltmeter', 'ammeter']),
  s('b5-internal-resistance', 'Internal resistance & emf', 'Find ε and r from a V–I graph.', 'none', ['emf', 'internal resistance']),
  s('b5-resistivity', 'Resistivity', 'R = ρL/A for different wires.', 'none', ['resistivity'], true),
  s('b5-iv-characteristics', 'I–V characteristics', 'Resistor, filament lamp and diode.', 'none', ['ohmic', 'non-ohmic'], true),
  // C.1
  {
    ...s('c1-pendulum', 'Pendulum', 'Large-amplitude pendulum with damping, energy and exact period.', 'part', ['period', 'SHM', 'damping', 'energy']),
    load: () => import('../sims/c1-pendulum/Sim.svelte'),
  },
  s('c1-mass-spring', 'Mass–spring oscillator', 'Displacement, velocity and acceleration of SHM.', 'part', ['spring', 'SHM']),
  s('c1-phase', 'SHM, phase & reference circle', 'Phasors and phase difference between oscillators.', 'full', ['phase', 'phasor']),
  // C.2
  s('c2-wave-types', 'Transverse & longitudinal waves', 'Particles in a medium and wave graphs.', 'none', ['wavelength', 'frequency']),
  s('c2-wave-string', 'Wave on a string', 'Pulses and reflection at fixed and free ends.', 'none', ['pulse', 'reflection'], true),
  // C.3
  s('c3-refraction', 'Reflection & refraction', "Snell's law, critical angle and total internal reflection.", 'none', ['snell', 'TIR', 'optical fibre']),
  s('c3-ripple-tank', 'Ripple tank', 'Interference, diffraction and refraction of water waves.', 'none', ['interference', 'huygens']),
  s('c3-double-slit', "Young's double slit", 'Fringe spacing s = λD/d and white light.', 'none', ['interference', 'fringes']),
  s('c3-diffraction', 'Single slit & diffraction grating', 'First minimum θ = λ/b and nλ = d sinθ.', 'full', ['grating', 'single slit']),
  // C.4
  s('c4-string-standing', 'Standing waves on a string', 'Harmonics, nodes and antinodes.', 'none', ['harmonics', 'nodes']),
  s('c4-pipes', 'Standing waves in pipes', 'Open and closed pipes, displacement and pressure.', 'none', ['pipe', 'resonance']),
  s('c4-resonance', 'Resonance & damping', 'A driven damped oscillator and its resonance curve.', 'none', ['driven', 'damping']),
  // C.5
  s('c5-doppler', 'Doppler effect', 'Moving source and observer, wavefronts and sound.', 'part', ['frequency shift']),
  s('c5-shock-waves', 'Shock waves', 'Supersonic source and the Mach cone.', 'none', ['mach', 'sonic boom']),
  s('c5-redshift', 'Redshift of light', 'Spectral lines of a receding galaxy.', 'none', ['redshift', 'galaxy']),
  // D.1
  s('d1-orbits', "Orbits & Kepler's laws", 'Elliptical orbits, equal areas and T² ∝ r³.', 'part', ['kepler', 'satellite']),
  s('d1-escape-velocity', 'Escape velocity', "Newton's cannon from orbit to escape.", 'full', ['escape', 'orbital speed']),
  s('d1-grav-potential', 'Gravitational field & potential', 'Field lines, potential and equipotentials of masses.', 'full', ['potential', 'equipotential']),
  s('d1-n-body', 'N-body sandbox', 'Build your own planetary systems.', 'none', ['three-body', 'binary']),
  // D.2
  {
    ...s('d2-charges-and-fields', 'Charges and fields', 'Field lines, equipotentials, probes, dipoles and parallel plates.', 'part', ['coulomb', 'electric field', 'potential', 'dipole', 'capacitor', 'equipotential']),
    load: () => import('../sims/d2-charges-and-fields/Sim.svelte'),
  },
  s('d2-millikan', "Parallel plates & Millikan's oil drop", 'Uniform field E = V/d and charge quantisation.', 'none', ['millikan', 'parallel plates']),
  s('d2-magnetic-fields', 'Magnetic field patterns', 'Wires, loops, solenoids and bar magnets.', 'none', ['solenoid', 'magnet'], true),
  // D.3
  s('d3-charged-particle', 'Charged particle in E and B fields', 'Velocity selector, mass spectrometer and cyclotron.', 'none', ['lorentz force', 'cyclotron']),
  s('d3-wire-forces', 'Force on a conductor & between wires', 'Motor effect and parallel currents.', 'none', ['motor effect', 'BIL']),
  // D.4 (HL)
  s('d4-magnet-coil', 'Magnet & coil', "Faraday's and Lenz's laws with flux and emf graphs.", 'full', ['faraday', 'lenz', 'flux']),
  s('d4-generator', 'AC generator', 'A rotating coil and its sinusoidal emf.', 'full', ['alternating current', 'rms']),
  s('d4-rod-rails', 'Rod on rails', 'Motional emf and magnetic braking.', 'full', ['motional emf', 'BvL']),
  // E.1
  s('e1-rutherford', 'Rutherford scattering', 'Alpha particles deflected by a nucleus.', 'part', ['gold foil', 'closest approach']),
  s('e1-spectra', 'Atomic spectra', 'Emission and absorption spectra of gases.', 'none', ['emission', 'absorption', 'spectral lines']),
  s('e1-bohr', 'Bohr model', 'Energy levels and photon transitions in hydrogen.', 'full', ['energy levels', 'hydrogen']),
  // E.2 (HL)
  s('e2-photoelectric', 'Photoelectric effect', 'Work function, stopping potential and Planck’s constant.', 'full', ['work function', 'photon']),
  s('e2-de-broglie', 'Matter waves', 'Electron diffraction and λ = h/p.', 'full', ['de broglie', 'electron diffraction']),
  s('e2-compton', 'Compton scattering', 'Photon–electron collisions and Δλ.', 'full', ['compton']),
  // E.3
  s('e3-decay', 'Random decay & half-life', 'Watch nuclei decay at random and measure the half-life.', 'part', ['half-life', 'activity', 'decay constant']),
  s('e3-binding-energy', 'Binding energy per nucleon', 'The binding energy curve from measured masses.', 'none', ['mass defect', 'binding energy']),
  s('e3-nuclide-chart', 'Nuclide chart & decay modes', 'α, β⁻, β⁺ and γ on the N–Z chart.', 'none', ['isotopes', 'decay series'], true),
  s('e3-penetration', 'Radiation penetration', 'α, β and γ through paper, aluminium and lead.', 'none', ['absorption', 'ionising'], true),
  // E.4
  s('e4-chain-reaction', 'Chain reaction', 'Neutrons, critical mass and the multiplication factor.', 'none', ['critical mass', 'neutrons']),
  s('e4-reactor', 'Nuclear reactor', 'Moderator, control rods and power output.', 'none', ['moderator', 'control rods']),
  // E.5
  s('e5-hr-diagram', 'HR diagram', 'Real stars by luminosity and temperature.', 'none', ['main sequence', 'stellar evolution']),
  s('e5-stellar-equilibrium', 'Stellar equilibrium', 'Gravity against pressure inside a star.', 'none', ['equilibrium']),
  s('e5-parallax', 'Stellar parallax', 'Measure distances to nearby stars.', 'none', ['parsec', 'distance']),
  s('e5-luminosity', 'Luminosity & apparent brightness', 'b = L/(4πd²) and the Stefan–Boltzmann law.', 'none', ['brightness'], true),
  s('e5-fusion', 'Fusion: pp chain & Coulomb barrier', 'Why stars need extreme temperatures.', 'none', ['proton-proton', 'fusion'], true),
];

export function findSim(id: string): SimEntry | undefined {
  return sims.find((x) => x.id === id);
}

export function isReady(e: SimEntry): boolean {
  return typeof e.load === 'function';
}

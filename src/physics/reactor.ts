/**
 * E.4 Nuclear reactor: point kinetics with one group of delayed neutrons, plus a simple thermal model.
 *
 *   dn/dt = (ρ − β)/Λ · n + λ_d C + S
 *   dC/dt = β/Λ · n − λ_d C
 * n = relative power (1 = full power), C = delayed-neutron precursors, ρ = (k − 1)/k reactivity,
 * β = 0.0065 (delayed fraction for U-235), λ_d = 0.08 s⁻¹ (one-group decay constant),
 * Λ = 10⁻⁴ s (neutron generation time of a water-moderated reactor), S a tiny source.
 *
 * Integrator: the equations are linear with constant coefficients during one step (ρ held), so each
 * step uses the exact 2×2 matrix exponential. It is unconditionally stable for these stiff
 * equations (prompt time scale Λ/β ≈ 15 ms) and has no step-size error while ρ is constant.
 *
 * Reactivity: ρ = ρ_excess − (rod worth) − α_T (T − T_ref) − (no moderator penalty).
 * Rod worth for insertion x ∈ [0, 1]: W·(x − sin 2πx / 2π) (an S-curve: rods are most effective
 * in the middle of the core). Core temperature: C_th dT/dt = P − h·f·(T − T_in), f = pump flow.
 */
export const BETA = 0.0065;
export const LAMBDA_D = 0.08; // s⁻¹
export const GEN_TIME = 1e-4; // s
export const SOURCE = 1e-9; // relative
export const P_FULL = 3000; // MW thermal at n = 1
export const RHO_EXCESS = 0.05; // fresh core, rods out, cold
export const ROD_WORTH = 0.08;
export const NO_MODERATOR = -0.3; // without the water moderator the neutrons are not slowed down
export const ALPHA_T = 3e-5; // K⁻¹ negative temperature coefficient
export const T_IN = 290; // °C coolant inlet
export const T_REF = 290; // °C
export const H_FULL = (P_FULL * 1e6) / 30; // W K⁻¹ at full flow: 30 K rise at full power
export const C_TH = H_FULL * 10; // J K⁻¹ → thermal time constant 10 s at full flow

export const rodWorth = (x: number) => ROD_WORTH * (x - Math.sin(2 * Math.PI * x) / (2 * Math.PI));

/** advance (n, C) exactly by dt with constant reactivity ρ; returns [n, C] */
export function kineticsStep(n: number, C: number, rho: number, dt: number, beta = BETA, lam = LAMBDA_D, Lg = GEN_TIME, S = SOURCE): [number, number] {
  const a = (rho - beta) / Lg;
  const b = beta / Lg;
  // A = [[a, lam], [b, -lam]], forcing [S, 0]
  const s = (a - lam) / 2;
  const q = Math.sqrt(((a + lam) / 2) ** 2 + lam * b);
  const ep = Math.exp((s + q) * dt);
  const em = Math.exp((s - q) * dt);
  const ch = (ep + em) / 2; // e^{st} cosh(qt)
  const sh = (ep - em) / (2 * q); // e^{st} sinh(qt)/q
  // e^{At} = ch·I + sh·(A − sI)
  const m11 = ch + sh * (a - s);
  const m12 = sh * lam;
  const m21 = sh * b;
  const m22 = ch + sh * (-lam - s);
  let n2 = m11 * n + m12 * C;
  let C2 = m21 * n + m22 * C;
  if (S !== 0) {
    // particular part for the constant source: x_p = −A⁻¹[S, 0]; x(t) = e^{At}(x0 − x_p) + x_p
    const det = -a * lam - lam * b; // = −λρ/Λ
    if (Math.abs(det) > 1e-12) {
      const np = (lam * S) / det; // x_p = −A⁻¹[S, 0] = [λS, bS]/det
      const Cp = (b * S) / det;
      const xn = n - np;
      const xc = C - Cp;
      n2 = m11 * xn + m12 * xc + np;
      C2 = m21 * xn + m22 * xc + Cp;
    } else {
      // ρ = 0: the source adds about S·t (good enough for a tiny source)
      n2 += S * dt;
    }
  }
  return [n2, C2];
}

/** equilibrium precursor population for power n */
export const precursorsFor = (n: number) => (BETA * n) / (GEN_TIME * LAMBDA_D);

/** asymptotic (stable) reactor period for a constant reactivity ρ, one delayed group [s] */
export function stablePeriod(rho: number): number {
  const a = (rho - BETA) / GEN_TIME;
  const s = (a - LAMBDA_D) / 2;
  const q = Math.sqrt(((a + LAMBDA_D) / 2) ** 2 + (LAMBDA_D * BETA) / GEN_TIME);
  return 1 / (s + q);
}

export interface ReactorState {
  n: number;
  C: number;
  T: number; // core (coolant outlet) temperature °C
  E: number; // energy released [J]
}
export interface ReactorControls {
  rods: number; // 0 = out … 1 = fully in
  flow: number; // 0 … 1 pump flow
  moderator: boolean;
  feedback: boolean;
}

export function reactivity(s: ReactorState, c: ReactorControls): number {
  return RHO_EXCESS - rodWorth(c.rods) - (c.feedback ? ALPHA_T * (s.T - T_REF) : 0) + (c.moderator ? 0 : NO_MODERATOR);
}

/** rod position that makes the reactor exactly critical at temperature T (bisection) */
export function criticalRods(T: number, feedback = true): number {
  const target = RHO_EXCESS - (feedback ? ALPHA_T * (T - T_REF) : 0);
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (rodWorth(mid) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** advance the whole reactor by dt [s] */
export function reactorStep(s: ReactorState, c: ReactorControls, dt: number): void {
  const rho = reactivity(s, c);
  const [n, C] = kineticsStep(s.n, s.C, rho, dt);
  const P = 0.5 * (s.n + n) * P_FULL * 1e6;
  s.n = Math.max(0, n);
  s.C = Math.max(0, C);
  // core temperature: exact step of C dT/dt = P − h f (T − T_in)
  const h = H_FULL * Math.max(0.02, c.flow);
  const Teq = T_IN + P / h;
  s.T = Teq + (s.T - Teq) * Math.exp((-h * dt) / C_TH);
  s.E += P * dt;
}

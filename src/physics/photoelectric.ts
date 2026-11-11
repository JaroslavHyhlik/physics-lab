/**
 * E.2 (HL) Photoelectric effect.
 *
 * Photons of energy hf hit a metal cathode. An electron that absorbs one leaves with at most
 * E_k,max = hf − Φ (Einstein). Below the threshold frequency f₀ = Φ/h no electrons come out,
 * however bright the light.
 *
 * Photocurrent model (labelled in the sim): electrons leave the cathode straight towards the anode
 * with kinetic energies spread evenly between 0 and E_k,max, and a fixed fraction η of the photons
 * frees an electron. Then
 *   V ≥ 0  (anode positive):  every electron arrives → I = I_sat = η e (photons per second)
 *   V < 0  (retarding):       only those with E_k > e|V| arrive → I = I_sat (1 − e|V|/E_k,max)
 * so the current falls to zero at the stopping voltage V_s = E_k,max/e.
 *
 * Electron motion between the plates: uniform field, so constant acceleration a = eV/(m_e d);
 * stepped exactly (x += v dt + ½ a dt², v += a dt), which conserves ½mv² − eVx/d to rounding.
 */
import { h, c, e, m_e } from '../core/constants';

/**
 * Typical work functions [eV] of clean polycrystalline surfaces (CRC Handbook of Chemistry and
 * Physics, "Electron work function of the elements"). Real values depend on the surface and vary by a few tenths of an eV.
 */
export const METALS: Record<string, number> = {
  Caesium: 2.1,
  Potassium: 2.3,
  Sodium: 2.4,
  Calcium: 2.9,
  Zinc: 4.3,
  Copper: 4.7,
  Platinum: 5.6,
};

/** fraction of photons that free an electron (quantum efficiency); assumed constant */
export const QUANTUM_EFFICIENCY = 1e-3;

/** photon energy hf = hc/λ [J] */
export const photonEnergy = (lambda: number) => (h * c) / lambda;
/** E_k,max = hf − Φ [J], zero below the threshold */
export const kMax = (lambda: number, phiEV: number) => Math.max(0, photonEnergy(lambda) - phiEV * e);
/** stopping voltage V_s = E_k,max / e [V] */
export const stoppingVoltage = (lambda: number, phiEV: number) => kMax(lambda, phiEV) / e;
/** threshold frequency f₀ = Φ/h [Hz] */
export const thresholdFrequency = (phiEV: number) => (phiEV * e) / h;
/** threshold wavelength λ₀ = hc/Φ [m] */
export const thresholdWavelength = (phiEV: number) => (h * c) / (phiEV * e);
/** photons per second in light of power P [W] and wavelength λ */
export const photonRate = (P: number, lambda: number) => P / photonEnergy(lambda);

/** saturation photocurrent [A] */
export function saturationCurrent(P: number, lambda: number, phiEV: number, eta = QUANTUM_EFFICIENCY): number {
  return kMax(lambda, phiEV) > 0 ? eta * photonRate(P, lambda) * e : 0;
}

/** photocurrent [A] with the anode at potential V [V] relative to the cathode */
export function photocurrent(V: number, P: number, lambda: number, phiEV: number, eta = QUANTUM_EFFICIENCY): number {
  const Is = saturationCurrent(P, lambda, phiEV, eta);
  if (Is === 0 || V >= 0) return Is;
  const K = kMax(lambda, phiEV);
  return Is * Math.max(0, 1 - (e * -V) / K);
}

/** Electrons flying between the cathode (x = 0) and the anode (x = d). Pure, no drawing. */
export class PhotoTube {
  readonly max: number;
  readonly x: Float64Array;
  readonly v: Float64Array;
  /** spare per-electron value for the renderer (e.g. a vertical position); not used by the physics */
  readonly tag: Float64Array;
  readonly alive: Uint8Array;
  arrived = 0;
  returned = 0;
  constructor(
    public d = 0.04,
    max = 400,
  ) {
    this.max = max;
    this.x = new Float64Array(max);
    this.v = new Float64Array(max);
    this.tag = new Float64Array(max);
    this.alive = new Uint8Array(max);
  }
  /** emit an electron with kinetic energy K [J]; returns its slot or −1 when full */
  emit(K: number, tag = 0): number {
    for (let i = 0; i < this.max; i++)
      if (!this.alive[i]) {
        this.alive[i] = 1;
        this.x[i] = 0;
        this.v[i] = Math.sqrt((2 * K) / m_e);
        this.tag[i] = tag;
        return i;
      }
    return -1;
  }
  /** advance by dt [s] with anode potential V [V]; removes electrons that reach either plate */
  step(dt: number, V: number): void {
    const a = (e * V) / (m_e * this.d);
    for (let i = 0; i < this.max; i++) {
      if (!this.alive[i]) continue;
      this.x[i] += this.v[i] * dt + 0.5 * a * dt * dt;
      this.v[i] += a * dt;
      if (this.x[i] >= this.d) {
        this.alive[i] = 0;
        this.arrived++;
      } else if (this.x[i] <= 0 && this.v[i] <= 0) {
        this.alive[i] = 0;
        this.returned++;
      }
    }
  }
  count(): number {
    let n = 0;
    for (let i = 0; i < this.max; i++) n += this.alive[i];
    return n;
  }
  clear(): void {
    this.alive.fill(0);
    this.arrived = 0;
    this.returned = 0;
  }
}

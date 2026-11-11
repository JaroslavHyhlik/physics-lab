/**
 * E.5 Stellar parallax.
 *
 * The Earth (1 AU from the Sun) goes round its orbit once a year, so a nearby star is seen from
 * slightly different directions and appears to trace a small ellipse against the very distant
 * background stars. The parallax angle p is half the full shift: tan p = 1 AU / d. The parsec is
 * the distance at which p = 1″, so d(pc) = 1/p(″).
 *
 * Exact vector geometry, no small-angle approximation: star at distance d [AU] at ecliptic
 * longitude 0 and latitude β; Earth at (cos 2πt, sin 2πt, 0) AU. The apparent direction from the
 * Earth is projected onto the sky plane at the star (east and north offsets in arcseconds).
 */
export const ARCSEC = Math.PI / (180 * 3600);
/** 1 pc in AU, from the definition (1 AU subtends 1″) */
export const PC_IN_AU = 1 / Math.tan(ARCSEC);

export const distancePc = (pArcsec: number) => 1 / pArcsec;

/** Nearby stars: parallax [″] from Gaia DR3 / Hipparcos (rounded); ecliptic latitude [°] (approx.) */
export const STARS: Record<string, { p: number; beta: number }> = {
  'Proxima Centauri': { p: 0.768, beta: -44.8 },
  "Barnard's Star": { p: 0.547, beta: 27.0 },
  Sirius: { p: 0.379, beta: -39.6 },
  Vega: { p: 0.13, beta: 61.7 },
  Polaris: { p: 0.0075, beta: 66.1 },
};

/** apparent offset [east, north] of the star in arcseconds at time t (years), star at d pc, latitude β [rad] */
export function apparentOffset(t: number, dPc: number, beta: number): [number, number] {
  const d = dPc * PC_IN_AU;
  const sx = d * Math.cos(beta);
  const sy = 0;
  const sz = d * Math.sin(beta);
  const ex = Math.cos(2 * Math.PI * t);
  const ey = Math.sin(2 * Math.PI * t);
  const vx = sx - ex;
  const vy = sy - ey;
  const vz = sz;
  const L = Math.hypot(vx, vy, vz);
  // sky basis at the star's true direction: east = increasing longitude, north = increasing latitude
  const east = [0, 1, 0];
  const north = [-Math.sin(beta), 0, Math.cos(beta)];
  const ux = vx / L;
  const uy = vy / L;
  const uz = vz / L;
  const e = ux * east[0] + uy * east[1] + uz * east[2];
  const n = ux * north[0] + uy * north[1] + uz * north[2];
  return [Math.asin(e) / ARCSEC, Math.asin(n) / ARCSEC];
}

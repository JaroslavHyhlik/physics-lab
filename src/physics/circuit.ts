/**
 * DC circuit solver for the circuit construction kit (modified nodal analysis).
 * Components sit on the edges of a grid; points joined by ideal wires or closed switches are
 * merged into one electrical node (union–find), so wires are exact. Unknowns: node potentials
 * (one node is earth) plus the currents through voltage sources (cells, ideal ammeters).
 *  - cell: ideal emf ε (+ terminal at end b) in series with internal resistance r
 *  - ideal ammeter: 0 V source (its current is the reading); real ammeter: 0.1 Ω
 *  - ideal voltmeter: open circuit; real voltmeter: 10 MΩ
 *  - lamp (12 V, 24 W, non-ohmic): resistance from the filament temperature, found by iteration
 *  - LDR: R = 10 kΩ × (E/10 lx)^−0.7; NTC thermistor: R = 10 kΩ × e^{B(1/T − 1/298.15 K)}, B = 3950 K
 * Parts of the circuit that are not connected to earth are tied to it at one node (no current
 * can flow through a single tie, so nothing changes) to keep the system solvable.
 * Linear system: Gaussian elimination with partial pivoting. Wire currents (for the animation)
 * are found afterwards inside each wire group, as if all wires had the same tiny resistance.
 */
import { lampR, lampT, LAMP_RCOLD } from './components';

export type ElKind = 'wire' | 'resistor' | 'cell' | 'lamp' | 'switch' | 'ammeter' | 'voltmeter' | 'ldr' | 'thermistor';

export interface El {
  id: number;
  kind: ElKind;
  /** grid point indices at the two ends */
  a: number;
  b: number;
  R?: number;
  emf?: number;
  r?: number;
  closed?: boolean;
}

export interface Env {
  lux: number;
  tempC: number;
  realMeters: boolean;
}

export interface ElResult {
  /** current through the element from a to b [A] */
  I: number;
  /** potential difference V(a) − V(b) [V] */
  V: number;
  /** power dissipated (resistive) or delivered by a cell (negative) [W] */
  P: number;
  R?: number;
}

export interface Solution {
  ok: boolean;
  message?: string;
  /** potential of each grid point (NaN if not connected to anything) */
  phi: Float64Array;
  els: Map<number, ElResult>;
}

export const ldrR = (lux: number) => 1e4 * Math.pow(Math.max(lux, 0.01) / 10, -0.7);
export const thermistorR = (tempC: number) => 1e4 * Math.exp(3950 * (1 / (tempC + 273.15) - 1 / 298.15));

function solveLinear(A: Float64Array[], b: Float64Array): Float64Array | null {
  const n = b.length;
  let scale = 0;
  for (const row of A) for (const v of row) scale = Math.max(scale, Math.abs(v));
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    if (Math.abs(A[piv][c]) < 1e-14 * Math.max(scale, 1e-300)) return null;
    [A[c], A[piv]] = [A[piv], A[c]];
    [b[c], b[piv]] = [b[piv], b[c]];
    for (let r = c + 1; r < n; r++) {
      const f = A[r][c] / A[c][c];
      if (f === 0) continue;
      for (let k = c; k < n; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  const x = new Float64Array(n);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r];
    for (let k = r + 1; k < n; k++) s -= A[r][k] * x[k];
    x[r] = s / A[r][r];
  }
  return x;
}

/** resistance of a resistive element (lamp uses the given filament resistance) */
function resistanceOf(e: El, env: Env, lampRes: Map<number, number>): number | null {
  switch (e.kind) {
    case 'resistor':
      return Math.max(e.R ?? 10, 1e-6);
    case 'lamp':
      return lampRes.get(e.id) ?? LAMP_RCOLD;
    case 'ldr':
      return ldrR(env.lux);
    case 'thermistor':
      return thermistorR(env.tempC);
    case 'ammeter':
      return env.realMeters ? 0.1 : null;
    case 'voltmeter':
      return env.realMeters ? 1e7 : null;
    default:
      return null;
  }
}

export function solveCircuit(nPoints: number, elements: El[], env: Env): Solution {
  // 1) merge points joined by wires / closed switches
  const parent = Int32Array.from({ length: nPoints }, (_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const conductor = (e: El) => e.kind === 'wire' || (e.kind === 'switch' && e.closed);
  for (const e of elements) if (conductor(e)) parent[find(e.a)] = find(e.b);
  const used = new Uint8Array(nPoints);
  for (const e of elements) {
    used[e.a] = 1;
    used[e.b] = 1;
  }
  const nodeOf = new Int32Array(nPoints).fill(-1);
  const roots = new Map<number, number>();
  for (let i = 0; i < nPoints; i++) {
    if (!used[i]) continue;
    const r = find(i);
    if (!roots.has(r)) roots.set(r, roots.size);
    nodeOf[i] = roots.get(r)!;
  }
  const nNodes = roots.size;
  const phi = new Float64Array(nPoints).fill(NaN);
  const els = new Map<number, ElResult>();
  if (nNodes === 0) return { ok: true, phi, els };
  for (const e of elements)
    if (e.kind === 'cell' && nodeOf[e.a] === nodeOf[e.b] && (e.emf ?? 0) !== 0)
      return { ok: false, message: 'A cell is short-circuited by a wire. Remove the wire or add a resistor.', phi, els };
  // connected parts (through anything that can carry current); tie each part without earth to earth
  const comp = Int32Array.from({ length: nNodes }, (_, i) => i);
  const cf = (i: number): number => (comp[i] === i ? i : (comp[i] = cf(comp[i])));
  for (const e of elements) {
    if (conductor(e) || nodeOf[e.a] === nodeOf[e.b]) continue;
    if (e.kind === 'voltmeter' && !env.realMeters) continue;
    comp[cf(nodeOf[e.a])] = cf(nodeOf[e.b]);
  }
  const ties: number[] = [];
  const seen = new Set<number>([cf(0)]);
  for (let n = 1; n < nNodes; n++) {
    const c = cf(n);
    if (!seen.has(c)) {
      seen.add(c);
      ties.push(n);
    }
  }

  // lamps: start from the cold resistance and iterate
  const lampRes = new Map<number, number>();
  for (const e of elements) if (e.kind === 'lamp') lampRes.set(e.id, LAMP_RCOLD);
  const lamps = elements.filter((e) => e.kind === 'lamp');

  let x: Float64Array | null = null;
  let srcIndex = new Map<number, number>();
  let internalNode = new Map<number, number>();
  for (let iter = 0; iter < 200; iter++) {
    // unknowns: nodes 1..nNodes−1 (node 0 is earth), internal cell nodes, source currents
    internalNode = new Map();
    srcIndex = new Map();
    let nv = nNodes;
    for (const e of elements) if (e.kind === 'cell' && (e.r ?? 0) > 0 && nodeOf[e.a] !== nodeOf[e.b]) internalNode.set(e.id, nv++);
    const sources: El[] = [];
    for (const e of elements) {
      if (nodeOf[e.a] === nodeOf[e.b]) continue; // shorted by wires: carries no defined current
      if (e.kind === 'cell' || (e.kind === 'ammeter' && !env.realMeters)) {
        srcIndex.set(e.id, sources.length);
        sources.push(e);
      }
    }
    const nU = nv - 1 + sources.length;
    const A = Array.from({ length: nU }, () => new Float64Array(nU));
    const b = new Float64Array(nU);
    const vi = (node: number) => node - 1; // index of a node potential (node 0 → −1, earth)
    const stamp = (n1: number, n2: number, g: number) => {
      const i = vi(n1);
      const j = vi(n2);
      if (i >= 0) A[i][i] += g;
      if (j >= 0) A[j][j] += g;
      if (i >= 0 && j >= 0) {
        A[i][j] -= g;
        A[j][i] -= g;
      }
    };
    for (const n of ties) A[n - 1][n - 1] += 1;
    for (const e of elements) {
      const na = nodeOf[e.a];
      const nb = nodeOf[e.b];
      if (na === nb) continue;
      const R = resistanceOf(e, env, lampRes);
      if (R !== null) stamp(na, nb, 1 / R);
    }
    sources.forEach((e, k) => {
      const row = nv - 1 + k;
      // source between n− and n+: V(n+) − V(n−) = emf, its current flows from n− to n+ inside
      let nMinus = nodeOf[e.a];
      const nPlus = nodeOf[e.b];
      const emf = e.kind === 'cell' ? (e.emf ?? 1.5) : 0;
      if (e.kind === 'cell' && internalNode.has(e.id)) {
        // a → internal r → (internal node) → ideal emf → b
        const ni = internalNode.get(e.id)!;
        stamp(nMinus, ni, 1 / (e.r ?? 0));
        nMinus = ni;
      }
      const ip = vi(nPlus);
      const im = vi(nMinus);
      if (ip >= 0) {
        A[ip][row] -= 1;
        A[row][ip] += 1;
      }
      if (im >= 0) {
        A[im][row] += 1;
        A[row][im] -= 1;
      }
      b[row] = emf;
    });
    x = solveLinear(A, b);
    if (!x) return { ok: false, message: 'This circuit has a loop of ideal cells or ammeters with no resistance (a short circuit). Add some resistance.', phi, els };
    if (!lamps.length) break;
    // update lamp resistances from their voltages (damped in log space)
    let change = 0;
    for (const e of lamps) {
      const Va = nodeOf[e.a] === 0 ? 0 : x[nodeOf[e.a] - 1];
      const Vb = nodeOf[e.b] === 0 ? 0 : x[nodeOf[e.b] - 1];
      const Rnew = lampR(lampT(Va - Vb));
      const Rold = lampRes.get(e.id)!;
      const R = Math.exp(0.5 * Math.log(Rold) + 0.5 * Math.log(Rnew));
      change = Math.max(change, Math.abs(Rnew / Rold - 1));
      lampRes.set(e.id, R);
    }
    if (change < 1e-12) break;
  }
  const sol = x!;
  const V = (node: number) => (node === 0 ? 0 : sol[node - 1]);
  for (let i = 0; i < nPoints; i++) if (nodeOf[i] >= 0) phi[i] = V(nodeOf[i]);
  const nv = nNodes + internalNode.size;
  for (const e of elements) {
    const dV = phi[e.a] - phi[e.b];
    if (conductor(e)) {
      els.set(e.id, { I: 0, V: 0, P: 0 });
      continue;
    }
    if (nodeOf[e.a] === nodeOf[e.b]) {
      els.set(e.id, { I: 0, V: 0, P: 0 });
      continue;
    }
    if (srcIndex.has(e.id)) {
      // MNA source current flows from n+ through the external circuit; inside from a to b
      const Isrc = sol[nv - 1 + srcIndex.get(e.id)!];
      els.set(e.id, { I: Isrc, V: dV, P: dV * Isrc });
      continue;
    }
    const R = resistanceOf(e, env, lampRes);
    if (R === null) {
      els.set(e.id, { I: 0, V: dV, P: 0 });
      continue;
    }
    const I = dV / R;
    els.set(e.id, { I, V: dV, P: dV * I, R });
  }
  // wire currents inside each wire group: injections from all other elements, equal wire resistances
  const wires = elements.filter(conductor);
  if (wires.length) {
    const inj = new Float64Array(nPoints);
    for (const e of elements) {
      if (conductor(e)) continue;
      const r = els.get(e.id)!;
      inj[e.a] -= r.I; // current leaves point a into the element
      inj[e.b] += r.I;
    }
    const groups = new Map<number, number[]>();
    for (const w of wires)
      for (const p of [w.a, w.b]) {
        const g = find(p);
        if (!groups.has(g)) groups.set(g, []);
        if (!groups.get(g)!.includes(p)) groups.get(g)!.push(p);
      }
    for (const pts of groups.values()) {
      const idx = new Map(pts.map((p, i) => [p, i]));
      const n = pts.length - 1; // first point is the reference
      const A = Array.from({ length: n }, () => new Float64Array(n));
      const b = new Float64Array(n);
      const gw = wires.filter((w) => idx.has(w.a));
      for (const w of gw) {
        const i = idx.get(w.a)! - 1;
        const j = idx.get(w.b)! - 1;
        if (i >= 0) A[i][i] += 1;
        if (j >= 0) A[j][j] += 1;
        if (i >= 0 && j >= 0) {
          A[i][j] -= 1;
          A[j][i] -= 1;
        }
      }
      pts.forEach((p, i) => {
        if (i > 0) b[i - 1] = inj[p];
      });
      const u = n > 0 ? solveLinear(A, b) : new Float64Array(0);
      for (const w of gw) {
        const ua = idx.get(w.a)! === 0 || !u ? 0 : u[idx.get(w.a)! - 1];
        const ub = idx.get(w.b)! === 0 || !u ? 0 : u[idx.get(w.b)! - 1];
        els.set(w.id, { I: ua - ub, V: 0, P: 0 });
      }
    }
  }
  return { ok: true, phi, els };
}

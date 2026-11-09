import { describe, expect, it } from 'vitest';
import { Car, topSpeedConstantPower, type CarParams } from '../../src/physics/car';
import { vehicles } from '../../src/sims/a1-car-acceleration/vehicles';
import { g } from '../../src/core/constants';

const dt = 1e-3;
const vehicle = (id: string) => vehicles.find((v) => v.id === id)!.params;
const ideal = (over: Partial<CarParams> = {}): CarParams => ({ ...vehicle('ideal'), ...over });

function run(c: Car, seconds: number) {
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) c.step(dt);
}

describe('A.1 car acceleration', () => {
  it('constant power, no losses: v = √(u² + 2Pt/m) and x matches the exact integral', () => {
    const P = 50e3;
    const m = 1000;
    const u = 2;
    const c = new Car(ideal({ Pmax: P, m, u }));
    run(c, 10);
    const t = 10;
    const v = Math.sqrt(u * u + (2 * P * t) / m);
    const x = (m / (3 * P)) * (Math.pow(u * u + (2 * P * t) / m, 1.5) - u * u * u);
    expect(Math.abs(c.v - v) / v).toBeLessThan(1e-9);
    expect(Math.abs(c.x - x) / x).toBeLessThan(1e-9);
  });

  it('top speed: wheel power = (½ρC_dAv² + C_rr·mg)·v', () => {
    const p = ideal({ drag: true, roll: true, Pmax: 80e3, m: 1200, u: 5 });
    const c = new Car(p);
    run(c, 600);
    const vTop = topSpeedConstantPower(p.Pmax, 0.5 * p.rho * p.Cd * p.A, p.Crr * p.m * g);
    expect(Math.abs(c.v - vTop) / vTop).toBeLessThan(1e-6);
  });

  it('grip-limited launch: a = μ_s·g exactly when all weight is on the driven wheels', () => {
    const c = new Car(ideal({ Pmax: 5e6, u: 0, grip: true, mu: 0.9, drivenFraction: 1 }));
    run(c, 1);
    expect(c.wheelspin).toBe(true);
    expect(c.v).toBeCloseTo(0.9 * g * 1, 9);
  });

  it('energy balance: E_k = W_drive − W_drag − W_roll (sports car, all losses)', () => {
    const c = new Car(vehicle('sports'));
    run(c, 30);
    const balance = c.workDrive - c.workDrag - c.workRoll;
    expect(Math.abs(c.kineticEnergy - balance) / c.kineticEnergy).toBeLessThan(1e-6);
  });

  it('gearbox: shifts up in order and the engine never exceeds the redline', () => {
    const p = vehicle('city');
    const c = new Car(p);
    let maxRpm = 0;
    let lastGear = 0;
    for (let i = 0; i < 60000; i++) {
      c.step(dt);
      maxRpm = Math.max(maxRpm, c.rpm);
      expect(c.gear - lastGear).toBeGreaterThanOrEqual(0);
      expect(c.gear - lastGear).toBeLessThanOrEqual(1);
      lastGear = c.gear;
    }
    expect(maxRpm).toBeLessThanOrEqual(p.rpmRedline + 1e-6);
    expect(c.gear).toBeGreaterThanOrEqual(3);
  });

  it('electric car: torque-limited start gives a = (T·G·η/r − C_rr·mg)/m', () => {
    const p = vehicle('ev');
    const c = new Car({ ...p, drag: false });
    const expected = ((p.Tmax * p.gears[0] * p.finalDrive * p.eta) / p.rWheel - p.Crr * p.m * g) / p.m;
    c.step(dt);
    expect(c.accel(c.v)).toBeCloseTo(expected, 9);
    expect(c.wheelspin).toBe(false);
  });

  it('realistic 0–100 km/h times for the presets', () => {
    const times: Record<string, number> = {};
    for (const id of ['city', 'sports', 'ev']) {
      const c = new Car(vehicle(id));
      run(c, 40);
      times[id] = c.t100;
    }
    expect(times.city).toBeGreaterThan(9);
    expect(times.city).toBeLessThan(16);
    expect(times.sports).toBeGreaterThan(3.5);
    expect(times.sports).toBeLessThan(6);
    expect(times.ev).toBeGreaterThan(3.5);
    expect(times.ev).toBeLessThan(6);
  });

  it('results do not depend on how the time is split into frames', () => {
    const a = new Car(vehicle('sports'));
    const b = new Car(vehicle('sports'));
    run(a, 5);
    for (let i = 0; i < 5000; i++) b.step(dt);
    expect(a.x).toBe(b.x);
  });
});

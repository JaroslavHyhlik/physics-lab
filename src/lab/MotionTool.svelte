<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import LabShell from './LabShell.svelte';
  import Slider from '../ui/Slider.svelte';
  import Toggle from '../ui/Toggle.svelte';
  import Segmented from '../ui/Segmented.svelte';
  import { Recorder, type ChannelDef } from '../core/recorder';
  import type { GraphDef } from '../sim/types';
  import type { ReadoutRow } from '../sim/Readouts.svelte';
  import type { LabMeta } from './tools';
  import { listenMotion, requestMotionPermission, holdScreenOn, support, type MotionSample } from './sensors';
  import { stats, period, sampleRate, gFromPendulum, kFromSpring, mag3 } from './analysis';
  import { linearFit } from '../physics/dc';
  import { drawXYPlot } from '../sim/xyPlot';
  import { readPalette } from '../sim/palette';
  import { fmt } from '../core/format';
  import { g as G_BOOKLET } from '../core/constants';

  let { meta }: { meta: LabMeta } = $props();
  // the page re-creates this component for another experiment ({#key}), so reading meta once is enough
  const id = untrack(() => meta.id);

  // ---- settings ----
  let withG = $state(true);
  let L = $state(0.5); // pendulum length [m]
  let mass = $state(0.2); // mass on the spring / in the lift [kg]
  let springMode = $state<'spring' | 'lift'>('spring');

  // ---- channels for each experiment ----
  const T: ChannelDef = { key: 't', label: 't', unit: 's' };
  const CH: Record<string, ChannelDef[]> = {
    accelerometer: [T, { key: 'x', label: 'aₓ', unit: 'm s⁻²', color: '--series-1' }, { key: 'y', label: 'a_y', unit: 'm s⁻²', color: '--series-2' }, { key: 'z', label: 'a_z', unit: 'm s⁻²', color: '--series-3' }, { key: 'a', label: '|a|', unit: 'm s⁻²', color: '--series-4' }],
    gyroscope: [T, { key: 'x', label: 'ωₓ', unit: 'rad s⁻¹', color: '--series-1' }, { key: 'y', label: 'ω_y', unit: 'rad s⁻¹', color: '--series-2' }, { key: 'z', label: 'ω_z', unit: 'rad s⁻¹', color: '--series-3' }, { key: 'th', label: 'angle about z', unit: 'rad', color: '--series-4' }],
    g: [T, { key: 'a', label: '|a| with g', unit: 'm s⁻²', color: '--series-1' }],
    pendulum: [T, { key: 'x', label: 'ωₓ', unit: 'rad s⁻¹', color: '--series-1' }, { key: 'y', label: 'ω_y', unit: 'rad s⁻¹', color: '--series-2' }, { key: 'z', label: 'ω_z', unit: 'rad s⁻¹', color: '--series-3' }],
    centripetal: [T, { key: 'w', label: 'ω', unit: 'rad s⁻¹', color: '--series-1' }, { key: 'a', label: 'a in the plane', unit: 'm s⁻²', color: '--series-4' }],
    spring: [T, { key: 'a', label: '|a| with g', unit: 'm s⁻²', color: '--series-1' }, { key: 'W', label: 'apparent weight', unit: 'N', color: '--series-4' }],
  };
  const GR: Record<string, GraphDef[]> = {
    accelerometer: [
      { id: 'xyz', title: 'Acceleration components', series: ['x', 'y', 'z'] },
      { id: 'a', title: 'Magnitude |a|', series: ['a'] },
    ],
    gyroscope: [
      { id: 'w', title: 'Angular velocity', series: ['x', 'y', 'z'] },
      { id: 'th', title: 'Angle turned about z', series: ['th'] },
    ],
    g: [{ id: 'a', title: '|a| (at rest = g)', series: ['a'] }],
    pendulum: [{ id: 'w', title: 'Angular velocity', series: ['x', 'y', 'z'] }],
    centripetal: [
      { id: 'w', title: 'Angular velocity', series: ['w'] },
      { id: 'a', title: 'Acceleration in the plane', series: ['a'] },
    ],
    spring: [
      { id: 'a', title: '|a| with g', series: ['a'] },
      { id: 'W', title: 'Apparent weight', series: ['W'] },
    ],
  };
  const channels = CH[id];
  const rec = new Recorder(channels, 60000);
  const buf = new Float64Array(channels.length);

  let running = $state(false);
  let status = $state('');
  let hint = $state('');
  let tick = $state(0);
  let t0 = NaN;
  let last = NaN;
  let angle = 0;
  let lastW = NaN;
  let gotData = false;
  let onlyWithG = false;
  let stopListen: (() => void) | null = null;
  let release: (() => void) | null = null;
  let timer = 0;
  let noData = 0;

  function onSample(s: MotionSample) {
    if (!running) return;
    // browsers without a sensor may send events with empty (null) values: skip them
    if (!Number.isFinite(s.gx) && !Number.isFinite(s.wz)) return;
    if (Number.isNaN(t0)) t0 = s.t;
    const t = s.t - t0;
    if (t <= last) return; // duplicate or out-of-order event
    buf[0] = t;
    if (id === 'accelerometer') {
      let [x, y, z] = withG ? [s.gx, s.gy, s.gz] : [s.ax, s.ay, s.az];
      if (!withG && !Number.isFinite(x)) {
        onlyWithG = true;
        [x, y, z] = [s.gx, s.gy, s.gz];
      }
      buf[1] = x;
      buf[2] = y;
      buf[3] = z;
      buf[4] = mag3(x, y, z);
    } else if (id === 'gyroscope') {
      // integrate only valid readings, so one missing value cannot spoil the angle for good
      if (!Number.isFinite(s.wz)) return;
      if (Number.isFinite(lastW) && Number.isFinite(last)) angle += 0.5 * (s.wz + lastW) * (t - last);
      lastW = s.wz;
      buf[1] = s.wx;
      buf[2] = s.wy;
      buf[3] = s.wz;
      buf[4] = angle;
    } else if (id === 'g') {
      buf[1] = mag3(s.gx, s.gy, s.gz);
    } else if (id === 'pendulum') {
      buf[1] = s.wx;
      buf[2] = s.wy;
      buf[3] = s.wz;
    } else if (id === 'centripetal') {
      buf[1] = mag3(s.wx, s.wy, s.wz);
      buf[2] = Math.hypot(s.gx, s.gy); // phone flat: gravity along z, centripetal acceleration in the x–y plane
    } else if (id === 'spring') {
      const a = mag3(s.gx, s.gy, s.gz);
      buf[1] = a;
      buf[2] = mass * a;
    }
    for (let i = 1; i < buf.length; i++) if (!Number.isFinite(buf[i])) return; // sensor not providing this value
    gotData = true;
    last = t;
    rec.push(buf);
  }

  async function start() {
    status = '';
    if (!support().motion) {
      status = 'This browser gives no motion sensor data (for example on a laptop). Open the lab on your phone.';
      return;
    }
    const p = await requestMotionPermission();
    if (destroyed) return;
    if (p === 'denied') {
      status = 'No access to the motion sensors: access was refused, or this device has none (for example a laptop). On iPhone: close the tab, open the page again and tap “Allow” (or Settings → Safari → Motion & Orientation Access).';
      return;
    }
    running = true;
    gotData = false;
    hint = 'Waiting for data from the sensor…';
    stopListen = listenMotion(onSample);
    release = holdScreenOn();
    clearTimeout(noData);
    noData = window.setTimeout(() => {
      if (running && !gotData) status = 'No data arrives from the motion sensor. This device probably has none (for example a laptop), or access was blocked in the browser settings.';
    }, 2500);
    clearInterval(timer);
    timer = window.setInterval(() => {
      tick++;
      if (gotData) hint = '';
    }, 250);
  }
  function stop() {
    running = false;
    stopListen?.();
    stopListen = null;
    release?.();
    release = null;
    clearInterval(timer);
    clearTimeout(noData);
    hint = '';
    tick++;
  }
  function clear() {
    rec.clear();
    t0 = NaN;
    last = NaN;
    angle = 0;
    lastW = NaN;
    tick++;
  }
  let destroyed = false;
  onDestroy(() => {
    destroyed = true;
    stop();
  });

  // ---- analysis for the readouts (recomputed a few times per second) ----
  const view = (k: string) => rec.view(rec.index(k));
  const rows = $derived.by((): ReadoutRow[] => {
    void tick;
    const n = rec.length;
    const ts = rec.view(0);
    const fs = n > 5 ? sampleRate(ts) : NaN;
    const r: ReadoutRow[] = [];
    const rate = { label: 'measured sample rate', value: Number.isFinite(fs) ? fmt(fs, 3) : '—', unit: Number.isFinite(fs) ? 'Hz' : undefined };
    if (!n) return [rate, { label: 'readings', value: '0' }];
    if (id === 'accelerometer') {
      for (const [k, l] of [
        ['x', 'aₓ'],
        ['y', 'a_y'],
        ['z', 'a_z'],
        ['a', '|a|'],
      ])
        r.push({ label: l, value: fmt(rec.last(rec.index(k)), 3), unit: 'm s⁻²', strong: k === 'a' });
      if (onlyWithG && !withG) r.push({ label: 'note', value: 'this device gives only “with g”' });
    } else if (id === 'gyroscope') {
      for (const [k, l] of [
        ['x', 'ωₓ'],
        ['y', 'ω_y'],
        ['z', 'ω_z'],
      ])
        r.push({ label: l, value: fmt(rec.last(rec.index(k)), 3), unit: 'rad s⁻¹' });
      const th = rec.last(rec.index('th'));
      r.push({ label: 'angle turned about z', value: `${fmt(th, 3)} rad = ${fmt((th * 180) / Math.PI, 3)}`, unit: '°', strong: true });
    } else if (id === 'g') {
      const s = stats(view('a'));
      r.push(
        { label: 'readings n', value: String(s.n) },
        { label: 'mean |a|', value: fmt(s.mean, 4), unit: 'm s⁻²' },
        { label: 'standard deviation', value: fmt(s.sd, 2), unit: 'm s⁻²' },
        { label: 'g = mean ± sd/√n', value: n > 2 ? `${s.mean.toFixed(3)} ± ${fmt(s.sem, 1)}` : '—', unit: 'm s⁻²', strong: true },
        { label: 'difference from 9.8 m s⁻²', value: `${fmt((100 * (s.mean - G_BOOKLET)) / G_BOOKLET, 2)}`, unit: '%' },
      );
      if (s.sd > 0.3) r.push({ label: 'note', value: 'the phone is moving: keep it still' });
    } else if (id === 'pendulum') {
      // the swing shows up most strongly on one gyroscope axis: use that one
      const axes = ['x', 'y', 'z'].map((k) => ({ k, sd: stats(view(k)).sd }));
      const best = axes.reduce((a, b) => (b.sd > a.sd ? b : a));
      const p = period(ts, view(best.k));
      const gT = gFromPendulum(L, p.T);
      r.push(
        rate,
        { label: 'axis used', value: best.k },
        { label: 'periods counted', value: String(p.n) },
        { label: 'period T', value: Number.isFinite(p.T) ? `${p.T.toFixed(3)} ± ${fmt(p.sd / Math.sqrt(Math.max(1, p.n)), 1)}` : '—', unit: 's', strong: true },
        { label: 'g = 4π²L/T²', value: Number.isFinite(gT) ? fmt(gT, 3) : '—', unit: 'm s⁻²', color: '--series-4' },
        { label: 'expected T = 2π√(L/g)', value: fmt(2 * Math.PI * Math.sqrt(L / G_BOOKLET), 3), unit: 's' },
      );
      return r;
    } else if (id === 'centripetal') {
      const f = fitAOmega2();
      r.push(
        { label: 'ω now', value: fmt(rec.last(1), 3), unit: 'rad s⁻¹' },
        { label: 'a now', value: fmt(rec.last(2), 3), unit: 'm s⁻²' },
        { label: 'points used (ω > 1 rad s⁻¹)', value: String(f.n) },
        { label: 'radius r = gradient of a–ω²', value: f.n >= 5 ? fmt(f.slope * 100, 3) : '—', unit: 'cm', strong: true },
      );
    } else if (id === 'spring') {
      const a = view('a');
      if (springMode === 'spring') {
        const p = period(ts, a);
        r.push(
          { label: 'periods counted', value: String(p.n) },
          { label: 'period T', value: Number.isFinite(p.T) ? p.T.toFixed(3) : '—', unit: 's', strong: true },
          { label: 'k = 4π²m/T²', value: Number.isFinite(p.T) ? fmt(kFromSpring(mass, p.T), 3) : '—', unit: 'N m⁻¹', color: '--series-4' },
        );
      } else {
        const s = stats(a);
        let mn = Infinity;
        let mx = -Infinity;
        for (const v of a) {
          mn = Math.min(mn, v);
          mx = Math.max(mx, v);
        }
        r.push(
          { label: 'apparent weight now', value: fmt(mass * rec.last(1), 3), unit: 'N', strong: true },
          { label: 'true weight mg', value: fmt(mass * G_BOOKLET, 3), unit: 'N' },
          { label: 'apparent weight: least / most', value: `${fmt(mass * mn, 3)} / ${fmt(mass * mx, 3)}`, unit: 'N' },
          { label: 'average |a|', value: fmt(s.mean, 3), unit: 'm s⁻²' },
        );
      }
    }
    r.push(rate, { label: 'readings', value: String(n) });
    return r;
  });

  const springLink = $derived.by(() => {
    void tick;
    if (id !== 'spring' || rec.length < 10) return '';
    const p = period(rec.view(0), rec.view(1));
    if (!Number.isFinite(p.T)) return '';
    return `#/sim/c1-mass-spring?m=${Math.min(2, mass).toFixed(2)}&k=${Math.min(100, Math.max(2, kFromSpring(mass, p.T))).toFixed(1)}`;
  });

  function fitAOmega2() {
    const w = rec.view(1);
    const a = rec.view(2);
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < w.length; i++)
      if (w[i] > 1) {
        xs.push(w[i] * w[i]);
        ys.push(a[i]);
      }
    return { ...linearFit(xs, ys), xs, ys };
  }

  // ---- a against ω² plot for the centripetal experiment ----
  let canvas: HTMLCanvasElement | undefined = $state();
  $effect(() => {
    void tick;
    if (id !== 'centripetal' || !canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = canvas.clientWidth;
    const H = 260;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const pal = readPalette();
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    const f = fitAOmega2();
    // thin out to at most 600 points for drawing
    const step = Math.max(1, Math.ceil(f.xs.length / 600));
    const pts = f.xs.filter((_, i) => i % step === 0).map((x, i) => ({ x, y: f.ys[i * step] }));
    const xmax = Math.max(10, ...f.xs) * 1.05;
    const ymax = Math.max(2, ...f.ys) * 1.1;
    drawXYPlot(ctx, pal, {
      x0: 52,
      y0: 22,
      x1: W - 14,
      y1: H - 34,
      xmin: 0,
      xmax,
      ymin: 0,
      ymax,
      xLabel: 'ω² / rad² s⁻²',
      yLabel: 'a / m s⁻²',
      points: pts,
      pointColor: pal.series[0],
      fit: f.n >= 5 ? { slope: f.slope, intercept: f.intercept, color: pal.series[3] } : null,
    });
  });
</script>

<LabShell
  {meta}
  {running}
  ontoggle={() => (running ? stop() : start())}
  onclear={clear}
  {status}
  {hint}
  {rows}
  recorder={rec}
  graphs={GR[id]}
>
  {#snippet visual()}
    {#if id === 'centripetal'}<canvas bind:this={canvas} style="height:260px" aria-label="Graph of acceleration against angular velocity squared with a straight-line fit"></canvas>{/if}
  {/snippet}
  {#snippet controls()}
    {#if id === 'accelerometer'}<Toggle label="Include gravity (“with g”)" bind:checked={withG} />{/if}
    {#if id === 'pendulum'}
      <Slider def={{ key: 'L', label: 'Length of the pendulum (pivot to centre of phone)', symbol: 'L', unit: 'm', min: 0.1, max: 3, step: 0.01 }} bind:value={L} />
      <a class="sim" href={`#/sim/c1-pendulum?l=${L}&theta0=10`}>Compare with the pendulum simulation (L = {L.toFixed(2)} m) →</a>
    {/if}
    {#if id === 'spring'}
      <Segmented
        label="Experiment"
        bind:value={springMode}
        options={[
          { value: 'spring', label: 'Phone on a spring' },
          { value: 'lift', label: 'In a lift' },
        ]}
      />
      <Slider def={{ key: 'm', label: springMode === 'spring' ? 'Mass on the spring (phone + bag)' : 'Your mass', symbol: 'm', unit: 'kg', min: 0.05, max: 150, step: 0.01, log: true }} bind:value={mass} />
      {#if springMode === 'spring' && springLink}<a class="sim" href={springLink}>Compare with the mass–spring simulation (same m and k) →</a>{/if}
    {/if}
  {/snippet}
</LabShell>

<style>
  .sim {
    font-weight: 600;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
  }
</style>

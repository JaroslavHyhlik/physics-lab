<script lang="ts">
  import { onMount } from 'svelte';
  import SimShell from '../../sim/SimShell.svelte';
  import SimCanvas from '../../sim/SimCanvas.svelte';
  import Readouts from '../../sim/Readouts.svelte';
  import Slider from '../../ui/Slider.svelte';
  import Segmented from '../../ui/Segmented.svelte';
  import { SimController } from '../../sim/controller.svelte';
  import { useParams, usePalette, resetOn } from '../../sim/setup.svelte';
  import { View } from '../../sim/view';
  import { Interaction } from '../../sim/interaction';
  import type { SimEntry } from '../../app/registry';
  import type { NumberParamDef } from '../../sim/params.svelte';
  import type { SimInfo, GraphDef } from '../../sim/types';
  import type { ChannelDef } from '../../core/recorder';
  import { dampedMotion, period } from '../../physics/oscillator';
  import { g } from '../../core/constants';
  import { drawArrow, drawTag } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [
    { key: 'm', label: 'Mass', symbol: 'm', unit: 'kg', min: 0.05, max: 2, step: 0.01 },
    { key: 'k', label: 'Spring constant', symbol: 'k', unit: 'N m⁻¹', min: 2, max: 100, step: 0.5 },
    { key: 'b', label: 'Damping coefficient', symbol: 'b', unit: 'kg s⁻¹', min: 0, max: 20, step: 0.05 },
    { key: 'x0', label: 'Starting displacement', symbol: 'x_0', unit: 'm', min: -0.2, max: 0.2, step: 0.005 },
  ];
  const { params, sl } = useParams({ dir: 'h', m: 0.5, k: 20, b: 0, x0: 0.1 }, sliders);
  const presets = [
    { id: 'shm', label: 'Undamped SHM', values: { b: 0, m: 0.5, k: 20, x0: 0.1 } },
    { id: 'light', label: 'Light damping', values: { b: 0.4, m: 0.5, k: 20, x0: 0.1 } },
    { id: 'crit', label: 'Critical damping (b = 2√(km))', values: { b: 6.32, m: 0.5, k: 20, x0: 0.1 } },
    { id: 'heavy', label: 'Heavy damping', values: { b: 15, m: 0.5, k: 20, x0: 0.1 } },
    { id: 'vert', label: 'Vertical spring', values: { dir: 'v', b: 0, m: 0.5, k: 20, x0: 0.1 } },
  ];
  const channels: ChannelDef[] = [
    { key: 't', label: 't', unit: 's' },
    { key: 'x', label: 'displacement x', unit: 'm', color: '--series-1' },
    { key: 'v', label: 'velocity v', unit: 'm s⁻¹', color: '--series-2' },
    { key: 'a', label: 'acceleration a', unit: 'm s⁻²', color: '--series-3' },
    { key: 'Ek', label: 'kinetic energy', unit: 'J', color: '--series-2' },
    { key: 'Ep', label: 'potential energy (about equilibrium)', unit: 'J', color: '--series-1' },
    { key: 'E', label: 'total energy', unit: 'J', color: '--series-4' },
  ];
  const graphs: GraphDef[] = [
    { id: 'x', title: 'Displacement', series: ['x'] },
    { id: 'v', title: 'Velocity', series: ['v'] },
    { id: 'a', title: 'Acceleration', series: ['a'] },
    { id: 'E', title: 'Energy', series: ['Ek', 'Ep', 'E'] },
  ];
  const info: SimInfo = {
    about: [
      'A mass on a spring is pulled from its equilibrium position and released. The spring pulls it back with a force proportional to the displacement, F = −kx, so the acceleration is a = −(k/m)x: simple harmonic motion with ω² = k/m.',
      'The period T = 2π√(m/k) does not depend on the amplitude. Displacement, velocity and acceleration are all sinusoidal; velocity is a quarter of a cycle ahead of displacement, and acceleration is always opposite to the displacement.',
      'Energy changes between kinetic and elastic potential energy; without friction the total stays constant. Damping (a force opposite to the velocity) removes energy: the amplitude dies away. With critical damping the mass returns to equilibrium fastest without overshooting.',
      'A vertical spring stretches by mg/k under the weight; the mass then oscillates about this new equilibrium with the same period.',
    ],
    formulas: [
      { label: 'Defining equation of SHM', tex: 'a = -\\omega^{2}x' },
      { label: 'Period of a mass–spring system', tex: 'T = 2\\pi\\sqrt{\\dfrac{m}{k}}' },
      { label: 'Period and angular frequency', tex: 'T = \\dfrac{1}{f} = \\dfrac{2\\pi}{\\omega}' },
      { label: 'Displacement', tex: 'x = x_0\\sin(\\omega t + \\phi)', hl: true },
      { label: 'Energy', tex: 'E_T = \\tfrac{1}{2}m\\omega^{2}x_0^{2}', hl: true },
      { label: 'Damped motion (light damping)', tex: 'x = x_0 e^{-bt/2m}\\cos(\\omega_d t)', beyond: true },
    ],
    assumptions: [
      'Ideal massless spring obeying Hooke’s law; no friction except the damping force F = −bv.',
      'Exact solution of m x″ + b x′ + k x = 0 (all damping regimes), released from rest.',
      'Potential energy is measured from the equilibrium position: ½kx² (for the vertical spring this includes the change in gravitational energy).',
      `g = ${g} m s⁻² (data booklet).`,
    ],
    tryThis: [
      'Double the mass. By what factor does the period change?',
      'Check that the period does not depend on the starting displacement.',
      'Find the damping coefficient that gives critical damping for m = 0.5 kg, k = 20 N m⁻¹.',
      'Where in the motion is the speed greatest? Where is the acceleration greatest?',
    ],
  };

  const view = new View();
  const inter = new Interaction();
  let ctx: CanvasRenderingContext2D | null = null;
  let t = 0;
  const state = () => dampedMotion(params.m, params.k, params.b, params.x0, 0, t);
  const geo = { ox: 0, oy: 0, s: 1, vert: false };
  let dragging = false;

  inter.add({
    priority: 10,
    cursor: 'grab',
    hit: (px, py) => {
      const x = state().x;
      const cx = geo.vert ? geo.ox : geo.ox + x * geo.s;
      const cy = geo.vert ? geo.oy + x * geo.s : geo.oy;
      return Math.hypot(px - cx, py - cy) < 40 ? Math.hypot(px - cx, py - cy) / 4 : Infinity;
    },
    start: () => {
      dragging = true;
      ctrl.pause();
    },
    move: (px, py) => {
      const d = geo.vert ? (py - geo.oy) / geo.s : (px - geo.ox) / geo.s;
      params.x0 = Math.round(Math.max(-0.2, Math.min(0.2, d)) * 200) / 200;
    },
    end: () => {
      dragging = false;
      ctrl.reset();
      ctrl.play();
    },
  });

  function zigzag(x1: number, y1: number, x2: number, y2: number, turns: number, width: number) {
    const c = ctx!;
    const len = Math.hypot(x2 - x1, y2 - y1);
    const ux = (x2 - x1) / len;
    const uy = (y2 - y1) / len;
    const nx = -uy;
    const ny = ux;
    c.beginPath();
    c.moveTo(x1, y1);
    const lead = 10;
    c.lineTo(x1 + ux * lead, y1 + uy * lead);
    const n = turns * 2;
    for (let i = 1; i < n; i++) {
      const f = lead + ((len - 2 * lead) * i) / n;
      const side = i % 2 ? 1 : -1;
      c.lineTo(x1 + ux * f + nx * width * side, y1 + uy * f + ny * width * side);
    }
    c.lineTo(x2 - ux * lead, y2 - uy * lead);
    c.lineTo(x2, y2);
    c.stroke();
  }

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const usable = view.height - 76;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, view.height);
    const vert = params.dir === 'v';
    const st = state();
    const block = 44 * Math.cbrt(params.m / 0.5);
    geo.vert = vert;
    if (!vert) {
      const s = Math.min((W > 760 ? W - 300 : W - 40) / 0.7, 1600);
      const wallX = 40;
      const eqX = wallX + 0.35 * s;
      const y = usable * 0.45;
      geo.ox = eqX;
      geo.oy = y;
      geo.s = s;
      ctx.fillStyle = pal.text3;
      ctx.fillRect(wallX - 14, y - 60, 14, 120);
      ctx.fillRect(wallX - 14, y + block / 2, eqX + 0.4 * s - wallX, 4);
      const mx = eqX + st.x * s;
      ctx.strokeStyle = pal.text2;
      ctx.lineWidth = 2;
      zigzag(wallX, y, mx - block / 2, y, 10, 12);
      ctx.lineWidth = 1;
      ctx.fillStyle = pal.series[0];
      ctx.fillRect(mx - block / 2, y - block / 2, block, block);
      ctx.strokeStyle = pal.gridStrong;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(eqX, y - 70);
      ctx.lineTo(eqX, y + 60);
      ctx.stroke();
      ctx.setLineDash([]);
      drawTag(ctx, eqX, y - 82, 'equilibrium', pal.text3, pal.surface);
      if (Math.abs(st.v) > 1e-4) drawArrow(ctx, mx, y - block / 2 - 16, mx + st.v * s * 0.25, y - block / 2 - 16, pal.series[1], 'v', 2);
      if (Math.abs(st.a) > 1e-4) drawArrow(ctx, mx, y + block / 2 + 22, mx + st.a * s * 0.02, y + block / 2 + 22, pal.series[2], 'a', 2);
      drawTag(ctx, mx, y, `${(st.x * 100).toFixed(1)} cm`, pal.ink, pal.surface);
    } else {
      const s = Math.min((usable - 40) / 0.75, 1600);
      const cx = W > 760 ? (W - 280) * 0.35 : W * 0.35;
      const topY = 20;
      const stretch = (params.m * g) / params.k; // static extension [m]
      const natural = 0.12; // natural length drawn [m]
      const eqY = topY + (natural + Math.min(stretch, 0.4)) * s;
      geo.ox = cx;
      geo.oy = eqY;
      geo.s = s;
      ctx.fillStyle = pal.text3;
      ctx.fillRect(cx - 60, topY - 12, 120, 12);
      const my = eqY + st.x * s;
      ctx.strokeStyle = pal.text2;
      ctx.lineWidth = 2;
      zigzag(cx, topY, cx, my - block / 2, 10, 12);
      ctx.lineWidth = 1;
      ctx.fillStyle = pal.series[0];
      ctx.fillRect(cx - block / 2, my - block / 2, block, block);
      ctx.strokeStyle = pal.gridStrong;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(cx - 80, topY + natural * s);
      ctx.lineTo(cx + 80, topY + natural * s);
      ctx.moveTo(cx - 80, eqY);
      ctx.lineTo(cx + 80, eqY);
      ctx.stroke();
      ctx.setLineDash([]);
      drawTag(ctx, cx + 140, topY + natural * s, 'unstretched end', pal.text3, pal.surface);
      drawTag(ctx, cx + 140, eqY, `equilibrium: stretched mg/k = ${(stretch * 100).toFixed(1)} cm`, pal.text3, pal.surface);
      if (Math.abs(st.v) > 1e-4) drawArrow(ctx, cx - block / 2 - 20, my, cx - block / 2 - 20, my + st.v * s * 0.25, pal.series[1], 'v', 2);
      drawTag(ctx, cx, my, `${(st.x * 100).toFixed(1)} cm`, pal.ink, pal.surface);
    }
    if (dragging) drawTag(ctx, W / 2, 16, 'release to start', pal.text2, pal.surface);
  }

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        t += dt;
      },
      render: draw,
      sample: (tt, out) => {
        const s = dampedMotion(params.m, params.k, params.b, params.x0, 0, tt);
        out[0] = tt;
        out[1] = s.x;
        out[2] = s.v;
        out[3] = s.a;
        out[4] = 0.5 * params.m * s.v * s.v;
        out[5] = 0.5 * params.k * s.x * s.x;
        out[6] = out[4] + out[5];
      },
      reset: () => {
        t = 0;
      },
    },
    { dt: 1 / 240, channels, sampleInterval: 1 / 60, autoplay: true },
  );
  const palette = usePalette(() => ctrl);
  resetOn(ctrl, () => [params.dir, params.m, params.k, params.b, params.x0]);
  $effect(() => {
    void [params.dir, params.m, params.k, params.b, params.x0];
    if (ctx && !dragging) ctrl.play();
  });

  const rows = $derived.by(() => {
    void ctrl.renderCount;
    const s = state();
    const bc = 2 * Math.sqrt(params.k * params.m);
    const regime = params.b === 0 ? 'none' : params.b < bc * 0.999 ? 'light (under)' : params.b > bc * 1.001 ? 'heavy (over)' : 'critical';
    return [
      { label: 'period T = 2π√(m/k)', value: fmt(period(params.m, params.k), 4), unit: 's', strong: true },
      { label: 'ω = √(k/m)', value: fmt(Math.sqrt(params.k / params.m), 4), unit: 'rad s⁻¹' },
      { label: 'x, v, a', value: `${fmt(s.x, 3)} m, ${fmt(s.v, 3)} m s⁻¹, ${fmt(s.a, 3)} m s⁻²` },
      { label: 'energy (k + p)', value: fmt(0.5 * params.m * s.v ** 2 + 0.5 * params.k * s.x ** 2, 4), unit: 'J' },
      { label: 'damping', value: `${regime} · critical b = ${fmt(bc, 3)} kg s⁻¹` },
    ];
  });

  onMount(() => {
    ctrl.mount();
    return () => ctrl.destroy();
  });
</script>

<SimShell
  {entry}
  {ctrl}
  {info}
  {graphs}
  initialGraphs={['x', 'E']}
  {presets}
  onpreset={(id) => Object.assign(params, presets.find((q) => q.id === id)?.values ?? {})}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      interaction={inter}
      label="Mass on a spring"
      onready={(c2) => {
        ctx = c2;
        ctrl.invalidate();
      }}
      onresize={() => ctrl.invalidate()}
    />
  {/snippet}
  {#snippet readouts()}<Readouts {rows} />{/snippet}
  {#snippet controls()}
    <div class="controls">
      <Segmented
        label="Spring"
        bind:value={params.dir}
        options={[
          { value: 'h', label: 'Horizontal' },
          { value: 'v', label: 'Vertical' },
        ]}
      />
      <Slider def={sl('m')} bind:value={params.m} />
      <Slider def={sl('k')} bind:value={params.k} />
      <Slider def={sl('b')} bind:value={params.b} />
      <Slider def={sl('x0')} bind:value={params.x0} />
      <p class="tip">You can also drag the mass and let go.</p>
    </div>
  {/snippet}
</SimShell>

<style>
  .controls {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .tip {
    font-size: var(--text-xs);
    color: var(--text-3);
  }
</style>

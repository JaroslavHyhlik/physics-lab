<script lang="ts">
  import { onMount } from 'svelte';
  import SimShell from '../../sim/SimShell.svelte';
  import SimCanvas from '../../sim/SimCanvas.svelte';
  import Readouts from '../../sim/Readouts.svelte';
  import Slider from '../../ui/Slider.svelte';
  import { SimController } from '../../sim/controller.svelte';
  import { useParams, usePalette, resetOn } from '../../sim/setup.svelte';
  import { View } from '../../sim/view';
  import type { SimEntry } from '../../app/registry';
  import type { NumberParamDef } from '../../sim/params.svelte';
  import type { SimInfo, GraphDef } from '../../sim/types';
  import type { ChannelDef } from '../../core/recorder';
  import { rodOnRails } from '../../physics/induction';
  import { alpha } from '../../sim/palette';
  import { drawArrow, drawTag } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [
    { key: 'F', label: 'Pulling force', symbol: 'F', unit: 'N', min: 0, max: 1, step: 0.01 },
    { key: 'v0', label: 'Starting speed', symbol: 'v_0', unit: 'm s⁻¹', min: 0, max: 5, step: 0.05 },
    { key: 'B', label: 'Magnetic flux density', symbol: 'B', unit: 'T', min: 0.05, max: 1, step: 0.01 },
    { key: 'R', label: 'Resistance', symbol: 'R', unit: 'Ω', min: 0.5, max: 20, step: 0.1 },
    { key: 'm', label: 'Mass of the rod', symbol: 'm', unit: 'kg', min: 0.02, max: 0.5, step: 0.01 },
  ];
  const { params, sl } = useParams({ F: 0.2, v0: 0, B: 0.5, R: 2, m: 0.1 }, sliders);
  const L = 0.4;
  const presets = [
    { id: 'pull', label: 'Constant pull: terminal velocity', values: { F: 0.2, v0: 0, B: 0.5, R: 2, m: 0.1 } },
    { id: 'brake', label: 'Magnetic braking (push and let go)', values: { F: 0, v0: 3, B: 0.5, R: 2, m: 0.1 } },
    { id: 'strong', label: 'Stronger field: lower top speed', values: { F: 0.2, v0: 0, B: 1, R: 2, m: 0.1 } },
  ];
  const channels: ChannelDef[] = [
    { key: 't', label: 't', unit: 's' },
    { key: 'v', label: 'speed v', unit: 'm s⁻¹', color: '--series-1' },
    { key: 'I', label: 'current I', unit: 'A', color: '--series-4' },
  ];
  const graphs: GraphDef[] = [
    { id: 'v', title: 'Speed of the rod', series: ['v'] },
    { id: 'I', title: 'Induced current', series: ['I'] },
  ];
  const info: SimInfo = {
    about: [
      'A metal rod slides on two rails in a magnetic field. As it moves it sweeps out area, so the flux through the circuit changes and an emf ε = BvL is induced (motional emf). A current I = ε/R flows round the circuit.',
      'The current in the rod is in the field, so the rod feels a force BIL that opposes its motion (Lenz’s law): magnetic braking.',
      'Pulled with a constant force, the rod speeds up until the braking force equals the pull. It then moves at a terminal velocity v_t = FR/(B²L²). Let go of a moving rod and it slows down exponentially. The work done by the pull becomes heat in the resistor.',
    ],
    formulas: [
      { label: 'Motional emf', tex: '\\varepsilon = BvL', hl: true },
      { label: 'Force on the rod', tex: 'F = BIL\\sin\\theta' },
      { label: 'Terminal velocity', tex: 'v_t = \\dfrac{FR}{B^{2}L^{2}}', beyond: true },
      { label: 'Speed', tex: 'v = v_t + (v_0 - v_t)e^{-t/\\tau},\\quad \\tau = \\dfrac{mR}{B^{2}L^{2}}', beyond: true },
    ],
    assumptions: [
      'Rails 0.4 m apart, frictionless; all resistance is in the resistor R; the field is uniform and into the screen; self-inductance is ignored.',
      'Exact solution of m dv/dt = F − B²L²v/R. The view follows the rod.',
    ],
    tryThis: [
      'Check the terminal velocity against FR/(B²L²).',
      'Double B. By what factor does the terminal velocity change?',
      'Braking: how long does it take for the speed to halve? Compare with τ ln 2.',
    ],
  };

  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;
  let t = 0;
  const st = () => rodOnRails(params.m, params.R, params.B, L, params.F, params.v0, t);

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const usable = view.height - 76;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, view.height);
    const wArea = W > 760 ? W - 270 : W;
    const s = st();
    const sc = 300; // px per m
    const cy = usable / 2;
    const top = cy - (L / 2) * sc;
    const bot = cy + (L / 2) * sc;
    // the view follows the rod: rod at 60 % of the width
    const rodX = wArea * 0.6;
    const X = (x: number) => rodX + (x - s.x) * sc;
    // field crosses
    ctx.strokeStyle = alpha(pal.text3.startsWith('#') ? pal.text3 : '#888888', 0.5);
    const step = 34;
    const off = ((s.x * sc) % step + step) % step;
    for (let px = -off; px < wArea; px += step)
      for (let py = top - 40; py < bot + 40; py += step) {
        ctx.beginPath();
        ctx.moveTo(px - 3, py - 3);
        ctx.lineTo(px + 3, py + 3);
        ctx.moveTo(px + 3, py - 3);
        ctx.lineTo(px - 3, py + 3);
        ctx.stroke();
      }
    // rails and resistor at x = 0
    ctx.fillStyle = pal.text2;
    ctx.fillRect(Math.max(0, X(0)), top - 3, wArea, 6);
    ctx.fillRect(Math.max(0, X(0)), bot - 3, wArea, 6);
    if (X(0) > -20) {
      ctx.fillStyle = pal.bg;
      ctx.fillRect(X(0) - 8, cy - 30, 16, 60);
      ctx.strokeStyle = pal.text2;
      ctx.strokeRect(X(0) - 8, cy - 30, 16, 60);
      ctx.fillRect(X(0) - 1, top, 2, cy - 30 - top);
      ctx.fillRect(X(0) - 1, cy + 30, 2, bot - cy - 30);
      drawTag(ctx, X(0) + 30, cy, `R = ${params.R} Ω`, pal.text2, pal.surface);
    }
    // swept area since the start
    ctx.fillStyle = alpha(pal.series[0].startsWith('#') ? pal.series[0] : '#3b82f6', 0.1);
    ctx.fillRect(Math.max(0, X(0)), top, rodX - Math.max(0, X(0)), bot - top);
    // rod
    ctx.fillStyle = pal.hl;
    ctx.fillRect(rodX - 5, top - 12, 10, bot - top + 24);
    // current direction in the rod (conventional): I = BvL/R; with B into the screen and v to the right,
    // v × B points up, so the current flows up the rod
    if (s.I > 1e-6) drawArrow(ctx, rodX + 18, cy + 30, rodX + 18, cy - 30, pal.series[3], 'I', 2);
    if (params.F > 0) drawArrow(ctx, rodX + 6, cy, rodX + 6 + 40 + 80 * params.F, cy, pal.series[2], 'F', 3);
    if (s.Fmag > 1e-6) drawArrow(ctx, rodX - 6, cy + 50, rodX - 6 - (40 + 80 * s.Fmag), cy + 50, pal.series[4], 'BIL', 3);
    drawTag(ctx, rodX, top - 30, `v = ${fmt(s.v, 3)} m s⁻¹`, pal.ink, pal.surface);
  }

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        t += dt;
        if (t > 12 * st().tau + 1) ctrl.pause();
      },
      render: draw,
      sample: (tt, out) => {
        const s = rodOnRails(params.m, params.R, params.B, L, params.F, params.v0, tt);
        out[0] = tt;
        out[1] = s.v;
        out[2] = s.I;
      },
      reset: () => {
        t = 0;
      },
    },
    { dt: 1 / 240, channels, sampleInterval: 1 / 30, autoplay: true },
  );
  const palette = usePalette(() => ctrl);
  resetOn(ctrl, () => [params.F, params.v0, params.B, params.R, params.m]);
  $effect(() => {
    void [params.F, params.v0, params.B, params.R, params.m];
    if (ctx) ctrl.play();
  });

  const rows = $derived.by(() => {
    void ctrl.renderCount;
    const s = st();
    return [
      { label: 'emf ε = BvL', value: fmt(s.emf, 3), unit: 'V' },
      { label: 'current I = ε/R', value: fmt(s.I, 3), unit: 'A', color: '--series-4' },
      { label: 'braking force BIL', value: fmt(s.Fmag, 3), unit: 'N' },
      { label: 'terminal velocity FR/(B²L²)', value: fmt(s.vt, 3), unit: 'm s⁻¹', strong: true },
      { label: 'time constant τ = mR/(B²L²)', value: fmt(s.tau, 3), unit: 's' },
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
  initialGraphs={['v', 'I']}
  {presets}
  onpreset={(id) => Object.assign(params, presets.find((q) => q.id === id)?.values ?? {})}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      label="Metal rod sliding on rails in a magnetic field"
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
      <Slider def={sl('F')} bind:value={params.F} />
      <Slider def={sl('v0')} bind:value={params.v0} />
      <Slider def={sl('B')} bind:value={params.B} />
      <Slider def={sl('R')} bind:value={params.R} />
      <Slider def={sl('m')} bind:value={params.m} />
    </div>
  {/snippet}
</SimShell>

<style>
  .controls {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
</style>

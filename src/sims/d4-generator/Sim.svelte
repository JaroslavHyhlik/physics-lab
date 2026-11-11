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
  import { generatorEmf } from '../../physics/induction';
  import { alpha } from '../../sim/palette';
  import { drawArrow, drawTag } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [
    { key: 'N', label: 'Number of turns', symbol: 'N', unit: '', min: 10, max: 500, step: 10 },
    { key: 'A', label: 'Area of the coil', symbol: 'A', unit: 'cm²', min: 10, max: 200, step: 5 },
    { key: 'B', label: 'Magnetic flux density', symbol: 'B', unit: 'T', min: 0.05, max: 1, step: 0.01 },
    { key: 'f', label: 'Rotation frequency', symbol: 'f', unit: 'Hz', min: 0.2, max: 5, step: 0.05 },
  ];
  const { params, sl } = useParams({ N: 100, A: 50, B: 0.2, f: 1 }, sliders);
  const presets = [
    { id: 'base', label: 'Hand-turned generator (1 Hz)', values: { N: 100, A: 50, B: 0.2, f: 1 } },
    { id: 'fast', label: 'Turn it twice as fast', values: { N: 100, A: 50, B: 0.2, f: 2 } },
    { id: 'turns', label: 'More turns', values: { N: 400, A: 50, B: 0.2, f: 1 } },
  ];
  const channels: ChannelDef[] = [
    { key: 't', label: 't', unit: 's' },
    { key: 'phi', label: 'flux linkage NΦ', unit: 'Wb', color: '--series-1' },
    { key: 'emf', label: 'emf ε', unit: 'V', color: '--series-4' },
  ];
  const graphs: GraphDef[] = [
    { id: 'phi', title: 'Flux linkage', series: ['phi'] },
    { id: 'emf', title: 'Induced emf', series: ['emf'] },
  ];
  const info: SimInfo = {
    about: [
      'A coil turning in a magnetic field has a flux linkage NΦ = NBA cos ωt that changes all the time, so an alternating emf is induced: ε = NBAω sin ωt.',
      'The emf is largest when the coil is parallel to the field (the flux is zero but changing fastest) and zero when the coil faces the field (largest flux, momentarily not changing).',
      'Turning the coil faster increases both the frequency and the peak emf. The root-mean-square (rms) value ε₀/√2 is the steady emf that would deliver the same average power into a resistor.',
    ],
    formulas: [
      { label: 'Flux', tex: '\\Phi = BA\\cos\\theta', hl: true },
      { label: 'Faraday’s law', tex: '\\varepsilon = -N\\dfrac{\\Delta\\Phi}{\\Delta t}', hl: true },
      { label: 'Generator emf', tex: '\\varepsilon = NBA\\omega\\sin\\omega t', beyond: true },
      { label: 'rms value', tex: '\\varepsilon_\\text{rms} = \\dfrac{\\varepsilon_0}{\\sqrt{2}}', beyond: true },
    ],
    assumptions: ['Uniform field between the poles; flat rectangular coil turning at constant speed; no load current (open circuit).', 'The angle θ is measured between the field and the normal to the coil.'],
    tryThis: [
      'Pause when the emf is at its peak. Which way is the coil facing?',
      'Double the frequency. What happens to the peak emf and to the period?',
      'Compare the graphs: where is ε zero when NΦ is largest?',
    ],
  };

  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;
  let t = 0;
  const w = () => 2 * Math.PI * params.f;
  const e0 = () => params.N * params.B * params.A * 1e-4 * w();

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const usable = view.height - 76;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, view.height);
    const wArea = W > 760 ? W - 270 : W;
    const cx = wArea / 2;
    const cy = usable / 2;
    const gap = Math.min(wArea * 0.55, 380);
    ctx.fillStyle = pal.series[3];
    ctx.fillRect(cx - gap / 2 - 60, cy - 100, 60, 200);
    ctx.fillStyle = pal.series[0];
    ctx.fillRect(cx + gap / 2, cy - 100, 60, 200);
    ctx.fillStyle = pal.surface;
    ctx.font = '700 20px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', cx - gap / 2 - 30, cy);
    ctx.fillText('S', cx + gap / 2 + 30, cy);
    for (let y = cy - 80; y <= cy + 80; y += 40) drawArrow(ctx, cx - gap / 2 + 6, y, cx + gap / 2 - 6, y, alpha(pal.text3.startsWith('#') ? pal.text3 : '#888888', 0.6), undefined, 1);
    // coil seen from above the axis: its width in the picture is ∝ |sin| of its angle to the screen
    const th = w() * t; // angle between the field and the coil's normal
    const half = Math.min(gap * 0.32, 110);
    const pw = half * Math.sin(th); // projected half-width
    const hh = Math.min(usable * 0.3, 90);
    ctx.fillStyle = alpha(pal.hl.startsWith('#') ? pal.hl : '#f59e0b', 0.25);
    ctx.strokeStyle = pal.hl;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.rect(cx - Math.abs(pw), cy - hh, 2 * Math.abs(pw) || 2, 2 * hh);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 1;
    // axle and normal
    ctx.strokeStyle = pal.text2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - hh - 30);
    ctx.lineTo(cx, cy + hh + 30);
    ctx.stroke();
    drawTag(ctx, cx, cy + hh + 44, `θ = ${(((th * 180) / Math.PI) % 360).toFixed(0)}°`, pal.text2, pal.surface);
    // emf meter
    const e = generatorEmf(params.N, params.B, params.A * 1e-4, w(), t);
    const bx = cx - 120;
    const by = 24;
    ctx.fillStyle = pal.gridStrong;
    ctx.fillRect(bx, by, 240, 10);
    ctx.fillStyle = e >= 0 ? pal.series[3] : pal.series[0];
    const frac = e / e0();
    ctx.fillRect(cx, by, frac * 120, 10);
    drawTag(ctx, cx, by + 26, `ε = ${fmt(e, 3)} V`, pal.ink, pal.surface);
  }

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        t += dt;
      },
      render: draw,
      sample: (tt, out) => {
        out[0] = tt;
        out[1] = params.N * params.B * params.A * 1e-4 * Math.cos(w() * tt);
        out[2] = generatorEmf(params.N, params.B, params.A * 1e-4, w(), tt);
      },
      reset: () => {
        t = 0;
      },
    },
    { dt: 1 / 240, channels, sampleInterval: 1 / 60, autoplay: true },
  );
  const palette = usePalette(() => ctrl);
  resetOn(ctrl, () => [params.N, params.A, params.B, params.f]);

  const rows = $derived.by(() => [
    { label: 'peak emf ε₀ = NBAω', value: fmt(e0(), 4), unit: 'V', strong: true },
    { label: 'rms emf ε₀/√2', value: fmt(e0() / Math.SQRT2, 4), unit: 'V' },
    { label: 'period T = 1/f', value: fmt(1 / params.f, 3), unit: 's' },
    { label: 'peak if turned at 50 Hz', value: fmt(params.N * params.B * params.A * 1e-4 * 2 * Math.PI * 50, 4), unit: 'V' },
  ]);

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
  initialGraphs={['phi', 'emf']}
  {presets}
  onpreset={(id) => Object.assign(params, presets.find((q) => q.id === id)?.values ?? {})}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      label="Coil rotating between magnet poles generating an alternating emf"
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
      <Slider def={sl('N')} bind:value={params.N} />
      <Slider def={sl('A')} bind:value={params.A} />
      <Slider def={sl('B')} bind:value={params.B} />
      <Slider def={sl('f')} bind:value={params.f} />
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

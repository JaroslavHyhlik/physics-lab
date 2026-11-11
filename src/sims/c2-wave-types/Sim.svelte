<script lang="ts">
  import { onMount } from 'svelte';
  import SimShell from '../../sim/SimShell.svelte';
  import SimCanvas from '../../sim/SimCanvas.svelte';
  import Readouts from '../../sim/Readouts.svelte';
  import Slider from '../../ui/Slider.svelte';
  import Segmented from '../../ui/Segmented.svelte';
  import { SimController } from '../../sim/controller.svelte';
  import { useParams, usePalette } from '../../sim/setup.svelte';
  import { View } from '../../sim/view';
  import type { SimEntry } from '../../app/registry';
  import type { NumberParamDef } from '../../sim/params.svelte';
  import type { SimInfo, GraphDef } from '../../sim/types';
  import type { ChannelDef } from '../../core/recorder';
  import { displacement, compressions } from '../../physics/waves';
  import { drawXYPlot } from '../../sim/xyPlot';
  import { drawTag } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [
    { key: 'f', label: 'Frequency', symbol: 'f', unit: 'Hz', min: 0.1, max: 2, step: 0.05 },
    { key: 'lambda', label: 'Wavelength', symbol: 'λ', unit: 'm', min: 0.2, max: 2, step: 0.05 },
    { key: 'A', label: 'Amplitude', symbol: 'A', unit: 'cm', min: 1, max: 12, step: 0.5 },
    { key: 'xp', label: 'Watched particle at', symbol: 'x', unit: 'm', min: 0, max: 3, step: 0.05 },
  ];
  const { params, sl } = useParams({ type: 'trans', f: 0.5, lambda: 1, A: 8, xp: 1 }, sliders);
  const presets = [
    { id: 'trans', label: 'Transverse wave (rope)', values: { type: 'trans', f: 0.5, lambda: 1, A: 8 } },
    { id: 'long', label: 'Longitudinal wave (sound, slinky)', values: { type: 'long', f: 0.5, lambda: 1, A: 8 } },
    { id: 'short', label: 'Same speed, shorter wavelength', values: { f: 1, lambda: 0.5, A: 6 } },
  ];
  const L = 3; // m of medium shown
  const channels: ChannelDef[] = [
    { key: 't', label: 't', unit: 's' },
    { key: 's', label: 'displacement of the watched particle', unit: 'cm', color: '--series-4' },
  ];
  const graphs: GraphDef[] = [{ id: 's', title: 'Displacement–time graph (watched particle)', series: ['s'] }];
  const info: SimInfo = {
    about: [
      'A wave transfers energy (not matter) through a medium. Each particle of the medium oscillates about its rest position with SHM; neighbouring particles start a little later, so the disturbance travels along.',
      'Transverse waves: the particles oscillate at right angles to the direction the wave travels (waves on a rope, light). Longitudinal waves: the particles oscillate along that direction, making compressions (bunched up) and rarefactions (spread out) — sound is a longitudinal wave.',
      'The wavelength λ is the distance between two neighbouring particles in phase; the period T is the time for one oscillation. In one period the wave moves on by one wavelength, so v = λ/T = fλ.',
      'The displacement–distance graph is a snapshot of all particles at one moment; the displacement–time graph follows one particle.',
    ],
    formulas: [
      { label: 'Wave speed', tex: 'v = f\\lambda = \\dfrac{\\lambda}{T}' },
      { label: 'Period', tex: 'T = \\dfrac{1}{f}' },
      { label: 'Displacement of the particle at x', tex: 's = A\\sin\\left(2\\pi\\left(ft - \\dfrac{x}{\\lambda}\\right)\\right)', beyond: true },
    ],
    assumptions: ['A continuous sinusoidal wave travelling to the right with no loss of energy.', 'Displacements in the picture are exaggerated compared with the wavelength.'],
    tryThis: [
      'Watch one particle: does it travel along with the wave?',
      'Switch to longitudinal. Where is the displacement zero on the graph — at the compressions, the rarefactions, or both?',
      'Double the frequency at the same wave speed. What happens to the wavelength?',
    ],
  };

  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;
  let t = 0;
  const wp = () => ({ A: params.A / 100, lambda: params.lambda, f: params.f });

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const usable = view.height - 76;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, view.height);
    const w = wp();
    const x0 = 50;
    const x1 = W > 760 ? W - 280 : W - 30;
    const sx = (x1 - x0) / L;
    const midY = usable * 0.28;
    const exag = Math.min(1, (usable * 0.12) / (w.A * sx)); // keep the picture in its band
    const N = 60;
    const watched = Math.round((params.xp / L) * (N - 1));
    if (params.type === 'trans') {
      for (let i = 0; i < N; i++) {
        const x = (i / (N - 1)) * L;
        const s = displacement(x, t, w);
        ctx.fillStyle = i === watched ? pal.series[3] : pal.series[0];
        ctx.beginPath();
        ctx.arc(x0 + x * sx, midY - s * sx * exag, i === watched ? 7 : 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      const rows = 7;
      for (let r = 0; r < rows; r++) {
        const y = midY - 60 + (r * 120) / (rows - 1);
        for (let i = 0; i < N; i++) {
          const x = (i / (N - 1)) * L;
          const s = displacement(x, t, w);
          ctx.fillStyle = i === watched ? pal.series[3] : pal.series[0];
          ctx.beginPath();
          ctx.arc(x0 + (x + s * exag) * sx, y, i === watched ? 5 : 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      for (const c of compressions(L, t, w)) drawTag(ctx, x0 + c * sx, midY + 78, 'C', pal.series[3], pal.surface);
      for (const c of compressions(L, t + 0.5 / w.f, w)) drawTag(ctx, x0 + c * sx, midY + 78, 'R', pal.series[0], pal.surface);
    }
    // displacement–distance snapshot
    const gy0 = midY + 110;
    const gy1 = usable - 20;
    if (gy1 - gy0 < 60) return;
    const Acm = params.A;
    drawXYPlot(ctx, pal, {
      x0,
      y0: gy0,
      x1,
      y1: gy1,
      xmin: 0,
      xmax: L,
      ymin: -Acm * 1.3,
      ymax: Acm * 1.3,
      xLabel: 'distance x / m',
      yLabel: params.type === 'trans' ? 'displacement / cm (up = +)' : 'displacement / cm (right = +)',
      curves: [{ fn: (x) => displacement(x, t, w) * 100, color: pal.series[0], width: 2.5 }],
      current: { x: (watched / (N - 1)) * L, y: displacement((watched / (N - 1)) * L, t, w) * 100 },
    });
    // wavelength marker
    const xa = 0.2;
    const y = gy0 + 12;
    ctx.strokeStyle = pal.text2;
    ctx.beginPath();
    ctx.moveTo(x0 + xa * sx, y);
    ctx.lineTo(x0 + (xa + w.lambda) * sx, y);
    ctx.stroke();
    drawTag(ctx, x0 + (xa + w.lambda / 2) * sx, y, `λ = ${fmt(w.lambda, 3)} m`, pal.text2, pal.surface);
  }

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        t += dt;
      },
      render: draw,
      sample: (tt, out) => {
        out[0] = tt;
        const N = 60;
        const watched = Math.round((params.xp / L) * (N - 1));
        out[1] = displacement((watched / (N - 1)) * L, tt, wp()) * 100;
      },
      reset: () => {
        t = 0;
      },
    },
    { dt: 1 / 240, channels, sampleInterval: 1 / 60, autoplay: true },
  );
  const palette = usePalette(() => ctrl);

  const rows = $derived([
    { label: 'wave speed v = fλ', value: fmt(params.f * params.lambda, 3), unit: 'm s⁻¹', strong: true },
    { label: 'period T = 1/f', value: fmt(1 / params.f, 3), unit: 's' },
    { label: 'wavelength λ', value: fmt(params.lambda, 3), unit: 'm' },
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
  initialGraphs={['s']}
  {presets}
  onpreset={(id) => Object.assign(params, presets.find((q) => q.id === id)?.values ?? {})}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      label="Particles of a medium carrying a transverse or longitudinal wave"
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
        label="Wave"
        bind:value={params.type}
        options={[
          { value: 'trans', label: 'Transverse' },
          { value: 'long', label: 'Longitudinal' },
        ]}
      />
      <Slider def={sl('f')} bind:value={params.f} />
      <Slider def={sl('lambda')} bind:value={params.lambda} />
      <Slider def={sl('A')} bind:value={params.A} />
      <Slider def={sl('xp')} bind:value={params.xp} />
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

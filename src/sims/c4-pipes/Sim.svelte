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
  import type { SimInfo } from '../../sim/types';
  import { pipeFreq, pipeDisplacement, pipePressure, type PipeKind } from '../../physics/standing';
  import { playTone } from '../../sim/tone';
  import { Rng } from '../../core/rng';
  import { drawTag } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [
    { key: 'n', label: 'Harmonic number n', symbol: 'n', unit: '', min: 1, max: 6, step: 1 },
    { key: 'L', label: 'Length of the pipe', symbol: 'L', unit: 'm', min: 0.1, max: 2, step: 0.01 },
    { key: 'v', label: 'Speed of sound', symbol: 'v', unit: 'm s⁻¹', min: 250, max: 1000, step: 1 },
  ];
  const { params, sl } = useParams({ kind: 'open', show: 'disp', n: 1, L: 0.5, v: 343 }, sliders);
  const presets = [
    { id: 'open', label: 'Open pipe, fundamental', values: { kind: 'open', n: 1, L: 0.5, v: 343 } },
    { id: 'closed', label: 'Closed pipe, fundamental', values: { kind: 'closed', n: 1, L: 0.5, v: 343 } },
    { id: 'c3', label: 'Closed pipe, next mode (3rd harmonic)', values: { kind: 'closed', n: 2, L: 0.5, v: 343 } },
    { id: 'pressure', label: 'Pressure instead of displacement', values: { kind: 'open', n: 2, show: 'press' } },
  ];
  const info: SimInfo = {
    about: [
      'Sound in a pipe reflects at the ends and forms a standing wave of the air. At an open end the air can move freely: there is a displacement antinode (and the pressure stays atmospheric: a pressure node). At a closed end the air cannot move: a displacement node (and a pressure antinode).',
      'A pipe open at both ends fits n half-wavelengths: f_n = nv/2L, all harmonics. A pipe closed at one end fits an odd number of quarter-wavelengths: f = (2n − 1)v/4L, only the odd harmonics, and its fundamental is an octave lower than an open pipe of the same length.',
      'The dots show air molecules moving back and forth (longitudinal wave); where they bunch up the pressure is high.',
    ],
    formulas: [
      { label: 'Wave speed', tex: 'v = f\\lambda' },
      { label: 'Pipe open at both ends', tex: 'f_n = \\dfrac{nv}{2L}', beyond: true },
      { label: 'Pipe closed at one end', tex: 'f_n = \\dfrac{(2n-1)v}{4L}', beyond: true },
    ],
    assumptions: [
      'Ideal pipe: no end correction (real antinodes are slightly beyond the open end), no losses.',
      'Speed of sound 343 m s⁻¹ in air at 20 °C. Motion slowed down to about 1 oscillation per second; the button plays the real frequency.',
    ],
    tryThis: [
      'Compare the fundamental of an open and a closed pipe of the same length.',
      'For the closed pipe, why are there no even harmonics?',
      'Measure where the pressure varies most: is it where the air moves most?',
    ],
  };

  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;
  let t = 0;
  const N = () => Math.round(params.n);
  const kind = () => params.kind as PipeKind;
  // fixed random layout of the "molecules"
  const rng = new Rng(4);
  const mols = Array.from({ length: 260 }, () => ({ x: rng.next(), y: rng.next() }));

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const usable = view.height - 76;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, view.height);
    const x0 = 60;
    const x1 = W > 760 ? W - 280 : W - 30;
    const yTop = usable * 0.2;
    const hgt = Math.min(90, usable * 0.25);
    const L = params.L;
    const X = (x: number) => x0 + (x / L) * (x1 - x0);
    const ph = 2 * Math.PI * t; // 1 Hz visual
    const n = N();
    const k = kind();
    // pipe walls
    ctx.strokeStyle = pal.text2;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x0, yTop);
    ctx.lineTo(x1, yTop);
    ctx.moveTo(x0, yTop + hgt);
    ctx.lineTo(x1, yTop + hgt);
    if (k === 'closed') {
      ctx.moveTo(x1, yTop - 2);
      ctx.lineTo(x1, yTop + hgt + 2);
    }
    ctx.stroke();
    ctx.lineWidth = 1;
    // molecules
    const ampPx = (x1 - x0) * 0.04;
    ctx.fillStyle = pal.series[0];
    for (const m of mols) {
      const xm = m.x * L;
      const dx = ampPx * pipeDisplacement(k, n, xm, L) * Math.sin(ph);
      ctx.beginPath();
      ctx.arc(Math.min(x1 - 2, Math.max(x0 - 6, X(xm) + dx)), yTop + 6 + m.y * (hgt - 12), 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    // envelope graph of displacement or pressure
    const gy = yTop + hgt + 90;
    const ga = Math.min(60, usable * 0.16);
    ctx.strokeStyle = pal.gridStrong;
    ctx.beginPath();
    ctx.moveTo(x0, gy);
    ctx.lineTo(x1, gy);
    ctx.stroke();
    const f = params.show === 'disp' ? (x: number) => pipeDisplacement(k, n, x, L) : (x: number) => pipePressure(k, n, x, L);
    ctx.strokeStyle = params.show === 'disp' ? pal.series[0] : pal.series[3];
    ctx.lineWidth = 2;
    for (const s of [1, -1]) {
      ctx.beginPath();
      for (let i = 0; i <= 200; i++) {
        const x = (L * i) / 200;
        const y = gy - s * ga * f(x);
        if (i === 0) ctx.moveTo(X(x), y);
        else ctx.lineTo(X(x), y);
      }
      ctx.stroke();
    }
    ctx.lineWidth = 1;
    ctx.fillStyle = pal.text3;
    ctx.font = '500 11px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(params.show === 'disp' ? 'displacement of the air (envelope)' : 'pressure variation (envelope)', x0, gy - ga - 8);
    // node / antinode labels for the displayed quantity (found numerically on a fine grid)
    const steps = 2000;
    const val = (i: number) => f((L * i) / steps);
    for (let i = 0; i <= steps; i++) {
      const c = val(i);
      const x = (L * i) / steps;
      const a = i > 0 ? Math.abs(val(i - 1)) : -1;
      const b = i < steps ? Math.abs(val(i + 1)) : -1;
      if (Math.abs(c) > 0.9999 && Math.abs(c) >= a && Math.abs(c) >= b) drawTag(ctx, X(x), gy + ga + 18, 'A', pal.series[3], pal.surface);
      const prevSign = i > 0 ? Math.sign(val(i - 1)) : 0;
      if (Math.abs(c) < 1e-9 || (i > 0 && prevSign !== 0 && Math.sign(c) !== 0 && Math.sign(c) !== prevSign))
        drawTag(ctx, X(x), gy + ga + 18, 'N', pal.text2, pal.surface);
    }
    drawTag(ctx, X(0), yTop - 14, 'open', pal.text2, pal.surface);
    drawTag(ctx, X(L), yTop - 14, k === 'open' ? 'open' : 'closed', pal.text2, pal.surface);
  }

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        t += dt;
      },
      render: draw,
      reset: () => {
        t = 0;
      },
    },
    { dt: 1 / 120, autoplay: true },
  );
  const palette = usePalette(() => ctrl);

  const rows = $derived.by(() => {
    const f = pipeFreq(kind(), N(), params.L, params.v);
    const harm = kind() === 'open' ? N() : 2 * N() - 1;
    return [
      { label: 'frequency', value: fmt(f, 4), unit: 'Hz', strong: true },
      { label: 'harmonic (multiple of f₁)', value: `${harm}` },
      { label: 'fundamental f₁', value: fmt(pipeFreq(kind(), 1, params.L, params.v), 4), unit: 'Hz' },
      { label: 'wavelength λ = v/f', value: fmt(params.v / f, 4), unit: 'm' },
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
  graphs={[]}
  {presets}
  onpreset={(id) => Object.assign(params, presets.find((q) => q.id === id)?.values ?? {})}
  stopwatch={false}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      label="Standing sound wave in a pipe"
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
        label="Pipe"
        bind:value={params.kind}
        options={[
          { value: 'open', label: 'Open–open' },
          { value: 'closed', label: 'Open–closed' },
        ]}
      />
      <Segmented
        label="Graph shows"
        bind:value={params.show}
        options={[
          { value: 'disp', label: 'Displacement' },
          { value: 'press', label: 'Pressure' },
        ]}
      />
      <Slider def={sl('n')} bind:value={params.n} />
      <Slider def={sl('L')} bind:value={params.L} />
      <Slider def={sl('v')} bind:value={params.v} />
      <button type="button" class="play" onclick={() => playTone(pipeFreq(kind(), N(), params.L, params.v))}>Play the note</button>
    </div>
  {/snippet}
</SimShell>

<style>
  .controls {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .play {
    min-height: 44px;
    border-radius: var(--radius-s);
    border: 1px solid var(--accent);
    background: var(--accent);
    color: var(--on-accent);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
</style>

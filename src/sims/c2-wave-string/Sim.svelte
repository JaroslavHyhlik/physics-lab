<script lang="ts">
  import { onMount } from 'svelte';
  import SimShell from '../../sim/SimShell.svelte';
  import SimCanvas from '../../sim/SimCanvas.svelte';
  import Readouts from '../../sim/Readouts.svelte';
  import Slider from '../../ui/Slider.svelte';
  import Segmented from '../../ui/Segmented.svelte';
  import Toggle from '../../ui/Toggle.svelte';
  import { SimController } from '../../sim/controller.svelte';
  import { useParams, usePalette, resetOn } from '../../sim/setup.svelte';
  import { View } from '../../sim/view';
  import type { SimEntry } from '../../app/registry';
  import type { NumberParamDef } from '../../sim/params.svelte';
  import type { SimInfo, GraphDef } from '../../sim/types';
  import type { ChannelDef } from '../../core/recorder';
  import { StringFD, pulse, type EndKind } from '../../physics/stringWave';
  import { drawTag } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [
    { key: 'T', label: 'Tension', symbol: 'T', unit: 'N', min: 2, max: 50, step: 0.5 },
    { key: 'mu1', label: 'Linear density (left string)', symbol: 'μ_1', unit: 'kg m⁻¹', min: 0.01, max: 0.5, step: 0.005 },
    { key: 'mu2', label: 'Linear density (right string)', symbol: 'μ_2', unit: 'kg m⁻¹', min: 0.01, max: 0.5, step: 0.005 },
    { key: 'A', label: 'Pulse height', symbol: 'A', unit: 'cm', min: 1, max: 10, step: 0.5 },
    { key: 'f', label: 'Frequency of the hand', symbol: 'f', unit: 'Hz', min: 0.5, max: 10, step: 0.1 },
  ];
  const { params, sl } = useParams({ end: 'fixed', two: false, drive: 'pulse', T: 20, mu1: 0.05, mu2: 0.2, A: 5, f: 2 }, sliders);
  const presets = [
    { id: 'fixed', label: 'Pulse reflected at a fixed end', values: { end: 'fixed', two: false, drive: 'pulse' } },
    { id: 'free', label: 'Pulse reflected at a free end', values: { end: 'free', two: false, drive: 'pulse' } },
    { id: 'heavy', label: 'Light string joined to a heavy one', values: { end: 'open', two: true, mu1: 0.05, mu2: 0.2, drive: 'pulse' } },
    { id: 'lightr', label: 'Heavy string joined to a light one', values: { end: 'open', two: true, mu1: 0.2, mu2: 0.05, drive: 'pulse' } },
    { id: 'cont', label: 'Continuous wave', values: { end: 'open', two: false, drive: 'sine', f: 2 } },
  ];
  const L = 10;
  const SLOW = 0.1; // simulated seconds per second of animation
  const channels: ChannelDef[] = [
    { key: 't', label: 't (real)', unit: 's' },
    { key: 'y1', label: 'displacement at x = 2.5 m', unit: 'cm', color: '--series-1' },
    { key: 'y2', label: 'displacement at x = 7.5 m', unit: 'cm', color: '--series-2' },
  ];
  const graphs: GraphDef[] = [{ id: 'y', title: 'Displacement at two points', series: ['y1', 'y2'] }];
  const info: SimInfo = {
    about: [
      'Flick the end of a stretched string and a pulse runs along it. Its speed depends only on the string: v = √(T/μ), where T is the tension and μ the mass per metre. A tighter or lighter string carries waves faster.',
      'At a fixed end the string cannot move, so it pulls the pulse back upside down: the reflected pulse is inverted (a phase change of π). At a free end (a ring sliding on a smooth rod) the pulse comes back the same way up.',
      'Where a light string joins a heavy one, part of the pulse goes on and part is reflected inverted, like a weaker fixed end. Going from heavy to light, the reflection is upright. The transmitted pulse never changes sign.',
    ],
    formulas: [
      { label: 'Wave speed', tex: 'v = f\\lambda' },
      { label: 'Speed of a wave on a string', tex: 'v = \\sqrt{\\dfrac{T}{\\mu}}', beyond: true },
      { label: 'Reflected fraction at a join', tex: '\\dfrac{A_r}{A_i} = \\dfrac{\\sqrt{\\mu_1} - \\sqrt{\\mu_2}}{\\sqrt{\\mu_1} + \\sqrt{\\mu_2}}', beyond: true },
    ],
    assumptions: [
      'A perfectly flexible string with small displacements (linear wave equation), no friction.',
      'Solved with finite differences (Courant number ≤ 1). Time is slowed down 10 times; displacements are exaggerated.',
      '“Open” end: the string continues for ever, so nothing is reflected there.',
    ],
    tryThis: [
      'Measure the time for a pulse to travel 10 m and compare with √(T/μ).',
      'Compare the reflected pulses at a fixed and a free end.',
      'Join a light string to a heavy one: which pulse is bigger, the reflected or the transmitted one?',
    ],
  };

  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;
  const build = () =>
    new StringFD({ L, N: 800, T: params.T, mu1: params.mu1, mu2: params.two ? params.mu2 : params.mu1, join: params.two ? L / 2 : 2 * L, end: params.end as EndKind });
  let str = build();
  function setDrive() {
    const t0 = str.t;
    if (params.drive === 'pulse') {
      const p = pulse(params.A / 100, 0.08);
      str.drive = (t) => p(t - t0);
    } else {
      const w = 2 * Math.PI * params.f;
      str.drive = (t) => (params.A / 100) * Math.sin(w * (t - t0));
    }
  }
  setDrive();

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const usable = view.height - 76;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, view.height);
    const x0 = 50;
    const x1 = W > 760 ? W - 280 : W - 40;
    const sx = (x1 - x0) / L;
    const y0 = usable * 0.5;
    const sy = Math.min(usable * 0.3, 160) / 0.1; // px per m of displacement (exaggerated)
    // two parts in different thickness
    const y = str.y;
    const N = y.length - 1;
    for (const part of params.two ? [0, 1] : [0]) {
      ctx.strokeStyle = part === 0 ? pal.series[0] : pal.series[1];
      const mu = part === 0 ? params.mu1 : params.mu2;
      ctx.lineWidth = Math.max(1.5, Math.min(8, Math.sqrt(mu) * 14));
      ctx.beginPath();
      const i0 = part === 0 ? 0 : N / 2;
      const i1 = params.two ? (part === 0 ? N / 2 : N) : N;
      for (let i = i0; i <= i1; i++) {
        const px = x0 + i * str.dx * sx;
        const py = y0 - y[i] * sy;
        if (i === i0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.lineWidth = 1;
    // hand
    ctx.fillStyle = pal.text2;
    ctx.beginPath();
    ctx.roundRect(x0 - 26, y0 - y[0] * sy - 12, 22, 24, 6);
    ctx.fill();
    // right end
    const ex = x0 + L * sx;
    if (params.end === 'fixed') {
      ctx.fillStyle = pal.text3;
      ctx.fillRect(ex, y0 - 60, 10, 120);
    } else if (params.end === 'free') {
      ctx.strokeStyle = pal.text3;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(ex + 6, y0 - 80);
      ctx.lineTo(ex + 6, y0 + 80);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = pal.text2;
      ctx.beginPath();
      ctx.arc(ex + 6, y0 - y[N] * sy, 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
    } else {
      drawTag(ctx, ex - 20, y0 + 30, 'continues →', pal.text3, pal.surface);
    }
    if (params.two) {
      ctx.strokeStyle = pal.gridStrong;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x0 + (L / 2) * sx, y0 - 90);
      ctx.lineTo(x0 + (L / 2) * sx, y0 + 90);
      ctx.stroke();
      ctx.setLineDash([]);
      drawTag(ctx, x0 + (L / 4) * sx, y0 + 100, `v₁ = ${fmt(str.speedAt(0), 3)} m s⁻¹`, pal.series[0], pal.surface);
      drawTag(ctx, x0 + (3 * L / 4) * sx, y0 + 100, `v₂ = ${fmt(str.speedAt(L), 3)} m s⁻¹`, pal.series[1], pal.surface);
    }
    // metre marks
    ctx.fillStyle = pal.text3;
    ctx.font = '500 10px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let m = 0; m <= L; m++) {
      ctx.fillRect(x0 + m * sx, usable - 28, 1, 6);
      ctx.fillText(`${m}`, x0 + m * sx, usable - 20);
    }
    ctx.fillText('x / m', x1 + 20, usable - 20);
  }

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        str.step(dt * SLOW);
      },
      render: draw,
      sample: (_t, out) => {
        out[0] = str.t;
        out[1] = str.y[Math.round(2.5 / str.dx)] * 100;
        out[2] = str.y[Math.round(7.5 / str.dx)] * 100;
      },
      reset: () => {
        str = build();
        setDrive();
      },
    },
    { dt: 1 / 240, channels, sampleInterval: 1 / 30, autoplay: true },
  );
  const palette = usePalette(() => ctrl);
  resetOn(ctrl, () => [params.end, params.two, params.drive, params.T, params.mu1, params.mu2, params.A, params.f]);
  $effect(() => {
    void [params.end, params.two, params.drive, params.T, params.mu1, params.mu2, params.A, params.f];
    if (ctx) ctrl.play();
  });

  const rows = $derived.by(() => {
    const v1 = Math.sqrt(params.T / params.mu1);
    const r: { label: string; value: string; unit?: string; strong?: boolean }[] = [{ label: 'v = √(T/μ)', value: fmt(v1, 3), unit: 'm s⁻¹', strong: true }];
    if (params.two) {
      const v2 = Math.sqrt(params.T / params.mu2);
      const Z1 = Math.sqrt(params.mu1);
      const Z2 = Math.sqrt(params.mu2);
      r.push({ label: 'right string v₂', value: fmt(v2, 3), unit: 'm s⁻¹' });
      r.push({ label: 'reflected / incident', value: fmt((Z1 - Z2) / (Z1 + Z2), 3) });
      r.push({ label: 'transmitted / incident', value: fmt((2 * Z1) / (Z1 + Z2), 3) });
    }
    if (params.drive === 'sine') r.push({ label: 'wavelength λ = v/f', value: fmt(v1 / params.f, 3), unit: 'm' });
    r.push({ label: 'time to travel 10 m', value: fmt(L / v1, 3), unit: 's (real)' });
    return r;
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
  initialGraphs={['y']}
  {presets}
  onpreset={(id) => Object.assign(params, presets.find((q) => q.id === id)?.values ?? {})}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      label="Pulses and waves on a stretched string"
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
        label="Hand"
        bind:value={params.drive}
        options={[
          { value: 'pulse', label: 'One pulse' },
          { value: 'sine', label: 'Keeps shaking' },
        ]}
      />
      <button
        type="button"
        class="send"
        onclick={() => {
          setDrive();
          ctrl.play();
        }}>Send again</button
      >
      <Segmented
        label="Right end"
        bind:value={params.end}
        options={[
          { value: 'fixed', label: 'Fixed' },
          { value: 'free', label: 'Free' },
          { value: 'open', label: 'Open' },
        ]}
      />
      <Toggle label="Two different strings" bind:checked={params.two} />
      <Slider def={sl('T')} bind:value={params.T} />
      <Slider def={sl('mu1')} bind:value={params.mu1} />
      {#if params.two}<Slider def={sl('mu2')} bind:value={params.mu2} />{/if}
      <Slider def={sl('A')} bind:value={params.A} />
      {#if params.drive === 'sine'}<Slider def={sl('f')} bind:value={params.f} />{/if}
    </div>
  {/snippet}
</SimShell>

<style>
  .controls {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .send {
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

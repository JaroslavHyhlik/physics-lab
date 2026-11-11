<script lang="ts">
  import { onMount } from 'svelte';
  import SimShell from '../../sim/SimShell.svelte';
  import SimCanvas from '../../sim/SimCanvas.svelte';
  import Readouts from '../../sim/Readouts.svelte';
  import Slider from '../../ui/Slider.svelte';
  import Toggle from '../../ui/Toggle.svelte';
  import { SimController } from '../../sim/controller.svelte';
  import { useParams, usePalette } from '../../sim/setup.svelte';
  import { View } from '../../sim/view';
  import type { SimEntry } from '../../app/registry';
  import type { NumberParamDef } from '../../sim/params.svelte';
  import type { SimInfo } from '../../sim/types';
  import { stringFreq, stringShape, stringNodes } from '../../physics/standing';
  import { playTone } from '../../sim/tone';
  import { drawTag } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [
    { key: 'n', label: 'Harmonic', symbol: 'n', unit: '', min: 1, max: 8, step: 1 },
    { key: 'L', label: 'Length of the string', symbol: 'L', unit: 'm', min: 0.3, max: 2, step: 0.01 },
    { key: 'T', label: 'Tension', symbol: 'T', unit: 'N', min: 10, max: 300, step: 1 },
    { key: 'mu', label: 'Linear density', symbol: 'μ', unit: 'g m⁻¹', min: 0.5, max: 20, step: 0.1 },
  ];
  const { params, sl } = useParams({ n: 1, L: 0.65, T: 70, mu: 1.2, trav: false }, sliders);
  const presets = [
    { id: 'guitar', label: 'Guitar string (fundamental)', values: { n: 1, L: 0.65, T: 70, mu: 1.2 } },
    { id: 'third', label: 'Third harmonic', values: { n: 3, L: 0.65, T: 70, mu: 1.2 } },
    { id: 'trav', label: 'Two travelling waves make a standing wave', values: { n: 2, trav: true } },
  ];
  const info: SimInfo = {
    about: [
      'A wave on a string reflects at both fixed ends. The waves travelling in opposite directions superpose to give a standing wave: some points (nodes) never move, others (antinodes) oscillate with the largest amplitude. Energy is not transferred along the string.',
      'Only certain wavelengths fit: there must be a node at each fixed end, so a whole number of half-wavelengths fits on the string, L = nλ/2. The frequencies are f_n = nv/2L: the fundamental (first harmonic) and its whole-number multiples.',
      'All points between two neighbouring nodes move in phase; points on either side of a node move in antiphase. The speed of the waves is set by the tension and the mass per metre of the string.',
    ],
    formulas: [
      { label: 'Wave speed', tex: 'v = f\\lambda' },
      { label: 'Harmonics of a string fixed at both ends', tex: 'L = \\dfrac{n\\lambda}{2}, \\qquad f_n = \\dfrac{nv}{2L}', beyond: true },
      { label: 'Speed of waves on a string', tex: 'v = \\sqrt{\\dfrac{T}{\\mu}}', beyond: true },
    ],
    assumptions: [
      'Ideal flexible string, fixed at both ends, small amplitude, no damping.',
      'The motion is shown slowed down so that each oscillation takes about 1 s; the sound button plays the real frequency.',
      'Guitar preset: a typical steel string (0.65 m, 70 N, 1.2 g m⁻¹).',
    ],
    tryThis: [
      'Count the nodes and antinodes for n = 1, 2, 3. What is the rule?',
      'Quadruple the tension. What happens to the frequency?',
      'Show the two travelling waves: where do they always cancel?',
    ],
  };

  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;
  let t = 0;
  const N = () => Math.round(params.n);
  const v = () => Math.sqrt(params.T / (params.mu * 1e-3));
  const VIS = 1; // visual oscillation frequency [Hz]

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const usable = view.height - 76;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, view.height);
    const x0 = 50;
    const x1 = W > 760 ? W - 280 : W - 30;
    const y0 = usable * 0.45;
    const amp = Math.min(70, usable * 0.22);
    const n = N();
    const ph = 2 * Math.PI * VIS * t;
    const L = params.L;
    const X = (x: number) => x0 + (x / L) * (x1 - x0);
    // envelope
    ctx.strokeStyle = pal.gridStrong;
    ctx.setLineDash([3, 4]);
    for (const s of [1, -1]) {
      ctx.beginPath();
      for (let i = 0; i <= 200; i++) {
        const x = (L * i) / 200;
        const y = y0 - s * amp * stringShape(n, x, L);
        if (i === 0) ctx.moveTo(X(x), y);
        else ctx.lineTo(X(x), y);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
    if (params.trav) {
      // A sin(ωt − kx) + A sin(ωt + kx) = 2A sin(kx)… with fixed ends: use cos form shifted so nodes are at the ends
      const k = (n * Math.PI) / L;
      const waves = [
        (x: number) => 0.5 * Math.cos(ph - k * x),
        (x: number) => -0.5 * Math.cos(ph + k * x),
      ];
      waves.forEach((f, i) => {
        ctx!.strokeStyle = pal.series[i === 0 ? 1 : 2];
        ctx!.lineWidth = 1.5;
        ctx!.beginPath();
        for (let j = 0; j <= 300; j++) {
          const x = (L * j) / 300;
          const y = y0 - amp * f(x);
          if (j === 0) ctx!.moveTo(X(x), y);
          else ctx!.lineTo(X(x), y);
        }
        ctx!.stroke();
      });
    }
    // the string: sum of the two = sin(kx) sin(ωt)
    ctx.strokeStyle = pal.series[0];
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i <= 300; i++) {
      const x = (L * i) / 300;
      const y = y0 - amp * stringShape(n, x, L) * Math.sin(ph);
      if (i === 0) ctx.moveTo(X(x), y);
      else ctx.lineTo(X(x), y);
    }
    ctx.stroke();
    ctx.lineWidth = 1;
    // supports
    ctx.fillStyle = pal.text3;
    ctx.fillRect(x0 - 10, y0 - 50, 10, 100);
    ctx.fillRect(x1, y0 - 50, 10, 100);
    // nodes and antinodes
    for (const x of stringNodes(n, L)) drawTag(ctx, X(x), y0 + amp + 26, 'N', pal.text2, pal.surface);
    for (let m = 0; m < n; m++) drawTag(ctx, X(((m + 0.5) * L) / n), y0 + amp + 26, 'A', pal.series[3], pal.surface);
    // λ marker
    const lam = (2 * L) / n;
    ctx.strokeStyle = pal.text2;
    ctx.beginPath();
    ctx.moveTo(X(0), y0 - amp - 30);
    ctx.lineTo(X(Math.min(lam, L)), y0 - amp - 30);
    ctx.stroke();
    drawTag(ctx, X(Math.min(lam, L) / 2), y0 - amp - 30, lam <= L ? `λ = ${fmt(lam, 3)} m` : `λ/2 = L`, pal.text2, pal.surface);
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
    const vv = v();
    return [
      { label: 'wave speed v = √(T/μ)', value: fmt(vv, 4), unit: 'm s⁻¹' },
      { label: `frequency f${N()} = nv/2L`, value: fmt(stringFreq(N(), params.L, vv), 4), unit: 'Hz', strong: true },
      { label: 'fundamental f₁', value: fmt(stringFreq(1, params.L, vv), 4), unit: 'Hz' },
      { label: 'wavelength λ = 2L/n', value: fmt((2 * params.L) / N(), 4), unit: 'm' },
      { label: 'nodes / antinodes', value: `${N() + 1} / ${N()}` },
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
      label="Standing wave on a string with nodes and antinodes"
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
      <Slider def={sl('n')} bind:value={params.n} />
      <Slider def={sl('L')} bind:value={params.L} />
      <Slider def={sl('T')} bind:value={params.T} />
      <Slider def={sl('mu')} bind:value={params.mu} />
      <Toggle label="Show the two travelling waves" bind:checked={params.trav} />
      <button type="button" class="play" onclick={() => playTone(stringFreq(N(), params.L, v()))}>Play the note</button>
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

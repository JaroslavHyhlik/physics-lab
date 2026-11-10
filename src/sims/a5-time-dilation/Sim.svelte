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
  import type { SimEntry } from '../../app/registry';
  import type { NumberParamDef } from '../../sim/params.svelte';
  import type { SimInfo, GraphDef } from '../../sim/types';
  import type { ChannelDef } from '../../core/recorder';
  import { gamma, muonSurvival, sampleLifetimes } from '../../physics/relativity';
  import { Rng } from '../../core/rng';
  import { c } from '../../core/constants';
  import { alpha } from '../../sim/palette';
  import { drawTag } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [
    { key: 'beta', label: 'Speed of the moving clock', symbol: 'v/c', unit: '', min: 0, max: 0.99, step: 0.01 },
    { key: 'mbeta', label: 'Muon speed', symbol: 'v/c', unit: '', min: 0.9, max: 0.9999, step: 0.0001, decimals: 4 },
    { key: 'L', label: 'Height where muons are made', symbol: 'h', unit: 'km', min: 1, max: 20, step: 0.5 },
  ];
  const { params, sl } = useParams({ mode: 'clock', beta: 0.6, mbeta: 0.995, L: 10 }, sliders);
  const presets = [
    { id: 'clock', label: 'Light clock at 0.6c (γ = 1.25)', values: { mode: 'clock', beta: 0.6 } },
    { id: 'fast', label: 'Light clock at 0.9c', values: { mode: 'clock', beta: 0.9 } },
    { id: 'muon', label: 'Muons from 10 km at 0.995c', values: { mode: 'muon', mbeta: 0.995, L: 10 } },
  ];
  const channels: ChannelDef[] = [
    { key: 't', label: 't', unit: 's' },
    { key: 'p', label: 'ticks of the clock at rest', unit: '', color: '--series-1' },
    { key: 'm', label: 'ticks of the moving clock (seen from S)', unit: '', color: '--series-2' },
    { key: 'nr', label: 'muons left (with time dilation)', unit: '', color: '--series-1' },
    { key: 'nc', label: 'muons left (classical)', unit: '', color: '--series-4' },
  ];
  const graphs: GraphDef[] = $derived(
    params.mode === 'clock'
      ? [{ id: 'ticks', title: 'Number of ticks', series: ['p', 'm'] }]
      : [{ id: 'muons', title: 'Muons left (6 s of animation = whole flight)', series: ['nr', 'nc'] }],
  );
  const info: SimInfo = {
    about: [
      'A light clock ticks each time a light pulse travels between two mirrors and back. In its own rest frame the light goes straight up and down: one tick takes Δt₀ = 2d/c. This is the proper time.',
      'Seen by an observer the clock moves past at speed v, the light must travel a longer, diagonal path. Since the speed of light is the same, c, for every observer, each tick takes longer: Δt = γΔt₀. Moving clocks run slow.',
      'Muons made by cosmic rays high in the atmosphere live (half-life) only about 1.56 μs in their own frame. Even at almost c they would travel only about 470 m per half-life, so hardly any should reach the ground — yet many do. From the ground their clocks run slow by γ; from the muon’s point of view, the atmosphere is length-contracted. Both give the same number of survivors.',
    ],
    formulas: [
      { label: 'Time dilation', tex: '\\Delta t = \\gamma\\,\\Delta t_0', hl: true },
      { label: 'Lorentz factor', tex: '\\gamma = \\dfrac{1}{\\sqrt{1 - \\dfrac{v^{2}}{c^{2}}}}', hl: true },
      { label: 'Length contraction (muon frame)', tex: 'L = \\dfrac{L_0}{\\gamma}', hl: true },
      { label: 'Light clock period (rest frame)', tex: '\\Delta t_0 = \\dfrac{2d}{c}', beyond: true },
      { label: 'Fraction surviving', tex: 'N = N_0\\left(\\tfrac{1}{2}\\right)^{t/T_{1/2}}', beyond: true },
    ],
    assumptions: [
      'Light clock: ideal mirrors; the animation shows light slowed down enormously (the clock is drawn, not to scale in time).',
      'Muons: half-life 1.56 μs in the muon’s rest frame; they travel straight down at constant speed; no energy loss in the air.',
      'Decay times are random (seeded); the counts fluctuate around the formula, as in a real experiment.',
    ],
    tryThis: [
      'At 0.6c, count 4 ticks of the moving clock: how many ticks has the clock at rest made?',
      'For muons at 0.995c from 10 km, compare the classical and relativistic predictions with the animation.',
      'Find the speed at which half the muons reach the ground.',
    ],
  };

  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;
  let t = 0;
  const N = 240;
  const rng = new Rng(7);
  let life = sampleLifetimes(N, 1.56e-6, rng);
  const xs = Float64Array.from({ length: N }, () => rng.next());

  function drawClock(ctx: CanvasRenderingContext2D, W: number, H: number) {
    const pal = palette.pal;
    const usable = H - 76;
    const d = Math.min(usable * 0.55, 220);
    const top = (usable - d) / 2 + 10;
    const b = params.beta;
    const g = gamma(b);
    const speed = d / 1.2; // light speed in px per (animation) second
    // proper clock (left)
    const lx = W * 0.18;
    const tp = (t * speed) % (2 * d);
    const yProper = tp < d ? tp : 2 * d - tp;
    const mirror = (x: number, y: number) => {
      ctx.fillStyle = pal.text2;
      ctx.fillRect(x - 30, y - 3, 60, 6);
    };
    mirror(lx, top);
    mirror(lx, top + d);
    ctx.fillStyle = pal.hl;
    ctx.beginPath();
    ctx.arc(lx, top + d - yProper, 6, 0, Math.PI * 2);
    ctx.fill();
    // moving clock (right), seen from S
    const x0 = W * 0.36;
    const span = W * 0.6;
    const vpx = b * speed;
    const vy = Math.sqrt(1 - b * b) * speed; // vertical component, |light velocity| = c
    const xClock = x0 + ((vpx * t) % Math.max(span, 1));
    const tm = (t * vy) % (2 * d);
    const yMove = tm < d ? tm : 2 * d - tm;
    // light path (zig-zag) since the clock entered the view
    ctx.strokeStyle = alpha(pal.hl.startsWith('#') ? pal.hl : '#f59e0b', 0.6);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const steps = 160;
    const tStart = Math.max(0, t - (xClock - x0) / Math.max(vpx, 1e-9));
    for (let i = 0; i <= steps; i++) {
      const ti = tStart + ((t - tStart) * i) / steps;
      const yy = (ti * vy) % (2 * d);
      const yv = yy < d ? yy : 2 * d - yy;
      const xx = xClock - vpx * (t - ti);
      if (i === 0) ctx.moveTo(xx, top + d - yv);
      else ctx.lineTo(xx, top + d - yv);
    }
    ctx.stroke();
    mirror(xClock, top);
    mirror(xClock, top + d);
    ctx.fillStyle = pal.hl;
    ctx.beginPath();
    ctx.arc(xClock, top + d - yMove, 6, 0, Math.PI * 2);
    ctx.fill();
    const ticksP = Math.floor((t * speed) / (2 * d));
    const ticksM = Math.floor((t * vy) / (2 * d));
    drawTag(ctx, lx, top + d + 26, `at rest: ${ticksP} tick(s)`, pal.series[0], pal.surface);
    drawTag(ctx, Math.min(xClock, W - 120), top + d + 26, `moving at ${b.toFixed(2)}c: ${ticksM} tick(s)`, pal.series[1], pal.surface);
    drawTag(ctx, W / 2, top - 22, `γ = ${g.toFixed(3)}: the moving clock ticks ${g.toFixed(3)}× more slowly`, pal.ink, pal.surface);
  }

  const alive = [0, 0];
  function countAlive(tg: number, out: number[]) {
    const g = gamma(params.mbeta);
    out[0] = 0;
    out[1] = 0;
    for (let i = 0; i < N; i++) {
      if (g * life[i] >= tg) out[0]++;
      if (life[i] >= tg) out[1]++;
    }
  }
  const tGroundAt = (tt: number) => {
    const tFlight = (params.L * 1000) / (params.mbeta * c);
    return Math.min((tt / 6) * tFlight, tFlight);
  };

  function drawMuons(ctx: CanvasRenderingContext2D, W: number, H: number) {
    const pal = palette.pal;
    const usable = H - 76;
    const b = params.mbeta;
    const g = gamma(b);
    const L = params.L * 1000;
    const tFlight = L / (b * c);
    // animation: the whole flight lasts 6 s of real time
    const tg = tGroundAt(t);
    const top = 40;
    const ground = usable - 20;
    const y = top + ((ground - top) * tg) / tFlight;
    ctx.fillStyle = alpha(pal.dark ? '#2a3a2a' : '#9ccf8a', 0.5);
    ctx.fillRect(0, ground, W, H - ground);
    const cols = [
      { x0: W * 0.08, w: W * 0.36, rel: true, label: 'with time dilation' },
      { x0: W * 0.52, w: W * 0.36, rel: false, label: 'classical' },
    ];
    // production height
    ctx.strokeStyle = pal.gridStrong;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(0, top);
    ctx.lineTo(W, top);
    ctx.stroke();
    ctx.setLineDash([]);
    countAlive(tg, alive);
    cols.forEach((col, k) => {
      for (let i = 0; i < N; i++) {
        const death = col.rel ? g * life[i] : life[i]; // ground-frame lifetime
        if (death < tg) continue;
        ctx.fillStyle = col.rel ? pal.series[0] : pal.series[3];
        ctx.beginPath();
        ctx.arc(col.x0 + xs[i] * col.w, y + ((i % 7) - 3) * 3, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      drawTag(ctx, col.x0 + col.w / 2, ground + 18, `${col.label}: ${alive[k]} of ${N} left`, col.rel ? pal.series[0] : pal.series[3], pal.surface);
    });
    ctx.fillStyle = pal.text3;
    ctx.textAlign = 'left';
    ctx.font = '500 10px Inter Variable, system-ui, sans-serif';
    ctx.fillText(`muons made here, ${fmt(params.L, 3)} km`, 70, top - 6);
    ctx.fillText('ground', 6, ground - 6);
  }

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        t += dt;
        if (params.mode === 'muon' && t > 6.5) ctrl.pause();
        if (params.mode === 'clock' && t > 60) ctrl.pause();
      },
      render: () => {
        if (!ctx) return;
        ctx.fillStyle = palette.pal.bg;
        ctx.fillRect(0, 0, view.width, view.height);
        if (params.mode === 'clock') drawClock(ctx, view.width, view.height);
        else drawMuons(ctx, view.width, view.height);
      },
      sample: (tt, out) => {
        const d = 1;
        out[0] = tt;
        out[1] = Math.floor((tt / 1.2) / (2 * d));
        out[2] = Math.floor(((tt / 1.2) * Math.sqrt(1 - params.beta ** 2)) / (2 * d));
        if (params.mode === 'muon') {
          countAlive(tGroundAt(tt), alive);
          out[1] = NaN;
          out[2] = NaN;
          out[3] = alive[0];
          out[4] = alive[1];
        } else {
          out[3] = NaN;
          out[4] = NaN;
        }
      },
      reset: () => {
        t = 0;
        life = sampleLifetimes(N, 1.56e-6, new Rng(7));
      },
    },
    { dt: 1e-3, channels, sampleInterval: 1 / 30, autoplay: true },
  );
  const palette = usePalette(() => ctrl);
  resetOn(ctrl, () => [params.mode, params.beta, params.mbeta, params.L]);
  $effect(() => {
    void [params.mode, params.beta, params.mbeta, params.L];
    if (ctx) ctrl.play();
  });

  const rows = $derived.by(() => {
    void ctrl.renderCount;
    if (params.mode === 'clock') {
      const g = gamma(params.beta);
      return [
        { label: 'γ', value: g.toFixed(4), strong: true },
        { label: 'tick at rest Δt₀', value: '1', unit: 'unit' },
        { label: 'moving tick Δt = γΔt₀', value: g.toFixed(4), unit: 'units' },
      ];
    }
    const r = muonSurvival(params.L * 1000, params.mbeta, 1.56e-6);
    const g = gamma(params.mbeta);
    return [
      { label: 'γ', value: g.toFixed(3) },
      { label: 'flight time (ground)', value: fmt(r.tGround * 1e6, 3), unit: 'μs' },
      { label: 'muon’s own time t/γ', value: fmt(r.tProper * 1e6, 3), unit: 'μs' },
      { label: 'survive (relativity)', value: `${(100 * r.relativistic).toFixed(1)} %`, color: '--series-1', strong: true },
      { label: 'survive (classical)', value: `${(100 * r.classical).toPrecision(2)} %`, color: '--series-4' },
      { label: 'atmosphere seen by muon L₀/γ', value: fmt((params.L * 1000) / g, 3), unit: 'm' },
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
  initialGraphs={['ticks']}
  {presets}
  onpreset={(id) => Object.assign(params, presets.find((p) => p.id === id)?.values ?? {})}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      label="Time dilation: light clock and muons"
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
        label="Experiment"
        bind:value={params.mode}
        options={[
          { value: 'clock', label: 'Light clock' },
          { value: 'muon', label: 'Muons' },
        ]}
      />
      {#if params.mode === 'clock'}
        <Slider def={sl('beta')} bind:value={params.beta} />
      {:else}
        <Slider def={sl('mbeta')} bind:value={params.mbeta} />
        <Slider def={sl('L')} bind:value={params.L} />
      {/if}
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

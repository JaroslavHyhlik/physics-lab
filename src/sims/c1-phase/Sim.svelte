<script lang="ts">
  import { onMount } from 'svelte';
  import SimShell from '../../sim/SimShell.svelte';
  import SimCanvas from '../../sim/SimCanvas.svelte';
  import Readouts from '../../sim/Readouts.svelte';
  import Slider from '../../ui/Slider.svelte';
  import Toggle from '../../ui/Toggle.svelte';
  import { SimController } from '../../sim/controller.svelte';
  import { useParams, usePalette, resetOn } from '../../sim/setup.svelte';
  import { View } from '../../sim/view';
  import type { SimEntry } from '../../app/registry';
  import type { NumberParamDef } from '../../sim/params.svelte';
  import type { SimInfo, GraphDef } from '../../sim/types';
  import type { ChannelDef } from '../../core/recorder';
  import { shm, wrapPhase } from '../../physics/oscillator';
  import { drawArrow, drawTag } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [
    { key: 'f', label: 'Frequency', symbol: 'f', unit: 'Hz', min: 0.1, max: 1.5, step: 0.01 },
    { key: 'A1', label: 'Amplitude of A', symbol: 'x_0', unit: 'cm', min: 1, max: 10, step: 0.5 },
    { key: 'A2', label: 'Amplitude of B', symbol: 'x_0', unit: 'cm', min: 1, max: 10, step: 0.5 },
    { key: 'p1', label: 'Phase constant of A', symbol: 'φ_A', unit: '°', min: -180, max: 180, step: 5 },
    { key: 'p2', label: 'Phase constant of B', symbol: 'φ_B', unit: '°', min: -180, max: 180, step: 5 },
  ];
  const { params, sl } = useParams({ f: 0.4, A1: 8, A2: 6, p1: 0, p2: 90, va: false }, sliders);
  const presets = [
    { id: 'quarter', label: 'B a quarter cycle ahead (π/2)', values: { p1: 0, p2: 90, A1: 8, A2: 8 } },
    { id: 'anti', label: 'In antiphase (π)', values: { p1: 0, p2: 180, A1: 8, A2: 8 } },
    { id: 'in', label: 'In phase, different amplitudes', values: { p1: 0, p2: 0, A1: 8, A2: 4 } },
    { id: 'va', label: 'x, v and a phasors of one oscillator', values: { p1: 0, p2: 0, A1: 8, A2: 8, va: true } },
  ];
  const channels: ChannelDef[] = [
    { key: 't', label: 't', unit: 's' },
    { key: 'xa', label: 'x of A', unit: 'cm', color: '--series-1' },
    { key: 'xb', label: 'x of B', unit: 'cm', color: '--series-2' },
    { key: 'va', label: 'v of A', unit: 'cm s⁻¹', color: '--series-3' },
    { key: 'aa', label: 'a of A', unit: 'cm s⁻²', color: '--series-4' },
  ];
  const graphs: GraphDef[] = [
    { id: 'x', title: 'Displacement of A and B', series: ['xa', 'xb'] },
    { id: 'v', title: 'Velocity of A', series: ['va'] },
    { id: 'a', title: 'Acceleration of A', series: ['aa'] },
  ];
  const info: SimInfo = {
    about: [
      'Imagine a point moving round a circle at a steady angular speed ω. Its shadow on a vertical line moves up and down in simple harmonic motion: x = x₀ sin(ωt + φ). The rotating radius is called a phasor; the circle is the reference circle.',
      'The phase constant φ says where on the circle the motion starts. Two oscillators with the same frequency keep a constant phase difference Δφ: in phase (Δφ = 0) they move together, in antiphase (Δφ = π) they always move opposite ways. A phase difference Δφ means one is ahead by a fraction Δφ/2π of a period.',
      'The velocity phasor is a quarter of a turn (π/2) ahead of the displacement, and the acceleration phasor is half a turn (π) ahead — always opposite to x, which is the definition of SHM: a = −ω²x.',
    ],
    formulas: [
      { label: 'Displacement', tex: 'x = x_0\\sin(\\omega t + \\phi)', hl: true },
      { label: 'Velocity', tex: 'v = \\omega x_0\\cos(\\omega t + \\phi)', hl: true },
      { label: 'Speed at displacement x', tex: 'v = \\pm\\,\\omega\\sqrt{x_0^{2} - x^{2}}', hl: true },
      { label: 'Kinetic energy', tex: 'E_k = \\tfrac{1}{2}m\\omega^{2}(x_0^{2} - x^{2})', hl: true },
      { label: 'Angular frequency', tex: '\\omega = 2\\pi f = \\dfrac{2\\pi}{T}' },
    ],
    assumptions: ['Both oscillators are ideal (undamped) and have the same frequency.', 'Phasor lengths: x in cm; the v and a phasors are scaled to fit (not to scale with each other).'],
    tryThis: [
      'Set B to be a quarter of a cycle ahead of A. Where is B when A is at maximum displacement?',
      'Show the v and a phasors: why is the acceleration always opposite to the displacement?',
      'Read the time between the peaks of A and B on the graph and compare with Δφ/ω.',
    ],
  };

  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;
  let t = 0;
  const w = () => 2 * Math.PI * params.f;
  const rad = (d: number) => (d * Math.PI) / 180;

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const usable = view.height - 76;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, view.height);
    const R = Math.min(usable * 0.4, (W > 760 ? W - 280 : W) * 0.22);
    const cx = R + 50;
    const cy = usable / 2 + 10;
    const sc = R / 10; // px per cm
    ctx.strokeStyle = pal.gridStrong;
    ctx.beginPath();
    ctx.arc(cx, cy, 10 * sc, 0, Math.PI * 2);
    ctx.moveTo(cx - R - 10, cy);
    ctx.lineTo(cx + R + 10, cy);
    ctx.moveTo(cx, cy - R - 10);
    ctx.lineTo(cx, cy + R + 10);
    ctx.stroke();
    const om = w();
    const osc = [
      { A: params.A1, p: rad(params.p1), col: pal.series[0], name: 'A' },
      { A: params.A2, p: rad(params.p2), col: pal.series[1], name: 'B' },
    ];
    const lineX = cx + R + 70; // the vertical line where the shadows move
    const lineX2 = lineX + 70;
    osc.forEach((o, k) => {
      const th = om * t + o.p;
      const px = cx + Math.cos(th) * o.A * sc;
      const py = cy - Math.sin(th) * o.A * sc;
      drawArrow(ctx!, cx, cy, px, py, o.col, o.name, 2.5);
      // projection line to the moving mass
      const mx = k === 0 ? lineX : lineX2;
      ctx!.strokeStyle = o.col;
      ctx!.setLineDash([3, 4]);
      ctx!.beginPath();
      ctx!.moveTo(px, py);
      ctx!.lineTo(mx, py);
      ctx!.stroke();
      ctx!.setLineDash([]);
      ctx!.fillStyle = o.col;
      ctx!.fillRect(mx - 12, py - 12, 24, 24);
      ctx!.strokeStyle = pal.gridStrong;
      ctx!.beginPath();
      ctx!.moveTo(mx, cy - R - 10);
      ctx!.lineTo(mx, cy + R + 10);
      ctx!.stroke();
    });
    if (params.va) {
      const th = om * t + osc[0].p;
      const L = 10 * sc;
      drawArrow(ctx, cx, cy, cx + Math.cos(th + Math.PI / 2) * L * 0.8, cy - Math.sin(th + Math.PI / 2) * L * 0.8, pal.series[2], 'v', 2);
      drawArrow(ctx, cx, cy, cx + Math.cos(th + Math.PI) * L * 0.6, cy - Math.sin(th + Math.PI) * L * 0.6, pal.series[3], 'a', 2);
    }
    // phase difference arc
    const dphi = wrapPhase(rad(params.p2) - rad(params.p1));
    const th1 = om * t + rad(params.p1);
    ctx.strokeStyle = pal.text2;
    ctx.beginPath();
    ctx.arc(cx, cy, 22, -th1, -(th1 + dphi), dphi > 0);
    ctx.stroke();
    drawTag(ctx, cx, cy + R + 28, `Δφ = ${fmt(dphi, 3)} rad = ${((dphi * 180) / Math.PI).toFixed(0)}°`, pal.ink, pal.surface);
    ctx.fillStyle = pal.text3;
    ctx.font = '500 10px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('reference circle', cx, 8);
    ctx.fillText('A', lineX, cy + R + 14);
    ctx.fillText('B', lineX2, cy + R + 14);
  }

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        t += dt;
      },
      render: draw,
      sample: (tt, out) => {
        const a = shm(params.A1, w(), rad(params.p1), tt);
        const b = shm(params.A2, w(), rad(params.p2), tt);
        out[0] = tt;
        out[1] = a.x;
        out[2] = b.x;
        out[3] = a.v;
        out[4] = a.a;
      },
      reset: () => {
        t = 0;
      },
    },
    { dt: 1 / 240, channels, sampleInterval: 1 / 60, autoplay: true },
  );
  const palette = usePalette(() => ctrl);
  resetOn(ctrl, () => [params.f, params.A1, params.A2, params.p1, params.p2]);

  const rows = $derived.by(() => {
    void ctrl.renderCount;
    const a = shm(params.A1, w(), rad(params.p1), t);
    const dphi = wrapPhase(rad(params.p2) - rad(params.p1));
    return [
      { label: 'ω = 2πf', value: fmt(w(), 4), unit: 'rad s⁻¹' },
      { label: 'Δφ (B ahead of A)', value: `${fmt(dphi, 3)} rad`, strong: true },
      { label: 'time shift Δφ/ω', value: fmt(dphi / w(), 3), unit: 's' },
      { label: 'A: x, v', value: `${fmt(a.x, 3)} cm, ${fmt(a.v, 3)} cm s⁻¹` },
      { label: 'A: ω√(x₀² − x²)', value: fmt(w() * Math.sqrt(Math.max(0, params.A1 ** 2 - a.x ** 2)), 3), unit: 'cm s⁻¹' },
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
  initialGraphs={['x', 'v']}
  {presets}
  onpreset={(id) => Object.assign(params, presets.find((q) => q.id === id)?.values ?? {})}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      label="Reference circle with two phasors and their SHM projections"
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
      <Slider def={sl('f')} bind:value={params.f} />
      <Slider def={sl('A1')} bind:value={params.A1} />
      <Slider def={sl('p1')} bind:value={params.p1} />
      <Slider def={sl('A2')} bind:value={params.A2} />
      <Slider def={sl('p2')} bind:value={params.p2} />
      <Toggle label="Show velocity and acceleration phasors of A" bind:checked={params.va} />
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

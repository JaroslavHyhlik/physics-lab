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
  import { A_SUN, OneZoneStar, smallOscillationOmega2 } from '../../physics/stellarEquilibrium';
  import { alpha } from '../../sim/palette';
  import { drawArrow, drawTag } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [
    { key: 'squeeze', label: 'Disturbance: change of radius at the start', symbol: '', unit: '%', min: -30, max: 30, step: 1 },
    { key: 'gamma', label: 'Adiabatic index of the gas', symbol: 'γ', unit: '', min: 1.2, max: 1.8, step: 0.01 },
  ];
  const { params, sl } = useParams({ squeeze: -10, gamma: 1.67 }, sliders);
  const presets = [
    { id: 'eq', label: 'In equilibrium: nothing happens', values: { squeeze: 0, gamma: 1.67 } },
    { id: 'squeeze', label: 'Squeeze the Sun by 10 %', values: { squeeze: -10, gamma: 1.67 } },
    { id: 'expand', label: 'Expand it by 20 %', values: { squeeze: 20, gamma: 1.67 } },
    { id: 'rad', label: 'Radiation pressure dominates (γ near 4/3)', values: { squeeze: -5, gamma: 1.36 } },
    { id: 'unstable', label: 'γ below 4/3: unstable', values: { squeeze: -3, gamma: 1.3 } },
  ];
  const info: SimInfo = {
    about: [
      'A star is a huge ball of hot gas. Gravity pulls every layer inwards. The pressure of the hot gas (and of the radiation) pushes outwards. In a stable star the two balance: hydrostatic equilibrium.',
      'Squeeze the star and the gas is compressed, so its pressure rises faster than gravity does: the star is pushed back out, overshoots, and oscillates about its equilibrium size. Let it expand and the pressure falls faster than gravity, so it is pulled back.',
      'This works only if the pressure rises steeply enough when the gas is compressed. For an ideal monatomic gas γ = 5/3 and the star is stable. In very massive stars radiation pressure dominates, γ approaches 4/3, and the star becomes barely stable. Below 4/3 a small squeeze makes it collapse.',
      'The energy released by fusion in the core keeps the gas hot, so the pressure can hold the star up for billions of years.',
    ],
    formulas: [
      { label: 'Equilibrium (per unit mass of the outer layer)', tex: '\\dfrac{GM}{R^{2}} \\;=\\; \\text{push from the pressure}', beyond: true },
      { label: 'One-zone model', tex: '\\ddot{x} = A\\left(x^{2-3\\gamma} - x^{-2}\\right),\\quad A = \\dfrac{GM}{R_0^{3}}', beyond: true },
      { label: 'Small oscillations', tex: '\\omega^{2} = A(3\\gamma - 4)', beyond: true },
    ],
    assumptions: [
      'Simplified one-zone model (beyond the syllabus): the whole star is described by its radius only; the gas is compressed and expanded adiabatically (no heat flow, no change in fusion rate).',
      'Mass and equilibrium radius of the Sun (1.99 × 10³⁰ kg, 6.96 × 10⁸ m). Integrated with velocity Verlet (energy conserved). One hour of the star’s time takes 1 s of animation.',
      'The arrows show the inward pull of gravity and the outward push of the pressure on the surface layer; their lengths are relative, not to scale. Real stars pulsate in more complicated ways.',
    ],
    tryThis: [
      'Squeeze the star by 10 %. Which arrow wins at first? Why does the star overshoot?',
      'Measure the period of the oscillation on the graph and compare with 2π/ω.',
      'Lower γ towards 4/3. What happens to the period? What happens below 4/3?',
    ],
  };
  const channels: ChannelDef[] = [
    { key: 't', label: 't', unit: 'h' },
    { key: 'x', label: 'radius R/R₀', unit: '', color: '--series-1' },
  ];
  const graphs: GraphDef[] = [{ id: 'x', title: 'Radius of the star (R/R₀)', series: ['x'] }];

  const SPEED = 3600; // star seconds per animation second
  let star = new OneZoneStar(1 + params.squeeze / 100, params.gamma);
  let status = $state('');

  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const H = view.height;
    const usable = H - 76;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    const wide = W > 760;
    const areaW = wide ? W - 300 : W;
    const cx = areaW / 2;
    const cy = usable / 2;
    const R0 = Math.min(areaW, usable) * 0.24;
    // equilibrium radius
    ctx.strokeStyle = pal.gridStrong;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(cx, cy, R0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // star: brighter when compressed (the gas heats up)
    const r = Math.max(2, star.x * R0);
    const heat = Math.max(0.3, Math.min(1, star.x ** (-3 * (params.gamma - 1)) * 0.7));
    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    const core = pal.hl.startsWith('#') ? pal.hl : '#f59e0b';
    grd.addColorStop(0, alpha('#fff4d6', heat));
    grd.addColorStop(0.5, alpha(core, 0.4 + 0.6 * heat));
    grd.addColorStop(1, alpha(core, 0.5));
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    // arrows on the surface layer
    const f = star.forces();
    const k = 55;
    for (const ang of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
      const ux = Math.cos(ang);
      const uy = Math.sin(ang);
      const sx = cx + ux * r;
      const sy = cy + uy * r;
      const off = 10;
      const px = -uy * off;
      const py = ux * off;
      drawArrow(ctx, sx + px, sy + py, sx + px + ux * Math.min(160, k * f.out), sy + py + uy * Math.min(160, k * f.out), pal.series[0], undefined, 2.5);
      drawArrow(ctx, sx - px, sy - py, sx - px - ux * Math.min(r, k * f.in), sy - py - uy * Math.min(r, k * f.in), pal.series[3], undefined, 2.5);
    }
    ctx.fillStyle = pal.text2;
    ctx.font = '600 11px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = pal.series[0];
    ctx.fillText('→ outward push of the pressure', 12, 12);
    ctx.fillStyle = pal.series[3];
    ctx.fillText('→ inward pull of gravity', 12, 28);
    ctx.fillStyle = pal.text3;
    ctx.fillText('dashed circle: equilibrium radius (not to scale)', 12, 44);
    if (status) drawTag(ctx, cx, usable - 20, status, pal.negative, pal.surface);
  }

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        const n = 4;
        for (let i = 0; i < n; i++) star.step((dt * SPEED) / n);
        if (star.x < 0.15) {
          status = 'collapse: gravity wins (γ < 4/3)';
          ctrl.pause();
        } else if (star.x > 4) {
          status = 'the star blows apart in this model';
          ctrl.pause();
        }
      },
      render: draw,
      sample: (_t, out) => {
        out[0] = star.t / 3600;
        out[1] = star.x;
      },
      reset: () => {
        star = new OneZoneStar(1 + params.squeeze / 100, params.gamma);
        status = '';
      },
    },
    { dt: 1 / 120, channels, sampleInterval: 1 / 30, autoplay: true },
  );
  const palette = usePalette(() => ctrl);
  resetOn(ctrl, () => [params.squeeze, params.gamma]);
  $effect(() => {
    void [params.squeeze, params.gamma];
    if (ctx) ctrl.play();
  });

  const rows = $derived.by(() => {
    void ctrl.renderCount;
    const w2 = smallOscillationOmega2(params.gamma, A_SUN);
    const f = star.forces();
    return [
      { label: 'radius R/R₀', value: star.x.toFixed(3), strong: true, color: '--series-1' },
      { label: 'pressure push ÷ gravity pull', value: fmt(f.out / f.in, 3) },
      { label: 'stability', value: params.gamma > 4 / 3 + 1e-9 ? 'stable (γ > 4/3)' : params.gamma < 4 / 3 - 1e-9 ? 'unstable (γ < 4/3)' : 'borderline' },
      { label: 'small-oscillation period 2π/ω', value: w2 > 0 ? fmt((2 * Math.PI) / Math.sqrt(w2) / 3600, 3) : '—', unit: w2 > 0 ? 'h' : undefined },
      { label: 'time', value: fmt(star.t / 3600, 3), unit: 'h' },
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
  initialGraphs={['x']}
  {presets}
  onpreset={(id) => Object.assign(params, presets.find((q) => q.id === id)?.values ?? {})}
  stopwatch={false}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      label="A star pulsating about its equilibrium size, with arrows for gravity and pressure"
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
      <Slider def={sl('squeeze')} bind:value={params.squeeze} />
      <Slider def={sl('gamma')} bind:value={params.gamma} />
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

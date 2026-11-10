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
  import { EnergyBalance, equilibriumT, YEAR } from '../../physics/energyBalance';
  import { S_solar } from '../../core/constants';
  import { alpha } from '../../sim/palette';
  import { drawArrow, drawTag } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [
    { key: 'S', label: 'Solar constant (intensity at the planet)', symbol: 'S', unit: 'W m⁻²', min: 100, max: 3000, step: 10 },
    { key: 'a', label: 'Albedo', symbol: 'α', unit: '', min: 0, max: 0.95, step: 0.01 },
    { key: 'e', label: 'Emissivity', symbol: 'ε', unit: '', min: 0.005, max: 1, step: 0.001, log: true },
    { key: 'T0', label: 'Starting temperature', symbol: 'T_0', unit: 'K', min: 50, max: 800, step: 5 },
  ];
  const { params, sl } = useParams({ S: S_solar, a: 0.3, e: 0.61, T0: 255 }, sliders);
  const presets = [
    { id: 'earth', label: 'Earth with greenhouse effect (ε = 0.61)', values: { S: S_solar, a: 0.3, e: 0.61, T0: 255 } },
    { id: 'bare', label: 'Earth without greenhouse effect (ε = 1)', values: { S: S_solar, a: 0.3, e: 1, T0: 288 } },
    { id: 'snow', label: 'Earth covered in ice (α = 0.6)', values: { S: S_solar, a: 0.6, e: 0.61, T0: 288 } },
    { id: 'mars', label: 'Mars', values: { S: 586, a: 0.25, e: 1, T0: 250 } },
    { id: 'venus', label: 'Venus (very strong greenhouse effect)', values: { S: 2601, a: 0.77, e: 0.009, T0: 300 } },
  ];
  const C = 4.2e8; // J m⁻² K⁻¹: 100 m of ocean water
  const channels: ChannelDef[] = [
    { key: 't', label: 't', unit: 'years' },
    { key: 'T', label: 'temperature T', unit: 'K', color: '--series-4' },
    { key: 'Te', label: 'equilibrium temperature', unit: 'K', color: '--series-5', dash: [6, 4] },
    { key: 'in', label: 'absorbed (1 − α)S/4', unit: 'W m⁻²', color: '--series-3' },
    { key: 'out', label: 'emitted εσT⁴', unit: 'W m⁻²', color: '--series-4' },
  ];
  const graphs: GraphDef[] = [
    { id: 'T', title: 'Temperature', series: ['T', 'Te'] },
    { id: 'P', title: 'Power per square metre', series: ['in', 'out'] },
  ];
  const info: SimInfo = {
    about: [
      'A planet is warmed by sunlight and cools by emitting infrared radiation into space. Its temperature changes until the power absorbed equals the power emitted.',
      'The sunlight hitting the planet is caught by a disc of area πR², but the planet emits from its whole surface 4πR². So, averaged over the surface, each square metre receives S/4. A fraction α (the albedo) is reflected by clouds, ice and the ground.',
      'Each square metre emits εσT⁴. Greenhouse gases absorb much of the infrared from the surface and send part of it back down, so less escapes to space: the effective emissivity ε of the planet is smaller than 1, and the planet must be warmer to get rid of the same power.',
      'Balance: (1 − α)S/4 = εσT⁴, so T = [(1 − α)S/(4εσ)]^¼. Without greenhouse gases the Earth would be at about 255 K (−18 °C) instead of 288 K (15 °C).',
    ],
    formulas: [
      { label: 'Albedo', tex: '\\alpha = \\dfrac{\\text{total scattered power}}{\\text{total incident power}}' },
      { label: 'Emissivity', tex: '\\varepsilon = \\dfrac{\\text{power radiated per unit area}}{\\sigma T^{4}}' },
      { label: 'Balance per square metre', tex: '\\dfrac{(1-\\alpha)S}{4} = \\varepsilon\\sigma T^{4}', beyond: true },
      { label: 'Equilibrium temperature', tex: 'T = \\left[\\dfrac{(1-\\alpha)S}{4\\varepsilon\\sigma}\\right]^{1/4}', beyond: true },
    ],
    assumptions: [
      'The whole planet has one temperature (a “zero-dimensional” model): no day and night, no poles, no weather.',
      'ε is the effective emissivity of surface and atmosphere seen from space; the greenhouse effect is represented only by ε < 1.',
      'Heat capacity per m² of surface: 4.2 × 10⁸ J m⁻² K⁻¹ (the top 100 m of ocean). It only sets how fast the temperature changes, not where it ends.',
      'Planet data (NASA Planetary Fact Sheets): S = 1360 (booklet), 586 (Mars), 2601 (Venus) W m⁻²; Bond albedo 0.30, 0.25, 0.77; observed mean surface temperatures 288 K, 210 K, 737 K. The Venus ε is chosen so the model gives the observed temperature.',
      'Time is sped up; the graphs show years.',
    ],
    tryThis: [
      'Earth: what emissivity gives the observed 288 K? Compare with ε = 1.',
      'Increase the albedo (more ice). The colder planet would make even more ice — why is this a positive feedback?',
      'By how many kelvin does the Earth warm if ε falls from 0.61 to 0.60 (more greenhouse gases)?',
      'Venus is closer to the Sun but reflects 77 % of the light. Without its greenhouse effect (ε = 1) would it be hotter or colder than the Earth?',
    ],
  };

  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;
  const build = () => new EnergyBalance(params.S, params.a, params.e, C, params.T0);
  let pl = build();
  let ta = 0;
  const RUN = 20; // s of animation for 6 time constants
  const speedUp = () => (6 * pl.tau) / RUN;
  const Teq = () => equilibriumT(params.S, params.a, params.e);

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const usable = view.height - 76;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, view.height);
    const wide = W > 760;
    const R = Math.min(usable * 0.24, (wide ? W * 0.55 : W) * 0.18);
    const cx = (wide ? W * 0.55 : W) * 0.55;
    const cy = usable * 0.52;
    const sun = pal.hl;
    const ir = pal.series[3];
    // the Sun at the left edge
    const g = ctx.createRadialGradient(-40, cy, 10, -40, cy, 110);
    g.addColorStop(0, alpha(sun.startsWith('#') ? sun : '#f59e0b', 0.9));
    g.addColorStop(1, alpha(sun.startsWith('#') ? sun : '#f59e0b', 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, cy - 120, 80, 240);
    // incoming and reflected sunlight
    const k = (R * 1.2) / (S_solar / 4); // px per W m⁻²
    const inc = params.S / 4;
    const refl = params.a * inc;
    for (const dy of [-0.55, 0, 0.55]) {
      const y = cy + dy * R;
      const xs = cx - Math.sqrt(R * R - (dy * R) ** 2);
      drawArrow(ctx, xs - 20 - inc * k, y, xs - 4, y, sun, undefined, 3);
      if (refl > 1) drawArrow(ctx, xs - 8, y + 10, xs - 8 - refl * k, y + 10 + refl * k * 0.25, alpha(sun.startsWith('#') ? sun : '#f59e0b', 0.55), undefined, 2);
    }
    // atmosphere halo: thicker for a stronger greenhouse effect
    const halo = R * 0.25 * (1 - params.e);
    if (halo > 0.5) {
      ctx.fillStyle = alpha(pal.series[1].startsWith('#') ? pal.series[1] : '#f2711c', 0.15);
      ctx.beginPath();
      ctx.arc(cx, cy, R + halo + 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // planet, tinted by temperature
    const cold = pal.series[0].startsWith('#') ? pal.series[0] : '#3b82f6';
    const hotc = ir.startsWith('#') ? ir : '#e11d48';
    ctx.fillStyle = cold;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = alpha(hotc, Math.max(0, Math.min(0.9, (pl.T - 300) / 400)));
    ctx.fill();
    // ice/cloud cover drawn as a white cap that grows with the albedo
    ctx.save();
    ctx.clip();
    ctx.fillStyle = alpha('#ffffff', 0.75);
    const capH = R * 2 * Math.min(0.95, params.a) * 0.5;
    ctx.fillRect(cx - R, cy - R, 2 * R, capH);
    ctx.fillRect(cx - R, cy + R - capH, 2 * R, capH);
    ctx.restore();
    // emitted infrared, all around
    const out = pl.emitted();
    const len = Math.min(R * 1.4, out * k);
    for (let i = 0; i < 8; i++) {
      const th = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const x0 = cx + Math.cos(th) * (R + halo + 6);
      const y0 = cy + Math.sin(th) * (R + halo + 6);
      drawArrow(ctx, x0, y0, x0 + Math.cos(th) * len, y0 + Math.sin(th) * len, ir, undefined, 2);
    }
    drawTag(ctx, cx, cy, `${pl.T.toFixed(1)} K`, pal.ink, pal.surface);
    // power budget bars (per m²)
    const bx0 = wide ? W * 0.58 : 20;
    const bx1 = W - 24;
    const by0 = wide ? 180 : usable - 96;
    const rows: [string, number, string][] = [
      ['incoming S/4', inc, sun],
      ['reflected αS/4', refl, alpha(sun.startsWith('#') ? sun : '#f59e0b', 0.55)],
      ['absorbed (1 − α)S/4', inc - refl, pal.series[2]],
      ['emitted εσT⁴', out, ir],
    ];
    const maxP = Math.max(inc, out, 1);
    const lw = 128;
    rows.forEach(([lab, v, col], i) => {
      const y = by0 + i * 22;
      ctx!.fillStyle = pal.text2;
      ctx!.font = '600 11px Inter Variable, system-ui, sans-serif';
      ctx!.textAlign = 'left';
      ctx!.textBaseline = 'middle';
      ctx!.fillText(lab, bx0, y + 7);
      const w = ((bx1 - bx0 - lw - 70) * v) / maxP;
      ctx!.fillStyle = col;
      ctx!.fillRect(bx0 + lw, y, Math.max(0, w), 14);
      ctx!.fillStyle = pal.ink;
      ctx!.fillText(`${Math.round(v)} W m⁻²`, bx0 + lw + Math.max(0, w) + 6, y + 7);
    });
  }

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        ta += dt;
        pl.step(dt * speedUp());
        if (ta >= RUN) ctrl.pause();
      },
      render: draw,
      sample: (_t, out) => {
        out[0] = pl.t / YEAR;
        out[1] = pl.T;
        out[2] = Teq();
        out[3] = pl.absorbed;
        out[4] = pl.emitted();
      },
      reset: () => {
        pl = build();
        ta = 0;
      },
    },
    { dt: 1 / 120, channels, sampleInterval: 1 / 20, autoplay: true },
  );
  const palette = usePalette(() => ctrl);
  resetOn(ctrl, () => [params.S, params.a, params.e, params.T0]);
  $effect(() => {
    void [params.S, params.a, params.e, params.T0];
    if (ctx) ctrl.play();
  });

  const rows = $derived.by(() => {
    void ctrl.renderCount;
    const Te = Teq();
    return [
      { label: 'temperature T', value: `${pl.T.toFixed(1)} K (${(pl.T - 273).toFixed(1)} °C)`, color: '--series-4', strong: true },
      { label: 'equilibrium T', value: `${Te.toFixed(1)} K (${(Te - 273).toFixed(1)} °C)`, strong: true },
      { label: 'absorbed − emitted', value: fmt(pl.absorbed - pl.emitted(), 3), unit: 'W m⁻²' },
      { label: 'time', value: fmt(pl.t / YEAR, 3), unit: 'years' },
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
  initialGraphs={['T', 'P']}
  {presets}
  onpreset={(id) => Object.assign(params, presets.find((p) => p.id === id)?.values ?? {})}
  stopwatch={false}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      label="Planet warmed by sunlight and cooled by infrared radiation"
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
      <Slider def={sl('S')} bind:value={params.S} />
      <Slider def={sl('a')} bind:value={params.a} />
      <Slider def={sl('e')} bind:value={params.e} />
      <Slider def={sl('T0')} bind:value={params.T0} />
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

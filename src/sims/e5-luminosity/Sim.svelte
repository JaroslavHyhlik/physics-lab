<script lang="ts">
  import { onMount } from 'svelte';
  import SimShell from '../../sim/SimShell.svelte';
  import SimCanvas from '../../sim/SimCanvas.svelte';
  import Readouts from '../../sim/Readouts.svelte';
  import Slider from '../../ui/Slider.svelte';
  import { SimController } from '../../sim/controller.svelte';
  import { useParams, usePalette, redrawOn } from '../../sim/setup.svelte';
  import { View } from '../../sim/view';
  import type { SimEntry } from '../../app/registry';
  import type { NumberParamDef } from '../../sim/params.svelte';
  import type { SimInfo } from '../../sim/types';
  import { L_SUN, R_SUN, STAR_DATA, brightness, distanceFrom, luminosity } from '../../physics/luminosity';
  import { blackbodyRGB } from '../../physics/blackbody';
  import { AU, S_solar, parsec, lightYear } from '../../core/constants';
  import { drawXYPlot } from '../../sim/xyPlot';
  import { alpha } from '../../sim/palette';
  import { drawTag } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [
    { key: 'R', label: 'Radius of the star', symbol: 'R', unit: 'R☉', min: 0.1, max: 1000, step: 0.01, log: true },
    { key: 'T', label: 'Surface temperature', symbol: 'T', unit: 'K', min: 2500, max: 40000, step: 10, log: true },
    { key: 'd', label: 'Distance from the star', symbol: 'd', unit: 'pc', min: 1e-6, max: 1000, step: 1e-7, log: true },
  ];
  const { params, sl } = useParams({ R: 1, T: 5772, d: STAR_DATA.Sun.dPc }, sliders);
  const presets = [
    ...Object.entries(STAR_DATA).map(([name, s]) => ({
      id: name,
      label: name === 'Sun' ? 'The Sun seen from the Earth (1 AU)' : `${name}, seen from the Earth`,
      values: { R: s.R, T: s.T, d: s.dPc },
    })),
    { id: 'mars', label: 'The Sun seen from Mars (1.52 AU)', values: { R: 1, T: 5772, d: STAR_DATA.Sun.dPc * 1.52 } },
    { id: 'far', label: 'The Sun seen from 10 pc', values: { R: 1, T: 5772, d: 10 } },
  ];
  const info: SimInfo = {
    about: [
      'The luminosity L of a star is the total power it radiates. A star behaves roughly like a black body, so L = σAT⁴ with A = 4πR² its surface area. Hotter stars are far more luminous (T⁴), and so are bigger ones (R²).',
      'Far from the star this power is spread over a sphere of area 4πd². The apparent brightness b is the power arriving on each square metre: b = L/(4πd²). Twice as far away, the same light covers four times the area, so b is four times smaller (inverse square law).',
      'At the Earth the Sun’s apparent brightness is the solar constant, about 1.36 kW m⁻². If the luminosity of a star is known, measuring b gives its distance: d = √(L/(4πb)).',
    ],
    formulas: [
      { label: 'Stefan–Boltzmann law', tex: 'L = \\sigma A T^{4}' },
      { label: 'Apparent brightness', tex: 'b = \\dfrac{L}{4\\pi d^{2}}' },
    ],
    assumptions: [
      'Stars are treated as black bodies with a single surface temperature; light absorbed by dust between the stars is ignored.',
      'Sun: R = 6.96 × 10⁸ m, T = 5772 K (IAU nominal values); σ from the data booklet. Other stars: rounded literature values (Betelgeuse varies and its radius is uncertain).',
      'The picture of the star is not to scale (its size is shown on a logarithmic scale); its colour is the colour of a black body at that temperature.',
    ],
    tryThis: [
      'Check the solar constant: the Sun seen from the Earth should give about 1360 W m⁻².',
      'Move from 1 AU to 1.52 AU (Mars). By what factor does b change? Check with the inverse square law.',
      'Betelgeuse is much cooler than the Sun but far more luminous. Why?',
      'On the graph, what is the gradient of log b against log d?',
    ],
  };

  const dm = $derived(params.d * parsec);
  const L = $derived(luminosity(params.R * R_SUN, params.T));
  const b = $derived(brightness(L, dm));

  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const H = view.height;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    const wide = W > 760;
    const sceneW = wide ? W * 0.5 : W;
    const sceneH = wide ? H - 40 : Math.min(H * 0.42, 260);
    // star (log size, black-body colour)
    const [r, g, bl] = blackbodyRGB(params.T);
    const m = Math.max(r, g, bl) || 1;
    const col = `rgb(${Math.round((255 * r) / m)},${Math.round((255 * g) / m)},${Math.round((255 * bl) / m)})`;
    const sx = 70;
    const sy = sceneH / 2;
    const rad = Math.max(6, Math.min(60, 20 + 12 * Math.log10(params.R)));
    const grd = ctx.createRadialGradient(sx, sy, rad * 0.3, sx, sy, rad * 2.2);
    grd.addColorStop(0, col);
    grd.addColorStop(1, alpha('#ffffff', 0));
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(sx, sy, rad * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = col;
    ctx.strokeStyle = pal.text3;
    ctx.beginPath();
    ctx.arc(sx, sy, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // inverse square sketch: the light through one square at d covers 4 at 2d and 9 at 3d
    const unit = Math.min(26, (sceneH - 60) / 9);
    const step = Math.max(60, (sceneW - sx - 60) / 3.3);
    ctx.strokeStyle = alpha(pal.text3.startsWith('#') ? pal.text3 : '#888888', 0.6);
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + 3.3 * step, sy - 1.65 * unit);
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + 3.3 * step, sy + 1.65 * unit);
    ctx.stroke();
    ctx.setLineDash([]);
    for (let k = 1; k <= 3; k++) {
      const x = sx + k * step;
      const n = k;
      const half = (n * unit) / 2;
      ctx.strokeStyle = pal.text2;
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = `rgba(${Math.round((255 * r) / m)},${Math.round((255 * g) / m)},${Math.round((255 * bl) / m)},${0.55 / (k * k)})`;
        ctx.fillRect(x - 6, sy - half + i * unit, 12, unit);
        ctx.strokeRect(x - 6, sy - half + i * unit, 12, unit);
      }
      drawTag(ctx, x, sy + half + 16, k === 1 ? 'd: 1 square' : `${k}d: ${k * k} squares`, pal.text2, pal.surface, '600 10px Inter Variable, system-ui, sans-serif');
    }
    ctx.fillStyle = pal.text3;
    ctx.font = '500 10px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('the same light spreads over 4 × the area at twice the distance (side view of squares; star not to scale)', 12, sceneH - 16);

    // graph: log b against log d (gradient −2)
    const gx0 = wide ? sceneW + 50 : 56;
    const gx1 = W - 24;
    const gy0 = wide ? 220 : sceneH + 40;
    const gy1 = H - 40;
    if (gx1 - gx0 < 110 || gy1 - gy0 < 70) return;
    const ld = Math.log10(params.d);
    const lb = Math.log10(b);
    const sunP = Math.log10(AU / parsec);
    drawXYPlot(ctx, pal, {
      x0: gx0,
      y0: gy0,
      x1: gx1,
      y1: gy1,
      xmin: -6,
      xmax: 3,
      ymin: -14,
      ymax: 8,
      xLabel: 'log₁₀(d / pc)',
      yLabel: 'log₁₀(b / W m⁻²)',
      curves: [
        { fn: (x) => Math.log10(brightness(L, 10 ** x * parsec)), color: pal.series[0], width: 2 },
        { fn: (x) => Math.log10(brightness(L_SUN, 10 ** x * parsec)), color: pal.text3, dash: [4, 4], width: 1 },
      ],
      points: [{ x: sunP, y: Math.log10(S_solar) }],
      pointColor: pal.hl,
      current: { x: ld, y: lb },
    });
  }

  const ctrl = new SimController({ step: () => {}, render: draw, reset: () => {} }, { dt: 1, autoplay: false });
  const palette = usePalette(() => ctrl);
  redrawOn(ctrl, () => [params.R, params.T, params.d]);

  const rows = $derived([
    { label: 'luminosity L = 4πR²σT⁴', value: fmt(L, 3), unit: 'W', strong: true },
    { label: 'L / L☉', value: fmt(L / L_SUN, 3) },
    { label: 'distance', value: `${fmt(dm / AU, 3)} AU = ${fmt(dm / lightYear, 3)}`, unit: 'ly' },
    { label: 'apparent brightness b = L/(4πd²)', value: fmt(b, 3), unit: 'W m⁻²', strong: true, color: '--series-1' },
    { label: 'compared with sunlight on Earth', value: fmt(b / S_solar, 3), unit: '×' },
    { label: 'check: d = √(L/(4πb))', value: fmt(distanceFrom(L, b) / parsec, 3), unit: 'pc' },
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
  graphs={[]}
  {presets}
  onpreset={(id) => Object.assign(params, presets.find((q) => q.id === id)?.values ?? {})}
  stopwatch={false}
  transport={false}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      label="A star, the inverse square law and a graph of apparent brightness against distance"
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
      <Slider def={sl('R')} bind:value={params.R} />
      <Slider def={sl('T')} bind:value={params.T} />
      <Slider def={sl('d')} bind:value={params.d} />
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

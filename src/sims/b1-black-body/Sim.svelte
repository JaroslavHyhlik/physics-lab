<script lang="ts">
  import { onMount } from 'svelte';
  import SimShell from '../../sim/SimShell.svelte';
  import SimCanvas from '../../sim/SimCanvas.svelte';
  import Readouts from '../../sim/Readouts.svelte';
  import Slider from '../../ui/Slider.svelte';
  import Toggle from '../../ui/Toggle.svelte';
  import { SimController } from '../../sim/controller.svelte';
  import { useParams, usePalette, redrawOn } from '../../sim/setup.svelte';
  import { View } from '../../sim/view';
  import type { SimEntry } from '../../app/registry';
  import type { NumberParamDef } from '../../sim/params.svelte';
  import type { SimInfo } from '../../sim/types';
  import { planck, stefanBoltzmann, blackbodyRGB, wavelengthRGB } from '../../physics/blackbody';
  import { wienConstant } from '../../core/constants';
  import { drawTag, niceStep } from '../../sim/draw';
  import { alpha } from '../../sim/palette';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [
    { key: 'T', label: 'Temperature', symbol: 'T', unit: 'K', min: 300, max: 30000, step: 10, log: true },
    { key: 'T2', label: 'Compare with', symbol: 'T_2', unit: 'K', min: 300, max: 30000, step: 10, log: true },
  ];
  const { params, sl } = useParams({ T: 5800, T2: 4000, cmp: true }, sliders);
  const presets = [
    { id: 'sun', label: 'Sun (≈ 5800 K)', values: { T: 5800, T2: 4000, cmp: true } },
    { id: 'bulb', label: 'Filament lamp (≈ 2800 K)', values: { T: 2800, T2: 5800, cmp: true } },
    { id: 'human', label: 'Human body (310 K)', values: { T: 310, T2: 273, cmp: true } },
    { id: 'sirius', label: 'Sirius A (≈ 9900 K)', values: { T: 9900, T2: 5800, cmp: true } },
    { id: 'red', label: 'Red dwarf (≈ 3000 K)', values: { T: 3000, T2: 5800, cmp: true } },
  ];
  const info: SimInfo = {
    about: [
      'A black body absorbs all radiation that falls on it, and emits radiation with a spectrum that depends only on its temperature. Stars, filament lamps and even people are close to black bodies.',
      'The hotter the body, the more it emits at every wavelength, and the peak of the curve moves to shorter wavelengths (Wien’s displacement law). That is why a heated metal glows red, then yellow, then white, and why hot stars are blue-white.',
      'The total power emitted per square metre is the area under the curve. It grows with the fourth power of the absolute temperature (Stefan–Boltzmann law): doubling T gives 16 times more power.',
    ],
    formulas: [
      { label: 'Wien’s displacement law', tex: '\\lambda_{\\max} T = 2.9 \\times 10^{-3}\\ \\text{m K}' },
      { label: 'Stefan–Boltzmann law', tex: 'L = \\sigma A T^{4}' },
      { label: 'Power per unit area (area under the curve)', tex: '\\dfrac{L}{A} = \\sigma T^{4}', beyond: true },
      { label: 'Planck’s law (shape of the curve)', tex: 'M_\\lambda = \\dfrac{2\\pi h c^{2}}{\\lambda^{5}}\\,\\dfrac{1}{e^{hc/\\lambda k_B T} - 1}', beyond: true },
    ],
    assumptions: [
      'Perfect black body (emissivity 1).',
      'The curve uses Planck’s law with the data-booklet values of h, c and k_B. With these rounded constants its area differs from σT⁴ by about 0.5 %; the readouts use σ from the booklet.',
      'The colour shown is the colour of the light itself as the eye would see it (CIE 1931 colour matching, fit by Wyman, Sloan & Shirley 2013), with brightness removed and converted to sRGB; colours outside the screen’s range are clipped.',
      'Star temperatures are approximate effective surface temperatures.',
    ],
    tryThis: [
      'Read λ_max from the graph for the Sun and check that λ_max T ≈ 2.9 × 10⁻³ m K.',
      'Set T to twice T₂. How many times larger is the area under the curve?',
      'At what temperature does the peak enter the visible range? What colour is the body then?',
      'Why can thermal cameras see people in the dark?',
    ],
  };

  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;
  const rgbCss = ([r, g, b]: [number, number, number], a = 1) => `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;

  /** fraction of the total emitted between λ1 and λ2 [m] (Simpson's rule) */
  function fraction(T: number, l1: number, l2: number): number {
    const n = 200;
    const hs = (l2 - l1) / n;
    let s = 0;
    for (let i = 0; i <= n; i++) s += (i === 0 || i === n ? 1 : i % 2 ? 4 : 2) * planck(l1 + i * hs, T);
    return (s * hs) / 3 / stefanBoltzmann(T);
  }

  const DRAPER = 800; // K
  function visibleShare(T: number): string {
    const f = 100 * fraction(T, 380e-9, 750e-9);
    return f < 0.01 ? '< 0.01 %' : `${f.toPrecision(2)} %`;
  }

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const H = view.height;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    const T = params.T;
    const T2 = params.T2;
    const peak = wienConstant / T;
    // glowing body
    const col = blackbodyRGB(T);
    const bx = 80;
    const by = 78;
    // below the Draper point (≈ 800 K) the visible glow is far too faint to see
    const glows = T >= DRAPER;
    if (glows) {
      const grad = ctx.createRadialGradient(bx, by, 30, bx, by, 58);
      grad.addColorStop(0, rgbCss(col, 0.8));
      grad.addColorStop(1, rgbCss(col, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(bx, by, 58, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = glows ? rgbCss(col, 1) : pal.text3;
    ctx.beginPath();
    ctx.arc(bx, by, 32, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = pal.gridStrong;
    ctx.stroke();
    ctx.fillStyle = pal.text2;
    ctx.font = '600 11px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(glows ? `colour at ${Math.round(T)} K` : `${Math.round(T)} K: no visible glow`, bx + 70, by - 8);
    ctx.fillStyle = pal.text3;
    ctx.font = '500 10px Inter Variable, system-ui, sans-serif';
    ctx.fillText(glows ? 'brightness not to scale' : 'almost all the radiation is infrared (glow starts at ≈ 800 K)', bx + 70, by + 8);
    // plot area
    const px0 = 70;
    const px1 = W - 24;
    const py0 = 160;
    const py1 = H - 54;
    if (py1 - py0 < 60) return;
    const xMax = Math.max(1000e-9, 4 * peak); // m
    const yMax = 1.12 * Math.max(planck(peak, T), params.cmp && wienConstant / T2 < xMax ? planck(Math.min(wienConstant / T2, xMax), T2) : 0);
    const X = (l: number) => px0 + (l / xMax) * (px1 - px0);
    const Y = (v: number) => py1 - (v / yMax) * (py1 - py0);
    // units: nm or μm on x; W m⁻² per nm (or per μm) on y
    const micro = xMax > 5000e-9;
    const xu = micro ? 1e-6 : 1e-9;
    const yu = micro ? 1e-6 : 1e-9; // per μm or per nm
    // grid
    ctx.lineWidth = 1;
    ctx.font = '500 10px Inter Variable, system-ui, sans-serif';
    const xs = niceStep((px1 - px0) / (xMax / xu), 70);
    for (let v = 0; v * xu <= xMax * 1.0001; v += xs) {
      const x = Math.round(X(v * xu)) + 0.5;
      ctx.strokeStyle = v === 0 ? pal.gridStrong : pal.grid;
      ctx.beginPath();
      ctx.moveTo(x, py0);
      ctx.lineTo(x, py1);
      ctx.stroke();
      ctx.fillStyle = pal.text3;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`${+v.toPrecision(6)}`, x, py1 + 16);
    }
    const yScaled = yMax * yu;
    const ys = niceStep((py1 - py0) / yScaled, 40);
    for (let v = 0; v <= yScaled; v += ys) {
      const y = Math.round(Y(v / yu)) + 0.5;
      ctx.strokeStyle = v === 0 ? pal.gridStrong : pal.grid;
      ctx.beginPath();
      ctx.moveTo(px0, y);
      ctx.lineTo(px1, y);
      ctx.stroke();
      ctx.fillStyle = pal.text3;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(v === 0 ? '0' : fmt(v, 2), px0 - 6, y);
    }
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(micro ? 'wavelength λ / μm' : 'wavelength λ / nm', px1, H - 6);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(micro ? 'intensity per unit wavelength / W m⁻² μm⁻¹' : 'intensity per unit wavelength / W m⁻² nm⁻¹', px0, py0 - 6);
    // visible spectrum strip under the axis
    const v1 = Math.max(px0, X(380e-9));
    const v2 = Math.min(px1, X(750e-9));
    for (let x = Math.floor(v1); x < v2; x++) {
      const lnm = (((x - px0) / (px1 - px0)) * xMax) / 1e-9;
      ctx.fillStyle = rgbCss(wavelengthRGB(lnm));
      ctx.fillRect(x, py1 + 2, 1, 10);
    }
    // curves
    const curve = (TT: number, stroke: string, fill: string | null) => {
      ctx!.beginPath();
      ctx!.moveTo(X(0), Y(0));
      const n = 400;
      for (let i = 1; i <= n; i++) {
        const l = (xMax * i) / n;
        ctx!.lineTo(X(l), Y(Math.min(planck(l, TT), yMax * 2)));
      }
      if (fill) {
        ctx!.lineTo(X(xMax), Y(0));
        ctx!.closePath();
        ctx!.fillStyle = fill;
        ctx!.fill();
      }
      ctx!.strokeStyle = stroke;
      ctx!.lineWidth = 2.5;
      ctx!.stroke();
      ctx!.lineWidth = 1;
    };
    ctx.save();
    ctx.beginPath();
    ctx.rect(px0, py0 - 2, px1 - px0, py1 - py0 + 2);
    ctx.clip();
    if (params.cmp) curve(T2, pal.series[0], null);
    curve(T, pal.series[3], alpha(pal.series[3].startsWith('#') ? pal.series[3] : '#e11d48', 0.12));
    ctx.restore();
    // peak marker
    ctx.strokeStyle = pal.series[3];
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(X(peak), Y(planck(peak, T)));
    ctx.lineTo(X(peak), py1);
    ctx.stroke();
    ctx.setLineDash([]);
    drawTag(ctx, Math.min(X(peak), px1 - 60), Math.max(Y(planck(peak, T)) - 16, py0 + 10), `λmax = ${fmt(peak / xu, 3)} ${micro ? 'μm' : 'nm'}`, pal.series[3], pal.surface);
    if (params.cmp) {
      const p2 = wienConstant / T2;
      if (p2 < xMax) drawTag(ctx, X(p2), Math.max(Y(planck(p2, T2)) - 16, py0 + 10), `${Math.round(T2)} K`, pal.series[0], pal.surface);
    }
  }

  const ctrl = new SimController({ step: () => {}, render: draw, reset: () => {} }, { dt: 1, autoplay: false });
  const palette = usePalette(() => ctrl);
  redrawOn(ctrl, () => [params.T, params.T2, params.cmp]);

  const rows = $derived.by(() => {
    const T = params.T;
    const peak = wienConstant / T;
    const M = stefanBoltzmann(T);
    const r: { label: string; value: string; unit?: string; color?: string; strong?: boolean }[] = [
      { label: 'λmax = b/T', value: peak < 1e-6 ? fmt(peak * 1e9, 3) : fmt(peak * 1e6, 3), unit: peak < 1e-6 ? 'nm' : 'μm', color: '--series-4', strong: true },
      { label: 'power per m²: σT⁴', value: fmt(M, 3), unit: 'W m⁻²', strong: true },
      { label: 'share emitted as visible light', value: visibleShare(T) },
    ];
    if (params.cmp) r.push({ label: `area ratio (T/T₂)⁴`, value: fmt((T / params.T2) ** 4, 3), color: '--series-1' });
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
  graphs={[]}
  {presets}
  onpreset={(id) => Object.assign(params, presets.find((p) => p.id === id)?.values ?? {})}
  stopwatch={false}
  transport={false}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      label="Black-body spectrum"
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
      <Slider def={sl('T')} bind:value={params.T} />
      <Toggle label="Compare with a second temperature" bind:checked={params.cmp} />
      {#if params.cmp}<Slider def={sl('T2')} bind:value={params.T2} />{/if}
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

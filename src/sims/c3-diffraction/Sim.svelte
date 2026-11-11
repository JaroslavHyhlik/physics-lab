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
  import { slitIntensity } from '../../physics/diffraction';
  import { drawPatternStrip } from '../../sim/patternStrip';
  import { drawXYPlot } from '../../sim/xyPlot';
  import { drawTag } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [
    { key: 'N', label: 'Number of slits', symbol: 'N', unit: '', min: 1, max: 500, step: 1, log: true },
    { key: 'lam', label: 'Wavelength', symbol: 'λ', unit: 'nm', min: 380, max: 750, step: 1 },
    { key: 'd', label: 'Slit separation (grating spacing)', symbol: 'd', unit: 'μm', min: 1, max: 20, step: 0.1 },
    { key: 'b', label: 'Slit width', symbol: 'b', unit: 'μm', min: 0.2, max: 20, step: 0.1 },
  ];
  const { params, sl } = useParams({ N: 1, lam: 600, d: 5, b: 2, white: false }, sliders);
  const presets = [
    { id: 'single', label: 'Single slit, b = 2 μm', values: { N: 1, b: 2, lam: 600, white: false } },
    { id: 'five', label: '5 slits', values: { N: 5, d: 5, b: 1, lam: 600, white: false } },
    { id: 'grating', label: 'Grating: 300 lines per mm', values: { N: 200, d: 3.33, b: 1, lam: 600, white: false } },
    { id: 'spectrum', label: 'Grating with white light (spectra)', values: { N: 200, d: 3.33, b: 1, white: true } },
  ];
  const info: SimInfo = {
    about: [
      'Light passing through a single slit of width b spreads out: the central maximum is twice as wide as the others, and the first minimum is at sin θ = λ/b (θ ≈ λ/b for small angles). Narrower slits spread the light more.',
      'With N equally spaced slits the waves from all slits interfere. The principal maxima are still where the path difference between neighbouring slits is a whole number of wavelengths, n λ = d sin θ, but they become much sharper and brighter as N increases, with faint subsidiary maxima between them.',
      'A diffraction grating has hundreds of lines per millimetre: its sharp, widely spaced maxima separate the colours of white light into spectra — red is diffracted more than violet.',
    ],
    formulas: [
      { label: 'Single slit, first minimum', tex: '\\theta = \\dfrac{\\lambda}{b}', hl: true },
      { label: 'Diffraction grating maxima', tex: 'n\\lambda = d\\sin\\theta', hl: true },
      { label: 'Intensity (N slits)', tex: 'I = I_0\\left(\\dfrac{\\sin\\beta}{\\beta}\\right)^{2}\\left(\\dfrac{\\sin N\\alpha}{N\\sin\\alpha}\\right)^{2}', beyond: true },
    ],
    assumptions: [
      'Far-field (Fraunhofer) diffraction; identical, equally lit slits; the graph is normalised so the central maximum has intensity 1.',
      'A grating of 300 lines per mm has d = 1/300 mm = 3.33 μm.',
    ],
    tryThis: [
      'Single slit: halve b. What happens to the angle of the first minimum?',
      'Increase N from 2 to 50 at fixed d. Do the principal maxima move? What changes?',
      'Grating, white light: in which order do the colours appear in the first-order spectrum?',
      'What is the highest order n you can see for λ = 600 nm and d = 3.33 μm?',
    ],
  };

  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;
  const Nint = () => Math.max(1, Math.round(params.N));
  const I = (thetaDeg: number, lambda: number) => slitIntensity((thetaDeg * Math.PI) / 180, lambda, Math.min(params.b, params.d) * 1e-6, params.d * 1e-6, Nint());

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const H = view.height;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    const lam = params.lam * 1e-9;
    const x0 = 60;
    const x1 = W > 760 ? W - 280 : W - 20;
    const tmax = 80;
    const sub = Math.min(params.white ? 16 : 64, Math.ceil(Nint() / 4));
    const ns = Math.min(20000, Math.max(300, 60 * Nint()));
    drawPatternStrip(ctx, x0, 40, x1 - x0, 46, -tmax, tmax, I, lam, params.white, sub);
    ctx.strokeStyle = pal.gridStrong;
    ctx.strokeRect(x0, 40, x1 - x0, 46);
    ctx.fillStyle = pal.text3;
    ctx.font = '500 10px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('pattern on a curved screen (angle from −80° to 80°)', x0, 36);
    const gy0 = 120;
    const gy1 = H - 40;
    if (gy1 - gy0 < 60) return;
    const { X } = drawXYPlot(ctx, pal, {
      x0,
      y0: gy0,
      x1,
      y1: gy1,
      xmin: -tmax,
      xmax: tmax,
      ymin: 0,
      ymax: 1.1,
      xLabel: 'angle θ / °',
      yLabel: 'relative intensity',
      curves: params.white
        ? [450, 550, 650].map((l, k) => ({ fn: (t: number) => I(t, l * 1e-9), color: pal.series[[0, 2, 3][k]], width: 1.2, samples: ns }))
        : [
            { fn: (t: number) => I(t, lam), color: pal.series[0], width: 1.6, samples: ns },
            { fn: (t: number) => slitIntensity((t * Math.PI) / 180, lam, Math.min(params.b, params.d) * 1e-6, 0, 1), color: pal.text3, dash: [4, 4], width: 1 },
          ],
    });
    if (!params.white) {
      // predicted positions: grating maxima and first single-slit minimum
      const sinb = lam / (Math.min(params.b, params.d) * 1e-6);
      if (sinb < 1) {
        const t = (Math.asin(sinb) * 180) / Math.PI;
        drawTag(ctx, X(t), gy1 - 14, `sinθ = λ/b`, pal.text2, pal.surface);
      }
      if (Nint() > 1) {
        for (let n = 1; n <= 6; n++) {
          const sn = (n * lam) / (params.d * 1e-6);
          if (sn >= 1) break;
          const t = (Math.asin(sn) * 180) / Math.PI;
          drawTag(ctx, X(t), gy0 + 10 + (n % 2) * 18, `n = ${n}`, pal.series[3], pal.surface);
        }
      }
    }
  }

  const ctrl = new SimController({ step: () => {}, render: draw, reset: () => {} }, { dt: 1, autoplay: false });
  const palette = usePalette(() => ctrl);
  redrawOn(ctrl, () => [params.N, params.lam, params.d, params.b, params.white]);

  const rows = $derived.by(() => {
    const lam = params.lam * 1e-9;
    const b = Math.min(params.b, params.d) * 1e-6;
    const d = params.d * 1e-6;
    const r: { label: string; value: string; unit?: string; strong?: boolean }[] = [
      { label: 'slits N', value: `${Nint()}` },
      { label: 'first minimum θ ≈ λ/b', value: lam / b < 1 ? fmt((Math.asin(lam / b) * 180) / Math.PI, 3) : 'none', unit: lam / b < 1 ? '°' : '' },
    ];
    if (Nint() > 1) {
      r.push({ label: 'first order: sinθ = λ/d', value: lam / d < 1 ? fmt((Math.asin(lam / d) * 180) / Math.PI, 4) : 'none', unit: '°', strong: true });
      r.push({ label: 'highest order n < d/λ', value: `${Math.ceil(d / lam) - 1}` });
      r.push({ label: 'lines per mm 1/d', value: fmt(1e-3 / d, 3) });
    }
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
  onpreset={(id) => Object.assign(params, presets.find((q) => q.id === id)?.values ?? {})}
  stopwatch={false}
  transport={false}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      label="Diffraction by a single slit or many slits"
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
      <Slider def={sl('N')} bind:value={params.N} />
      <Toggle label="White light" bind:checked={params.white} />
      {#if !params.white}<Slider def={sl('lam')} bind:value={params.lam} />{/if}
      <Slider def={sl('d')} bind:value={params.d} />
      <Slider def={sl('b')} bind:value={params.b} />
      <p class="tip">The slit width cannot be larger than the separation.</p>
    </div>
  {/snippet}
</SimShell>

<style>
  .controls {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .tip {
    font-size: var(--text-xs);
    color: var(--text-3);
  }
</style>

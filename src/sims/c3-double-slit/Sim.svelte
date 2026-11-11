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
  import { wavelengthRGB } from '../../physics/blackbody';
  import { drawPatternStrip } from '../../sim/patternStrip';
  import { drawXYPlot } from '../../sim/xyPlot';
  import { drawTag } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [
    { key: 'lam', label: 'Wavelength', symbol: 'λ', unit: 'nm', min: 380, max: 750, step: 1 },
    { key: 'd', label: 'Slit separation', symbol: 'd', unit: 'mm', min: 0.05, max: 1, step: 0.01 },
    { key: 'D', label: 'Distance to the screen', symbol: 'D', unit: 'm', min: 0.5, max: 5, step: 0.05 },
    { key: 'b', label: 'Width of each slit', symbol: 'b', unit: 'mm', min: 0.005, max: 0.15, step: 0.001 },
  ];
  const { params, sl } = useParams({ lam: 633, d: 0.25, D: 2, b: 0.04, white: false }, sliders);
  const presets = [
    { id: 'laser', label: 'Red laser 633 nm, d = 0.25 mm', values: { lam: 633, d: 0.25, D: 2, b: 0.04, white: false } },
    { id: 'green', label: 'Green laser 532 nm', values: { lam: 532, d: 0.25, D: 2, b: 0.04, white: false } },
    { id: 'white', label: 'White light', values: { white: true, d: 0.25, D: 2, b: 0.04 } },
    { id: 'wide', label: 'Wider slits: envelope shows', values: { lam: 633, d: 0.25, D: 2, b: 0.1, white: false } },
  ];
  const info: SimInfo = {
    about: [
      'Light from two narrow slits spreads out and overlaps. Where the path difference from the two slits is a whole number of wavelengths the waves arrive in phase (constructive interference, bright fringe); where it is a half-odd number they cancel (dark fringe).',
      'On a screen a distance D away the bright fringes are equally spaced: s = λD/d. Longer wavelengths (red) and closer slits give wider fringes.',
      'Each slit also diffracts on its own, so the fringes are not all equally bright: they lie under the single-slit envelope, which gets narrower for wider slits. With white light each colour has its own spacing: the central fringe is white and the others have coloured edges.',
    ],
    formulas: [
      { label: 'Fringe spacing', tex: 's = \\dfrac{\\lambda D}{d}' },
      { label: 'Constructive interference', tex: '\\text{path difference} = n\\lambda' },
      { label: 'Destructive interference', tex: '\\text{path difference} = \\left(n + \\tfrac{1}{2}\\right)\\lambda' },
      { label: 'Intensity on the screen', tex: 'I = I_0\\left(\\dfrac{\\sin\\beta}{\\beta}\\right)^{2}\\cos^{2}\\alpha', beyond: true },
    ],
    assumptions: [
      'Far-field (Fraunhofer) pattern: the screen is far away compared with d; each slit is lit equally and coherently.',
      'Brightness on the strip is relative (the central maximum is set to full brightness). Colours of wavelengths are approximate on screens.',
    ],
    tryThis: [
      'Measure 10 fringe spacings on the graph and calculate λ from s = λD/d.',
      'Halve the slit separation. What happens to the fringes?',
      'With white light, which colour is on the inside of each coloured fringe? Why?',
    ],
  };

  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;
  const I = (y: number, lambda: number) => slitIntensity(Math.atan(y / params.D), lambda, params.b * 1e-3, params.d * 1e-3, 2);

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const H = view.height;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    const lam = params.lam * 1e-9;
    const s = (lam * params.D) / (params.d * 1e-3);
    const Ymax = Math.max(6 * s, 0.005); // m on each side
    const x0 = 60;
    const x1 = W > 760 ? W - 280 : W - 20;
    // set-up sketch
    const sy = 70;
    ctx.fillStyle = pal.text3;
    ctx.font = '500 10px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const col = params.white ? pal.ink : `rgb(${wavelengthRGB(params.lam).map((v) => Math.round(v * 255)).join(',')})`;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x0, sy, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.text2;
    ctx.fillRect(x0 + 80, sy - 40, 4, 34);
    ctx.fillRect(x0 + 80, sy - 3, 4, 6);
    ctx.fillRect(x0 + 80, sy + 6, 4, 34);
    ctx.fillRect(x1 - 6, sy - 40, 6, 80);
    ctx.strokeStyle = pal.gridStrong;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(x0 + 84, sy + 50);
    ctx.lineTo(x1 - 6, sy + 50);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = pal.text3;
    ctx.fillText(`D = ${fmt(params.D, 3)} m`, (x0 + x1) / 2, sy + 54);
    ctx.fillText(`d = ${fmt(params.d, 3)} mm`, x0 + 82, sy + 44);
    ctx.fillText('source', x0, sy + 12);
    ctx.fillText('screen', x1 - 3, sy + 44);
    // pattern strip on the screen (seen face-on)
    const py0 = sy + 90;
    drawPatternStrip(ctx, x0, py0, x1 - x0, 50, -Ymax, Ymax, I, lam, params.white);
    ctx.strokeStyle = pal.gridStrong;
    ctx.strokeRect(x0, py0, x1 - x0, 50);
    // intensity graph against position y on the screen (mm)
    const gy0 = py0 + 80;
    const gy1 = H - 40;
    if (gy1 - gy0 < 60) return;
    const fringe = (n: number) => n * s * 1e3;
    drawXYPlot(ctx, pal, {
      x0,
      y0: gy0,
      x1,
      y1: gy1,
      xmin: -Ymax * 1e3,
      xmax: Ymax * 1e3,
      ymin: 0,
      ymax: 1.1,
      xLabel: 'position on the screen y / mm',
      yLabel: 'relative intensity',
      curves: params.white
        ? [450, 550, 650].map((l, k) => ({ fn: (y: number) => I(y / 1e3, l * 1e-9), color: pal.series[[0, 2, 3][k]], width: 1.5 }))
        : [
            { fn: (y: number) => I(y / 1e3, lam), color: pal.series[0], width: 2 },
            { fn: (y: number) => slitIntensity(Math.atan(y / 1e3 / params.D), lam, params.b * 1e-3, 0, 1), color: pal.text3, dash: [4, 4], width: 1 },
          ],
    });
    if (!params.white) {
      const X = (y: number) => x0 + ((y + Ymax * 1e3) / (2 * Ymax * 1e3)) * (x1 - x0);
      ctx.strokeStyle = pal.text2;
      ctx.beginPath();
      ctx.moveTo(X(0), gy0 + 14);
      ctx.lineTo(X(fringe(1)), gy0 + 14);
      ctx.stroke();
      drawTag(ctx, X(fringe(0.5)), gy0 + 14, `s = ${fmt(s * 1e3, 3)} mm`, pal.text2, pal.surface);
    }
  }

  const ctrl = new SimController({ step: () => {}, render: draw, reset: () => {} }, { dt: 1, autoplay: false });
  const palette = usePalette(() => ctrl);
  redrawOn(ctrl, () => [params.lam, params.d, params.D, params.b, params.white]);

  const rows = $derived.by(() => {
    const s = ((params.lam * 1e-9) * params.D) / (params.d * 1e-3);
    return [
      { label: 'fringe spacing s = λD/d', value: fmt(s * 1e3, 4), unit: 'mm', strong: true },
      { label: 'angle between fringes λ/d', value: fmt((params.lam * 1e-9) / (params.d * 1e-3), 3), unit: 'rad' },
      { label: 'bright fringes in the central envelope', value: `${2 * Math.floor(params.d / params.b - 1e-9) + 1}` },
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
  transport={false}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      label="Young's double-slit interference pattern and intensity graph"
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
      <Toggle label="White light" bind:checked={params.white} />
      {#if !params.white}<Slider def={sl('lam')} bind:value={params.lam} />{/if}
      <Slider def={sl('d')} bind:value={params.d} />
      <Slider def={sl('D')} bind:value={params.D} />
      <Slider def={sl('b')} bind:value={params.b} />
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

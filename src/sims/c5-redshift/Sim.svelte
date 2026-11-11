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
  import { BALMER, redshiftedLambda } from '../../physics/doppler';
  import { spectrumToLinearRGB, gammaEncode } from '../../physics/diffraction';
  import { c } from '../../core/constants';
  import { drawTag } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [{ key: 'v', label: 'Speed of the galaxy away from us', symbol: 'v', unit: 'km s⁻¹', min: -3000, max: 30000, step: 50 }];
  const { params, sl } = useParams({ v: 6000 }, sliders);
  const presets = [
    { id: 'near', label: 'Nearby galaxy (1 200 km s⁻¹)', values: { v: 1200 } },
    { id: 'far', label: 'Distant galaxy (15 000 km s⁻¹)', values: { v: 15000 } },
    { id: 'blue', label: 'Andromeda: approaching (−300 km s⁻¹)', values: { v: -300 } },
  ];
  const info: SimInfo = {
    about: [
      'Hydrogen absorbs light at a set of exact wavelengths, seen as dark lines in a spectrum. In the light from a distant galaxy the same pattern of lines appears, but shifted.',
      'If the galaxy moves away from us, the wavelengths are stretched: the lines move towards the red end (redshift). If it approaches, they move towards the blue end (blueshift). For speeds much smaller than the speed of light the fractional shift is Δλ/λ ≈ v/c.',
      'Almost all distant galaxies show redshift, and the more distant ones larger redshifts: the universe is expanding.',
    ],
    formulas: [
      { label: 'Doppler shift for light (v ≪ c)', tex: '\\dfrac{\\Delta f}{f} = \\dfrac{\\Delta\\lambda}{\\lambda} \\approx \\dfrac{v}{c}' },
      { label: 'Redshift', tex: 'z = \\dfrac{\\Delta\\lambda}{\\lambda_0}', beyond: true },
    ],
    assumptions: [
      'Hydrogen Balmer lines at 656.3, 486.1, 434.0 and 410.2 nm (laboratory values).',
      'Non-relativistic formula Δλ/λ = v/c (good to about 5 % up to v = 0.1c).',
      'Colours of the continuous spectrum are approximate on screens.',
    ],
    tryThis: [
      'Read the shift of the red Hα line and calculate the speed of the galaxy.',
      'Are all the lines shifted by the same number of nanometres? By the same fraction?',
      'What would the spectrum of a galaxy moving towards us look like?',
    ],
  };

  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;
  const LMIN = 380;
  const LMAX = 750;

  // colours of the spectrum with their real relative brightness (dim at both ends)
  let maxLin = 0;
  for (let l = LMIN; l <= LMAX; l += 2) maxLin = Math.max(maxLin, ...spectrumToLinearRGB([l], [1]));
  function spectrum(x0: number, y0: number, w: number, h: number, lines: number[]) {
    const pal = palette.pal;
    for (let i = 0; i < w; i++) {
      const l = LMIN + ((LMAX - LMIN) * i) / w;
      const [r, g, b] = spectrumToLinearRGB([l], [1]).map((v) => gammaEncode(Math.min(1, (1.6 * v) / maxLin)));
      ctx!.fillStyle = `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
      ctx!.fillRect(x0 + i, y0, 1.5, h);
    }
    ctx!.fillStyle = '#000000';
    for (const l of lines) {
      if (l < LMIN || l > LMAX) continue;
      const x = x0 + ((l - LMIN) / (LMAX - LMIN)) * w;
      ctx!.fillRect(x - 1.5, y0, 3, h);
    }
    ctx!.strokeStyle = pal.gridStrong;
    ctx!.strokeRect(x0, y0, w, h);
  }

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const H = view.height;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    const x0 = 40;
    const w = (W > 760 ? W - 280 : W - 20) - x0;
    const vms = params.v * 1e3;
    const shifted = BALMER.map((l) => redshiftedLambda(l, vms, c));
    ctx.fillStyle = pal.text2;
    ctx.font = '600 12px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Hydrogen in the laboratory', x0, 70);
    spectrum(x0, 76, w, 50, BALMER);
    ctx.fillText(params.v >= 0 ? 'Light from the galaxy (redshifted)' : 'Light from the galaxy (blueshifted)', x0, 170);
    spectrum(x0, 176, w, 50, shifted);
    // connectors
    ctx.strokeStyle = pal.text3;
    ctx.setLineDash([3, 3]);
    BALMER.forEach((l, i) => {
      const xa = x0 + ((l - LMIN) / (LMAX - LMIN)) * w;
      const xb = x0 + ((shifted[i] - LMIN) / (LMAX - LMIN)) * w;
      ctx!.beginPath();
      ctx!.moveTo(xa, 126);
      ctx!.lineTo(xb, 176);
      ctx!.stroke();
    });
    ctx.setLineDash([]);
    // wavelength axis
    ctx.fillStyle = pal.text3;
    ctx.font = '500 10px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let l = 400; l <= 750; l += 50) {
      const x = x0 + ((l - LMIN) / (LMAX - LMIN)) * w;
      ctx.fillRect(x, 230, 1, 5);
      ctx.fillText(`${l}`, x, 237);
    }
    ctx.fillText('wavelength / nm', x0 + w / 2, 252);
    drawTag(ctx, x0 + ((shifted[0] - LMIN) / (LMAX - LMIN)) * w, 290, `Hα: ${fmt(shifted[0], 5)} nm (Δλ = ${fmt(shifted[0] - BALMER[0], 3)} nm)`, pal.ink, pal.surface);
  }

  const ctrl = new SimController({ step: () => {}, render: draw, reset: () => {} }, { dt: 1, autoplay: false });
  const palette = usePalette(() => ctrl);
  redrawOn(ctrl, () => [params.v]);

  const rows = $derived.by(() => {
    const z = (params.v * 1e3) / c;
    return [
      { label: 'v/c', value: fmt(z, 4) },
      { label: 'Hα shift Δλ = λv/c', value: fmt(BALMER[0] * z, 4), unit: 'nm', strong: true },
      { label: 'Hβ shift', value: fmt(BALMER[1] * z, 4), unit: 'nm' },
      { label: 'Δλ/λ (same for every line)', value: fmt(z, 4) },
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
      label="Hydrogen absorption lines in the laboratory and in light from a moving galaxy"
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
      <Slider def={sl('v')} bind:value={params.v} />
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

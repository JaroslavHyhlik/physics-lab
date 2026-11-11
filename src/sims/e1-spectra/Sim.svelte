<script lang="ts">
  import { onMount } from 'svelte';
  import SimShell from '../../sim/SimShell.svelte';
  import SimCanvas from '../../sim/SimCanvas.svelte';
  import Readouts from '../../sim/Readouts.svelte';
  import Segmented from '../../ui/Segmented.svelte';
  import { SimController } from '../../sim/controller.svelte';
  import { useParams, usePalette, redrawOn } from '../../sim/setup.svelte';
  import { View } from '../../sim/view';
  import { Interaction } from '../../sim/interaction';
  import type { SimEntry } from '../../app/registry';
  import type { SimInfo } from '../../sim/types';
  import { LAMPS, photonEnergyEV, type Line } from '../../physics/spectra';
  import { spectrumToLinearRGB, gammaEncode } from '../../physics/diffraction';
  import { spectralRGB, rgbStr } from '../../sim/spectrumColor';
  import { drawTag } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const { params } = useParams({ lamp: 'H', mode: 'emission' }, []);
  const presets = [
    { id: 'h', label: 'Hydrogen emission (Balmer series)', values: { lamp: 'H', mode: 'emission' } },
    { id: 'habs', label: 'Hydrogen absorption', values: { lamp: 'H', mode: 'absorption' } },
    { id: 'na', label: 'Sodium (street lamps)', values: { lamp: 'Na', mode: 'emission' } },
    { id: 'ne', label: 'Neon (signs)', values: { lamp: 'Ne', mode: 'emission' } },
  ];
  const info: SimInfo = {
    about: [
      'A hot, low-pressure gas does not glow with all colours. Seen through a spectroscope its light is a set of bright lines at particular wavelengths: an emission spectrum. Every element has its own pattern of lines, like a fingerprint — that is how we know what stars are made of.',
      'White light shone through a cool gas loses exactly the same wavelengths: dark lines appear in the continuous spectrum (an absorption spectrum).',
      'Each line comes from electrons moving between energy levels in the atoms. The energy difference is carried away (or absorbed) by one photon: E = hf = hc/λ. Discrete lines mean the energy levels are discrete.',
    ],
    formulas: [
      { label: 'Photon energy', tex: 'E = hf = \\dfrac{hc}{\\lambda}' },
      { label: 'Hydrogen (Rydberg formula)', tex: '\\dfrac{1}{\\lambda} = R_H\\left(\\dfrac{1}{n_1^{2}} - \\dfrac{1}{n_2^{2}}\\right)', beyond: true },
    ],
    assumptions: [
      'Wavelengths (in air) of the strongest visible lines from the NIST Atomic Spectra Database; brightness of the lines is approximate. Only lines between 380 and 760 nm are shown.',
      'The colours of the lines and of the lamp are calculated from the human eye’s response; screens can only approximate them.',
    ],
    tryThis: [
      'Tap a line to read its wavelength and photon energy.',
      'Compare the hydrogen emission and absorption spectra: are the lines in the same places?',
      'Why does a sodium street lamp look yellow-orange?',
    ],
  };

  const view = new View();
  const inter = new Interaction();
  let ctx: CanvasRenderingContext2D | null = null;
  let picked: Line | null = $state(null);
  const LMIN = 380;
  const LMAX = 760;
  const geo = { x0: 0, w: 1, y0: 0, h: 1 };
  const lamp = () => LAMPS[params.lamp] ?? LAMPS.H;
  inter.add({
    priority: 10,
    cursor: 'pointer',
    hit: (px, py) => (py > geo.y0 - 10 && py < geo.y0 + geo.h + 10 && px > geo.x0 && px < geo.x0 + geo.w ? 0 : Infinity),
    start: (px) => {
      const l = LMIN + ((px - geo.x0) / geo.w) * (LMAX - LMIN);
      let best: Line | null = null;
      let bd = Infinity;
      for (const ln of lamp().lines)
        if (Math.abs(ln.nm - l) < bd) {
          bd = Math.abs(ln.nm - l);
          best = ln;
        }
      picked = bd < 15 ? best : null;
    },
    move: () => {},
  });

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const H = view.height;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    const L = lamp();
    // lamp tube glowing in the mixed colour of its lines
    const [r, g, b] = spectrumToLinearRGB(
      L.lines.map((l) => l.nm),
      L.lines.map((l) => l.rel),
    );
    const m = Math.max(r, g, b) || 1;
    const tube = `rgb(${[r, g, b].map((v) => Math.round(255 * gammaEncode(v / m))).join(',')})`;
    const tx = 40;
    const ty = 60;
    ctx.fillStyle = tube;
    ctx.beginPath();
    ctx.roundRect(tx, ty, 120, 34, 17);
    ctx.fill();
    ctx.strokeStyle = pal.text2;
    ctx.stroke();
    drawTag(ctx, tx + 60, ty + 52, `${L.name} lamp`, pal.ink, pal.surface);
    // spectrum
    const x0 = 40;
    const w = (W > 760 ? W - 300 : W - 20) - x0;
    const y0 = 160;
    const h = 70;
    geo.x0 = x0;
    geo.w = w;
    geo.y0 = y0;
    geo.h = h;
    const X = (l: number) => x0 + ((l - LMIN) / (LMAX - LMIN)) * w;
    if (params.mode === 'emission') {
      ctx.fillStyle = '#000000';
      ctx.fillRect(x0, y0, w, h);
      for (const ln of L.lines) {
        ctx.fillStyle = rgbStr(spectralRGB(ln.nm, 0.3 + 0.7 * ln.rel, 2.2));
        ctx.fillRect(X(ln.nm) - 1.5, y0, 3, h);
      }
    } else {
      for (let i = 0; i < w; i++) {
        ctx.fillStyle = rgbStr(spectralRGB(LMIN + ((LMAX - LMIN) * i) / w, 1));
        ctx.fillRect(x0 + i, y0, 1.5, h);
      }
      ctx.fillStyle = '#000000';
      for (const ln of L.lines) ctx.fillRect(X(ln.nm) - 1.5, y0, 3, h);
    }
    ctx.strokeStyle = pal.gridStrong;
    ctx.strokeRect(x0, y0, w, h);
    ctx.fillStyle = pal.text3;
    ctx.font = '500 10px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let l = 400; l <= 750; l += 50) {
      ctx.fillRect(X(l), y0 + h, 1, 5);
      ctx.fillText(`${l}`, X(l), y0 + h + 7);
    }
    ctx.fillText('wavelength / nm (tap a line)', x0 + w / 2, y0 + h + 22);
    // reference strips: every element has its own fingerprint
    let ry = y0 + h + 50;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (const [k, lp] of Object.entries(LAMPS)) {
      if (ry + 18 > H - 10) break;
      ctx.fillStyle = '#000000';
      ctx.fillRect(x0, ry, w, 16);
      for (const ln of lp.lines) {
        ctx.fillStyle = rgbStr(spectralRGB(ln.nm, 0.3 + 0.7 * ln.rel, 2.2));
        ctx.fillRect(X(ln.nm) - 1, ry, 2, 16);
      }
      ctx.fillStyle = k === params.lamp ? pal.ink : pal.text3;
      ctx.font = `${k === params.lamp ? 700 : 500} 11px Inter Variable, system-ui, sans-serif`;
      ctx.fillText(k, x0 - 6, ry + 8);
      ry += 24;
    }
    if (picked) {
      ctx.strokeStyle = pal.ink;
      ctx.lineWidth = 2;
      ctx.strokeRect(X(picked.nm) - 4, y0 - 4, 8, h + 8);
      ctx.lineWidth = 1;
      drawTag(ctx, X(picked.nm), y0 - 18, `${picked.nm} nm · ${photonEnergyEV(picked.nm * 1e-9).toFixed(3)} eV`, pal.ink, pal.surface);
    }
  }

  const ctrl = new SimController({ step: () => {}, render: draw, reset: () => {} }, { dt: 1, autoplay: false });
  const palette = usePalette(() => ctrl);
  redrawOn(ctrl, () => [params.lamp, params.mode, picked]);
  inter.onChange = () => ctrl.invalidate();
  $effect(() => {
    void params.lamp;
    picked = null;
  });

  const rows = $derived.by(() => {
    const L = lamp();
    const strongest = [...L.lines].sort((a, b) => b.rel - a.rel).slice(0, 3);
    const r: { label: string; value: string; unit?: string; strong?: boolean }[] = strongest.map((ln) => ({
      label: `${ln.nm} nm`,
      value: fmt(photonEnergyEV(ln.nm * 1e-9), 3),
      unit: 'eV',
    }));
    if (picked) r.unshift({ label: `selected: ${picked.nm} nm`, value: fmt(photonEnergyEV(picked.nm * 1e-9), 4), unit: 'eV', strong: true });
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
      interaction={inter}
      label="Gas discharge lamp and its line spectrum"
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
        label="Gas"
        bind:value={params.lamp}
        options={Object.keys(LAMPS).map((k) => ({ value: k, label: k }))}
      />
      <Segmented
        label="Spectrum"
        bind:value={params.mode}
        options={[
          { value: 'emission', label: 'Emission' },
          { value: 'absorption', label: 'Absorption' },
        ]}
      />
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

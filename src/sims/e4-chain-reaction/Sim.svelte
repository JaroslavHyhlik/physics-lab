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
  import { ChainReaction, MEV_PER_FISSION, kInfinity, plateHalf, type Shape } from '../../physics/chain';
  import { Rng } from '../../core/rng';
  import { alpha } from '../../sim/palette';
  import { drawTag } from '../../sim/draw';
  import { fmt } from '../../core/format';
  import { e as eCharge } from '../../core/constants';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [
    { key: 'R', label: 'Size of the lump (radius, in mean free paths)', symbol: 'R', unit: 'λ', min: 0.3, max: 3, step: 0.01 },
    { key: 'e', label: 'Enrichment (fraction of U-235)', symbol: '', unit: '%', min: 0.7, max: 100, step: 0.1, log: true },
    { key: 'N0', label: 'Neutrons fired in at the start', symbol: '', unit: '', min: 1, max: 50, step: 1 },
  ];
  const { params, sl } = useParams({ R: 1.6, e: 90, shape: 'disc', N0: 5 }, sliders);
  const presets = [
    { id: 'sub', label: 'Small lump: subcritical (k ≈ 0.8), dies out', values: { R: 0.6, e: 90, shape: 'disc', N0: 30 } },
    { id: 'crit', label: 'Close to critical (k ≈ 1)', values: { R: 0.88, e: 90, shape: 'disc', N0: 40 } },
    { id: 'super', label: 'Larger lump: supercritical (k ≈ 1.4), runs away', values: { R: 1.6, e: 90, shape: 'disc', N0: 5 } },
    { id: 'flat', label: 'Supercritical mass made into a flat plate', values: { R: 1.1, e: 90, shape: 'plate', N0: 40 } },
    { id: 'low', label: 'Same size, only 3 % U-235: subcritical', values: { R: 0.88, e: 3, shape: 'disc', N0: 40 } },
    { id: 'nat', label: 'Natural uranium (0.7 %) needs a much bigger lump', values: { R: 2.5, e: 0.7, shape: 'disc', N0: 20 } },
  ];
  const info: SimInfo = {
    about: [
      'When a U-235 nucleus absorbs a neutron it usually splits (fission) into two smaller nuclei, releasing about 200 MeV and two or three new neutrons. These can cause further fissions: a chain reaction.',
      'Not every neutron causes a fission. Some escape through the surface of the lump, and some are absorbed by U-238 or by U-235 without fission. The multiplication factor k is the average number of neutrons from one generation that go on to cause the next generation’s fissions.',
      'k < 1: subcritical, the reaction dies out. k = 1: critical, steady (as in a reactor). k > 1: supercritical, the number of neutrons grows exponentially (as in a bomb).',
      'A bigger lump has less surface for its volume, so a smaller fraction of neutrons escapes. The critical mass is the smallest mass that can sustain the chain reaction; it depends on the shape (a sphere is best, a flat plate needs more) and on the enrichment.',
    ],
    formulas: [
      { label: 'Energy per fission', tex: 'E \\approx 200\\ \\text{MeV}', beyond: true },
      { label: 'Multiplication factor', tex: 'k = \\dfrac{\\text{neutrons in generation } n+1}{\\text{neutrons in generation } n}', beyond: true },
      { label: 'Mass–energy', tex: 'E = mc^{2}' },
    ],
    assumptions: [
      'Illustrative 2D model: neutrons move in a plane. Lengths are in units of the mean free path λ (the average distance a neutron travels before it is absorbed), so the sizes are not real critical masses.',
      'Absorption in U-235 or U-238 in proportion to the thermal cross-sections (681 b and 2.7 b); an absorption in U-235 causes fission with probability 585/681; each fission gives 2 or 3 neutrons (mean 2.43). Scattering, fast fission of U-238 and delayed neutrons are ignored.',
      'Fuel used up during the run is ignored. The run stops at 4000 neutrons. Neutron speed is slowed down enormously for the animation; random numbers are seeded.',
    ],
    tryThis: [
      'Start with a small lump and make it bigger, one step at a time. Where does k cross 1?',
      'Keep the same area (mass) but switch to a flat plate. What happens to k? Why?',
      'Lower the enrichment to 3 %. Can any size of lump now go critical in this model? Compare k∞.',
      'Run the same settings several times (reset). Why does the measured k vary from run to run?',
    ],
  };
  const channels: ChannelDef[] = [
    { key: 't', label: 't', unit: 's' },
    { key: 'n', label: 'neutrons in the lump', unit: '', color: '--series-1' },
  ];
  const graphs: GraphDef[] = [{ id: 'n', title: 'Number of neutrons', series: ['n'] }];

  let seed = 1;
  let chain = new ChainReaction(new Rng(seed), params.R, params.shape as Shape, params.e / 100);
  const SPEED = 1.3; // mean free paths per second of animation
  // recent events for flashes: x, y, type, age
  const FL = 400;
  const fx = new Float64Array(FL);
  const fy = new Float64Array(FL);
  const ft = new Uint8Array(FL);
  const fage = new Float64Array(FL).fill(9);
  let fi = 0;
  let status = $state('');

  function start() {
    chain = new ChainReaction(new Rng(seed++), params.R, params.shape as Shape, params.e / 100);
    chain.inject(params.N0);
    fage.fill(9);
    status = '';
  }

  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;
  const hash = (i: number) => {
    let x = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
    x ^= x >>> 13;
    x = Math.imul(x, 0xc2b2ae35);
    return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
  };

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
    const [ha, hb] = params.shape === 'disc' ? [params.R, params.R] : plateHalf(params.R);
    const k = Math.min((areaW - 40) / (2 * ha), (usable - 60) / (2 * hb), 170);
    const X = (x: number) => cx + x * k;
    const Y = (y: number) => cy - y * k;
    // lump outline
    ctx.fillStyle = alpha(pal.text3.startsWith('#') ? pal.text3 : '#888888', 0.12);
    ctx.strokeStyle = pal.text3;
    ctx.beginPath();
    if (params.shape === 'disc') ctx.arc(cx, cy, params.R * k, 0, Math.PI * 2);
    else ctx.rect(X(-ha), Y(hb), 2 * ha * k, 2 * hb * k);
    ctx.fill();
    ctx.stroke();
    // nuclei (decorative): U-235 orange, U-238 grey, in proportion to the enrichment
    const sp = Math.max(0.18, 8 / k);
    const nx = Math.ceil(ha / sp);
    const ny = Math.ceil(hb / sp);
    const c235 = pal.hl;
    const c238 = alpha(pal.text3.startsWith('#') ? pal.text3 : '#888888', 0.45);
    let idx = 0;
    for (let j = -ny; j <= ny; j++)
      for (let i = -nx; i <= nx; i++) {
        idx++;
        const x = (i + hash(idx) * 0.6 - 0.3) * sp;
        const y = (j + hash(idx + 77777) * 0.6 - 0.3) * sp;
        if (!chain.inside(x, y)) continue;
        ctx.fillStyle = hash(idx + 31337) < params.e / 100 ? c235 : c238;
        ctx.fillRect(X(x) - 1.5, Y(y) - 1.5, 3, 3);
      }
    // flashes
    for (let q = 0; q < FL; q++) {
      if (fage[q] > 0.6) continue;
      const a = 1 - fage[q] / 0.6;
      if (ft[q] === 1) {
        ctx.fillStyle = alpha(pal.series[3].startsWith('#') ? pal.series[3] : '#e11d48', 0.7 * a);
        ctx.beginPath();
        ctx.arc(X(fx[q]), Y(fy[q]), 4 + 10 * (1 - a), 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = alpha(pal.text3.startsWith('#') ? pal.text3 : '#888888', a);
        ctx.beginPath();
        ctx.arc(X(fx[q]), Y(fy[q]), 4, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    // neutrons
    ctx.fillStyle = pal.series[0];
    for (let i = 0; i < chain.max; i++) {
      if (!chain.alive[i]) continue;
      ctx.beginPath();
      ctx.arc(X(chain.x[i]), Y(chain.y[i]), 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (status) drawTag(ctx, cx, 24, status, pal.ink, pal.surface);
    ctx.fillStyle = pal.text3;
    ctx.font = '500 10px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('● neutron   ■ U-235 (orange)   ■ U-238 (grey)   red flash = fission', 12, usable - 6);
  }

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        chain.step(SPEED * dt);
        const ev = chain.events;
        for (let q = 0; q < fage.length; q++) fage[q] += dt;
        for (let j = 0; j < ev.length; j += 3) {
          fx[fi] = ev[j];
          fy[fi] = ev[j + 1];
          ft[fi] = ev[j + 2];
          fage[fi] = 0;
          fi = (fi + 1) % FL;
        }
        if (chain.overflow) {
          status = 'runaway: stopped at 4000 neutrons (supercritical)';
          ctrl.pause();
        } else if (chain.n === 0) {
          status = 'the chain reaction has died out';
          ctrl.pause();
        }
      },
      render: draw,
      sample: (t, out) => {
        out[0] = t;
        out[1] = chain.n;
      },
      reset: () => start(),
    },
    { dt: 1 / 120, channels, sampleInterval: 1 / 20, autoplay: true },
  );
  const palette = usePalette(() => ctrl);
  resetOn(ctrl, () => [params.R, params.e, params.shape, params.N0]);
  $effect(() => {
    void [params.R, params.e, params.shape, params.N0];
    if (ctx) ctrl.play();
  });

  const rows = $derived.by(() => {
    void ctrl.renderCount;
    const ks = chain.measuredK();
    const recent = ks.slice(1).slice(-4); // skip generation 0 (started at random points)
    const kAvg = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : NaN;
    const E = chain.fissions * MEV_PER_FISSION;
    return [
      { label: 'k∞ (no leakage)', value: fmt(kInfinity(params.e / 100), 3) },
      { label: 'measured k (last generations)', value: Number.isFinite(kAvg) ? fmt(kAvg, 3) : ks.length ? fmt(ks[ks.length - 1], 3) : '—', strong: true },
      {
        label: 'state',
        value: !Number.isFinite(kAvg) ? 'measuring…' : kAvg < 0.95 ? 'subcritical' : kAvg > 1.05 ? 'supercritical' : 'about critical',
      },
      { label: 'generations completed', value: String(ks.length) },
      { label: 'neutrons now', value: String(chain.n), color: '--series-1' },
      { label: 'fissions', value: String(chain.fissions) },
      { label: 'energy released', value: `${fmt(E, 3)} MeV = ${fmt(E * 1e6 * eCharge, 3)}`, unit: 'J' },
      { label: 'escaped / captured', value: `${chain.escaped} / ${chain.captured}` },
    ];
  });

  onMount(() => {
    start();
    ctrl.mount();
    return () => ctrl.destroy();
  });
</script>

<SimShell
  {entry}
  {ctrl}
  {info}
  {graphs}
  initialGraphs={['n']}
  {presets}
  onpreset={(id) => Object.assign(params, presets.find((q) => q.id === id)?.values ?? {})}
  stopwatch={false}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      label="Lump of uranium with neutrons causing fissions in a chain reaction"
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
      <Segmented
        label="Shape (same mass)"
        bind:value={params.shape}
        options={[
          { value: 'disc', label: 'Compact (disc)' },
          { value: 'plate', label: 'Flat plate' },
        ]}
      />
      <Slider def={sl('e')} bind:value={params.e} />
      <Slider def={sl('N0')} bind:value={params.N0} />
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

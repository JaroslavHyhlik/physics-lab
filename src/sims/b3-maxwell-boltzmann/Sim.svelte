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
  import { GASES, gasTimeStep, type GasConfig } from '../../physics/gas';
  import { createGasHandler, GAS_STRIDE, type GasSettings, type GasState } from '../../physics/gasState';
  import { maxwell, vMostProbable, vMean, vRms } from '../../physics/maxwell';
  import { StepClient } from '../../workers/stepClient';
  import { alpha } from '../../sim/palette';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const nm = 1e-9;
  const sliders: NumberParamDef[] = [{ key: 'T', label: 'Temperature (of the walls)', symbol: 'T', unit: 'K', min: 50, max: 1000, step: 10 }];
  const MIXES: Record<string, string[]> = { He: ['He'], Ar: ['Ar'], HeAr: ['He', 'Ar'], HeNeAr: ['He', 'Ne', 'Ar'] };
  const { params, sl } = useParams({ mix: 'HeAr', T: 300, start: 'same' }, sliders);
  const presets = [
    { id: 'relax', label: 'Same speed for all → Maxwell–Boltzmann', values: { mix: 'Ar', T: 300, start: 'same' } },
    { id: 'mix', label: 'Helium and argon at 300 K', values: { mix: 'HeAr', T: 300, start: 'mb' } },
    { id: 'three', label: 'Three noble gases', values: { mix: 'HeNeAr', T: 300, start: 'mb' } },
    { id: 'hot', label: 'Helium heated to 900 K', values: { mix: 'He', T: 900, start: 'mb' } },
  ];
  const PER = 150; // atoms of each gas
  const TIME_SCALE = 50e-12;
  const channels: ChannelDef[] = [
    { key: 't', label: 't', unit: 'ps' },
    { key: 'T', label: 'temperature of the gas', unit: 'K', color: '--series-4' },
    { key: 'v1', label: 'rms speed, lightest gas', unit: 'm s⁻¹', color: '--series-1' },
    { key: 'v2', label: 'rms speed, heaviest gas', unit: 'm s⁻¹', color: '--series-2' },
  ];
  const graphs: GraphDef[] = [
    { id: 'T', title: 'Temperature of the gas', series: ['T'] },
    { id: 'v', title: 'rms speeds', series: ['v1', 'v2'] },
  ];
  const info: SimInfo = {
    about: [
      'In a gas the atoms do not all move at the same speed. Collisions keep changing their speeds, and at a given temperature the speeds settle into a fixed spread: the Maxwell–Boltzmann distribution.',
      'Very slow and very fast atoms are rare. The most likely speed v_p is at the peak; the mean speed v̄ is a little higher; the root-mean-square speed v_rms = √⟨v²⟩ is higher still. v_rms is the one that gives the mean kinetic energy: ½m v_rms² = (3/2)k_BT.',
      'At the same temperature all gases have the same mean kinetic energy, so lighter atoms move faster: v_rms ∝ 1/√m. Helium atoms are about 3 times faster than argon atoms.',
      'Start every atom at the same speed: after hitting the warm walls the speeds spread out into the Maxwell–Boltzmann shape.',
    ],
    formulas: [
      { label: 'Mean kinetic energy', tex: '\\bar{E}_k = \\tfrac{1}{2}m\\overline{v^{2}} = \\tfrac{3}{2}k_BT' },
      { label: 'rms speed', tex: 'v_\\text{rms} = \\sqrt{\\dfrac{3k_BT}{m}}', beyond: true },
      { label: 'Most probable and mean speed', tex: 'v_p = \\sqrt{\\dfrac{2k_BT}{m}}, \\qquad \\bar{v} = \\sqrt{\\dfrac{8k_BT}{\\pi m}}', beyond: true },
      { label: 'Maxwell–Boltzmann distribution', tex: 'f(v) = 4\\pi\\left(\\dfrac{m}{2\\pi k_BT}\\right)^{3/2} v^{2}\\, e^{-mv^{2}/2k_BT}', beyond: true },
    ],
    assumptions: [
      'The same kinetic model as “Gas in a container”: 150 atoms of each gas in a 30 nm box (hard spheres, kinetic diameters from Breck 1974).',
      'The walls are kept at temperature T and send atoms back with speeds typical of T (in such a small box atoms meet the walls more often than each other).',
      'The bars are averaged over recent moments to reduce the noise of only 150 atoms per gas. The smooth curves are the theory at the wall temperature.',
      'Time is slowed down about 2 × 10¹⁰ times.',
    ],
    tryThis: [
      'Read v_p, v̄ and v_rms for argon from the curve and check them against the formulas.',
      'Double the absolute temperature. By what factor does v_rms change?',
      'Helium (4 u) and argon (40 u): predict the ratio of their rms speeds, then check.',
    ],
  };

  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;
  let gs: GasState | null = $state.raw(null);
  let owed = 0;
  let dtModel = gasTimeStep({ He: 1 });
  let lastSampled = -1;
  let client: StepClient<GasConfig, GasSettings, GasState> | null = null;
  const NB = 40;
  let hist: Float64Array[] = [];
  let histFrames = 0;
  const species = () => MIXES[params.mix] ?? ['Ar'];
  function restart() {
    const counts: Record<string, number> = {};
    for (const k of species()) counts[k] = PER;
    dtModel = gasTimeStep(counts);
    owed = 0;
    lastSampled = -1;
    hist = species().map(() => new Float64Array(NB));
    histFrames = 0;
    client?.reset({ counts, L: 30 * nm, Lx: 30 * nm, T0: params.T, seed: 2, sameSpeed: params.start === 'same' });
  }
  const settings = (): GasSettings => ({ LxTarget: 30 * nm, pistonSpeed: 30, bath: true, Tbath: params.T });
  let lastHistT = -1;

  function draw() {
    client?.flush();
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const usable = view.height - 76;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, view.height);
    const s = gs;
    if (!s) return;
    const sp = species().map((k) => GASES[k]);
    const cols = [pal.series[0], pal.series[1], pal.series[2]];
    const T = params.T;
    const vmax = 3.6 * vMostProbable(Math.max(T, s.T), sp[0].mass);
    const bw = vmax / NB;
    // update the averaged histogram once per new state
    if (s.t !== lastHistT && hist.length === sp.length) {
      lastHistT = s.t;
      const decay = histFrames < 20 ? 1 - 1 / (histFrames + 1) : 0.95;
      for (const h of hist) for (let k = 0; k < NB; k++) h[k] *= decay;
      const b = s.buf;
      for (let i = 0; i < s.N; i++) {
        const k = Math.floor(b[i * GAS_STRIDE + 3] / bw);
        const si = b[i * GAS_STRIDE + 4];
        if (k < NB && hist[si]) hist[si][k] += 1 - decay;
      }
      histFrames++;
    }
    // small box view
    const boxS = Math.min(160, usable * 0.4);
    const bx = 24;
    const by = 20;
    ctx.strokeStyle = pal.text2;
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, boxS, boxS);
    ctx.lineWidth = 1;
    const sc = boxS / s.L;
    const b = s.buf;
    for (let i = 0; i < s.N; i++) {
      const o = i * GAS_STRIDE;
      ctx.fillStyle = alpha(cols[b[o + 4]] ?? pal.series[0], 0.5 + 0.5 * (b[o + 2] / s.L));
      ctx.beginPath();
      ctx.arc(bx + b[o] * sc, by + boxS - b[o + 1] * sc, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    // legend
    ctx.font = '600 11px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    sp.forEach((g, i) => {
      ctx!.fillStyle = cols[i];
      ctx!.fillRect(bx, by + boxS + 18 + i * 18, 12, 12);
      ctx!.fillStyle = pal.text2;
      ctx!.fillText(`${g.name} (${(g.mass / 1.661e-27).toFixed(1)} u)`, bx + 18, by + boxS + 24 + i * 18);
    });
    // histogram + theory
    const wide = W > 700;
    const hx0 = wide ? bx + boxS + 70 : 60;
    const hx1 = W - 24;
    const hy0 = wide ? 160 : by + boxS + 30 + sp.length * 18;
    const hy1 = usable - 40;
    if (hy1 - hy0 < 60) return;
    let ymax = 0;
    sp.forEach((g, i) => {
      ymax = Math.max(ymax, maxwell(vMostProbable(T, g.mass), T, g.mass));
      for (let k = 0; k < NB; k++) ymax = Math.max(ymax, hist[i]?.[k] / (PER * bw) || 0);
    });
    ymax *= 1.1;
    const X = (v: number) => hx0 + (v / vmax) * (hx1 - hx0);
    const Y = (f: number) => hy1 - (f / ymax) * (hy1 - hy0);
    sp.forEach((g, i) => {
      const h = hist[i];
      if (!h) return;
      ctx!.fillStyle = alpha(cols[i].startsWith('#') ? cols[i] : '#3b82f6', 0.3);
      for (let k = 0; k < NB; k++) {
        const f = h[k] / (PER * bw);
        ctx!.fillRect(X(k * bw) + 1, Y(f), X(bw) - X(0) - 2, hy1 - Y(f));
      }
    });
    sp.forEach((g, i) => {
      ctx!.strokeStyle = cols[i];
      ctx!.lineWidth = 2.5;
      ctx!.beginPath();
      for (let k = 0; k <= 200; k++) {
        const v = (vmax * k) / 200;
        const y = Y(maxwell(v, T, g.mass));
        if (k === 0) ctx!.moveTo(X(v), y);
        else ctx!.lineTo(X(v), y);
      }
      ctx!.stroke();
      // v_p, v̄, v_rms markers
      ctx!.lineWidth = 1;
      ctx!.setLineDash([3, 3]);
      const marks: [number, string][] = [
        [vMostProbable(T, g.mass), 'vₚ'],
        [vMean(T, g.mass), 'v̄'],
        [vRms(T, g.mass), 'v_rms'],
      ];
      marks.forEach(([v, lab], j) => {
        if (v > vmax) return;
        ctx!.beginPath();
        ctx!.moveTo(X(v), hy1);
        ctx!.lineTo(X(v), Y(maxwell(v, T, g.mass)));
        ctx!.stroke();
        ctx!.fillStyle = cols[i];
        ctx!.font = '600 10px Inter Variable, system-ui, sans-serif';
        ctx!.textAlign = 'center';
        ctx!.textBaseline = 'bottom';
        ctx!.fillText(lab, X(v), Y(maxwell(v, T, g.mass)) - 4 - j * 11);
      });
      ctx!.setLineDash([]);
    });
    ctx.strokeStyle = pal.gridStrong;
    ctx.beginPath();
    ctx.moveTo(hx0, hy0);
    ctx.lineTo(hx0, hy1);
    ctx.lineTo(hx1, hy1);
    ctx.stroke();
    ctx.fillStyle = pal.text3;
    ctx.font = '500 10px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let k = 0; k <= 5; k++) {
      const v = (vmax * k) / 5;
      ctx.fillText(`${Math.round(v)}`, X(v), hy1 + 4);
    }
    ctx.fillText('speed v / m s⁻¹', (hx0 + hx1) / 2, hy1 + 18);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('fraction of atoms per unit speed (bars: simulation, curves: theory at T)', hx0, hy0 - 6);
  }

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        owed += TIME_SCALE * dt;
        const n = Math.floor(owed / dtModel);
        if (n > 0) {
          owed -= n * dtModel;
          client?.add(n);
        }
      },
      render: draw,
      sample: (_t, out) => {
        const s = gs;
        if (!s || s.t === lastSampled) return false;
        lastSampled = s.t;
        out[0] = s.t * 1e12;
        out[1] = s.T;
        // rms speeds of the first and last species from the snapshot
        const sums = [0, 0, 0];
        const cnt = [0, 0, 0];
        for (let i = 0; i < s.N; i++) {
          const si = s.buf[i * GAS_STRIDE + 4];
          sums[si] += s.buf[i * GAS_STRIDE + 3] ** 2;
          cnt[si]++;
        }
        const last = species().length - 1;
        out[2] = Math.sqrt(sums[0] / Math.max(1, cnt[0]));
        out[3] = Math.sqrt(sums[last] / Math.max(1, cnt[last]));
      },
      reset: () => restart(),
    },
    { dt: 1 / 600, channels, sampleInterval: 1 / 15, autoplay: true },
  );
  const palette = usePalette(() => ctrl);
  resetOn(ctrl, () => [params.mix, params.start]);

  const rows = $derived.by(() => {
    const s = gs;
    if (!s) return [];
    const sp = species().map((k) => GASES[k]);
    const out: { label: string; value: string; unit?: string; color?: string; strong?: boolean }[] = [
      { label: 'gas temperature (from ⟨½mv²⟩)', value: s.T.toFixed(0), unit: 'K', strong: true },
    ];
    sp.forEach((g, i) => {
      let s2 = 0;
      let n = 0;
      for (let k = 0; k < s.N; k++) {
        if (s.buf[k * GAS_STRIDE + 4] !== i) continue;
        s2 += s.buf[k * GAS_STRIDE + 3] ** 2;
        n++;
      }
      out.push({
        label: `${g.symbol}: v_rms measured / theory`,
        value: `${fmt(Math.sqrt(s2 / Math.max(1, n)), 3)} / ${fmt(vRms(params.T, g.mass), 3)}`,
        unit: 'm s⁻¹',
        color: `--series-${i + 1}`,
      });
    });
    return out;
  });

  onMount(() => {
    client = new StepClient<GasConfig, GasSettings, GasState>(
      () => new Worker(new URL('../../workers/gas.worker.ts', import.meta.url), { type: 'module' }),
      createGasHandler,
      settings,
      (r) => {
        gs = r;
        if (!ctrl.running) ctrl.invalidate();
      },
    );
    restart();
    ctrl.mount();
    client.flush();
    return () => {
      ctrl.destroy();
      client?.destroy();
    };
  });
</script>

<SimShell
  {entry}
  {ctrl}
  {info}
  {graphs}
  initialGraphs={['T', 'v']}
  {presets}
  onpreset={(id) => Object.assign(params, presets.find((p) => p.id === id)?.values ?? {})}
  stopwatch={false}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      label="Speed distribution of gas atoms compared with the Maxwell–Boltzmann curve"
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
        label="Gases"
        bind:value={params.mix}
        options={[
          { value: 'He', label: 'He' },
          { value: 'Ar', label: 'Ar' },
          { value: 'HeAr', label: 'He + Ar' },
          { value: 'HeNeAr', label: 'He + Ne + Ar' },
        ]}
      />
      <Slider def={sl('T')} bind:value={params.T} />
      <Segmented
        label="Start with"
        bind:value={params.start}
        options={[
          { value: 'same', label: 'One speed' },
          { value: 'mb', label: 'Maxwell–Boltzmann' },
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

<script lang="ts">
  import { onMount } from 'svelte';
  import SimShell from '../../sim/SimShell.svelte';
  import SimCanvas from '../../sim/SimCanvas.svelte';
  import Readouts from '../../sim/Readouts.svelte';
  import Slider from '../../ui/Slider.svelte';
  import Segmented from '../../ui/Segmented.svelte';
  import Toggle from '../../ui/Toggle.svelte';
  import { SimController } from '../../sim/controller.svelte';
  import { useParams, usePalette, resetOn } from '../../sim/setup.svelte';
  import { View } from '../../sim/view';
  import { Interaction } from '../../sim/interaction';
  import type { SimEntry } from '../../app/registry';
  import type { NumberParamDef } from '../../sim/params.svelte';
  import type { SimInfo, GraphDef } from '../../sim/types';
  import type { ChannelDef } from '../../core/recorder';
  import { GASES, gasTimeStep, type GasConfig } from '../../physics/gas';
  import { createGasHandler, GAS_STRIDE, type GasSettings, type GasState } from '../../physics/gasState';
  import { StepClient } from '../../workers/stepClient';
  import { alpha } from '../../sim/palette';
  import { drawTag } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const nm = 1e-9;
  const sliders: NumberParamDef[] = [
    { key: 'N', label: 'Number of atoms', symbol: 'N', unit: '', min: 20, max: 400, step: 10 },
    { key: 'Lx', label: 'Length of the box (piston position)', symbol: 'x', unit: 'nm', min: 10, max: 40, step: 0.5 },
    { key: 'Tb', label: 'Heat bath temperature', symbol: 'T_bath', unit: 'K', min: 50, max: 1000, step: 10 },
  ];
  const { params, sl } = useParams({ gas: 'He', N: 200, Lx: 30, fast: false, bath: false, Tb: 600 }, sliders);
  const presets = [
    { id: 'base', label: '200 helium atoms at 300 K', values: { gas: 'He', N: 200, Lx: 30, bath: false } },
    { id: 'boyle', label: 'Halve the volume (insulated)', values: { gas: 'He', N: 200, Lx: 15, bath: false, fast: false } },
    { id: 'iso', label: 'Halve the volume at constant T', values: { gas: 'He', N: 200, Lx: 15, bath: true, Tb: 300, fast: false } },
    { id: 'heat', label: 'Heat the gas to 600 K', values: { gas: 'He', N: 200, Lx: 30, bath: true, Tb: 600 } },
    { id: 'xe', label: 'Xenon: heavy, slow atoms', values: { gas: 'Xe', N: 200, Lx: 30, bath: false } },
  ];
  const T0 = 300;
  const L = 30 * nm;
  /** simulated time per second of animation */
  const TIME_SCALE = 50e-12;
  const channels: ChannelDef[] = [
    { key: 't', label: 't', unit: 'ps' },
    { key: 'pm', label: 'pressure measured from impacts', unit: 'kPa', color: '--series-1' },
    { key: 'pi', label: 'NkT/V', unit: 'kPa', color: '--series-4', dash: [6, 4] },
    { key: 'T', label: 'temperature T', unit: 'K', color: '--series-4' },
    { key: 'V', label: 'volume V', unit: '10⁻²³ m³', color: '--series-2' },
  ];
  const graphs: GraphDef[] = [
    { id: 'p', title: 'Pressure', series: ['pm', 'pi'] },
    { id: 'T', title: 'Temperature', series: ['T'] },
    { id: 'V', title: 'Volume', series: ['V'] },
  ];
  const info: SimInfo = {
    about: [
      'A gas is made of atoms moving in random directions at high speed. Each time an atom hits a wall it pushes on it: the change of its momentum, 2mv, divided by the time between hits gives a force. Millions of hits per nanosecond add up to a steady pressure, p = F/A.',
      'Here 20–400 noble-gas atoms move in a box only 30 nm across. The gauge measures the pressure directly from the impacts on all six walls; compare it with the ideal-gas value p = NkT/V.',
      'Temperature measures the average kinetic energy of the atoms: ⟨½mv²⟩ = (3/2)k_BT. Push the piston in: atoms bounce off the moving piston faster, so the gas warms up (work is done on it). With the heat bath on, the gas keeps its temperature instead.',
    ],
    formulas: [
      { label: 'Pressure', tex: 'P = \\dfrac{F}{A}' },
      { label: 'Ideal gas', tex: 'PV = Nk_BT = nRT' },
      { label: 'Pressure from the motion of particles', tex: 'P = \\tfrac{1}{3}\\rho \\overline{v^{2}}' },
      { label: 'Mean kinetic energy', tex: '\\bar{E}_k = \\tfrac{3}{2}k_BT' },
      { label: 'Internal energy (monatomic)', tex: 'U = \\tfrac{3}{2}Nk_BT' },
    ],
    assumptions: [
      'Atoms are hard spheres with their kinetic diameters (He 0.26 nm, Ne 0.275 nm, Ar 0.34 nm, Xe 0.40 nm; Breck 1974). They are drawn much larger than to scale; the picture shows the box from the side (depth by shading).',
      'In such a tiny box the atoms hit the walls far more often than each other. The fixed walls are rough: they send each atom off in a random direction without changing its speed. The piston is smooth.',
      'The heat bath (left wall) sends atoms back with speeds typical of its temperature. When it is off, the box is insulated.',
      'Time is slowed down about 2 × 10¹⁰ times (50 ps per second). Pressure is averaged over the last 10 ps.',
      'The atoms are classical; no forces between atoms except at contact (ideal gas apart from their small size).',
    ],
    tryThis: [
      'Halve the volume with the heat bath on at 300 K. What happens to the pressure? (Boyle’s law)',
      'Halve the volume with the bath off. Why does the pressure rise by more than 2 times?',
      'Compare helium and xenon at the same temperature: which atoms are faster? Is the pressure different?',
      'Check that p measured ≈ NkT/V for different numbers of atoms.',
    ],
  };

  const view = new View();
  const inter = new Interaction();
  let ctx: CanvasRenderingContext2D | null = null;
  let gs: GasState | null = $state.raw(null);
  let owed = 0;
  let dtModel = gasTimeStep({ He: 200 });
  let lastSampled = -1;
  const settings = (): GasSettings => ({ LxTarget: params.Lx * nm, pistonSpeed: params.fast ? 300 : 30, bath: params.bath, Tbath: params.Tb });
  let client: StepClient<GasConfig, GasSettings, GasState> | null = null;
  function restart() {
    const cfg: GasConfig = { counts: { [params.gas]: params.N }, L, Lx: params.Lx * nm, T0, seed: 1 };
    dtModel = gasTimeStep(cfg.counts);
    owed = 0;
    lastSampled = -1;
    client?.reset(cfg);
  }

  // drawing geometry (set in draw, used by the piston drag)
  const geo = { bx: 0, by: 0, sc: 1, h: 0 };
  inter.add({
    priority: 10,
    cursor: 'ew-resize',
    hit: (px, py) => {
      if (!gs) return Infinity;
      const xp = geo.bx + gs.Lx * geo.sc;
      return py > geo.by - 10 && py < geo.by + geo.h + 10 ? Math.abs(px - xp - 6) : Infinity;
    },
    move: (px) => {
      const v = (px - geo.bx) / geo.sc / nm;
      params.Lx = Math.round(Math.max(10, Math.min(40, v)) * 2) / 2;
    },
  });

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
    const wide = W > 760;
    const maxLen = 40 * nm;
    const sc = Math.min(((wide ? W - 300 : W - 60) - 40) / maxLen, (usable - 60) / s.L);
    const bx = 40;
    const by = Math.max(20, (usable - s.L * sc) / 2);
    geo.bx = bx;
    geo.by = by;
    geo.sc = sc;
    geo.h = s.L * sc;
    const bw = s.Lx * sc;
    const bh = s.L * sc;
    // box
    ctx.fillStyle = alpha(pal.text3.startsWith('#') ? pal.text3 : '#888888', 0.06);
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = pal.text2;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bx + bw, by);
    ctx.lineTo(bx, by);
    ctx.lineTo(bx, by + bh);
    ctx.lineTo(bx + bw, by + bh);
    ctx.stroke();
    // heat bath on the left wall
    if (params.bath) {
      const col = params.Tb >= s.T ? pal.series[3] : pal.series[0];
      ctx.fillStyle = col;
      ctx.fillRect(bx - 10, by, 8, bh);
      ctx.save();
      ctx.translate(bx - 16, by + bh / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = col;
      ctx.font = '600 11px Inter Variable, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`heat bath ${params.Tb} K`, 0, 0);
      ctx.restore();
    }
    // atoms (side view, nearer ones darker and larger)
    const b = s.buf;
    const cols = [pal.series[0], pal.series[1], pal.series[2], pal.series[4]];
    const rBase = Math.max(2.5, Math.min(5, bh / 70));
    for (let i = 0; i < s.N; i++) {
      const o = i * GAS_STRIDE;
      const depth = b[o + 2] / s.L; // 0 far … 1 near
      ctx.fillStyle = alpha(cols[b[o + 4]] ?? pal.series[0], 0.45 + 0.55 * depth);
      ctx.beginPath();
      ctx.arc(bx + b[o] * sc, by + bh - b[o + 1] * sc, rBase * (0.8 + 0.4 * depth), 0, Math.PI * 2);
      ctx.fill();
    }
    // piston
    ctx.fillStyle = pal.text2;
    ctx.fillRect(bx + bw, by - 6, 10, bh + 12);
    ctx.fillRect(bx + bw + 10, by + bh / 2 - 4, 40, 8);
    ctx.beginPath();
    ctx.roundRect(bx + bw + 46, by + bh / 2 - 16, 12, 32, 4);
    ctx.fill();
    // gauge
    const gx = wide ? W - 150 : W - 70;
    const gy = wide ? by + 210 : by + bh + 34;
    const gr = wide ? 60 : 0;
    if (gr > 0) {
      const pmax = Math.max(200, Math.ceil((1.3 * Math.max(s.pIdeal, s.pMeasured || 0)) / 1000 / 50) * 50);
      const ang = (p: number) => Math.PI * (0.75 + 1.5 * Math.min(1, p / 1000 / pmax));
      ctx.strokeStyle = pal.text2;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(gx, gy, gr, Math.PI * 0.75, Math.PI * 2.25);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.fillStyle = pal.text3;
      ctx.font = '500 10px Inter Variable, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let k = 0; k <= 4; k++) {
        const a = Math.PI * (0.75 + (1.5 * k) / 4);
        ctx.fillText(`${Math.round((pmax * k) / 4)}`, gx + Math.cos(a) * (gr + 14), gy + Math.sin(a) * (gr + 14));
      }
      ctx.fillText('kPa', gx, gy + gr * 0.55);
      // ideal value mark and measured needle
      const ai = ang(s.pIdeal);
      ctx.strokeStyle = pal.series[3];
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(gx + Math.cos(ai) * (gr - 10), gy + Math.sin(ai) * (gr - 10));
      ctx.lineTo(gx + Math.cos(ai) * gr, gy + Math.sin(ai) * gr);
      ctx.stroke();
      if (Number.isFinite(s.pMeasured)) {
        const am = ang(s.pMeasured);
        ctx.strokeStyle = pal.series[0];
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.lineTo(gx + Math.cos(am) * (gr - 6), gy + Math.sin(am) * (gr - 6));
        ctx.stroke();
      }
      ctx.lineWidth = 1;
      ctx.fillStyle = pal.text2;
      ctx.beginPath();
      ctx.arc(gx, gy, 4, 0, Math.PI * 2);
      ctx.fill();
      drawTag(ctx, gx, gy + gr + 26, 'needle: measured · red mark: NkT/V', pal.text2, pal.surface);
    }
    ctx.fillStyle = pal.text3;
    ctx.font = '500 10px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`box ${fmt(s.Lx / nm, 3)} nm × 30 nm × 30 nm · drag the piston`, bx, by + bh + 10);
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
        out[1] = s.pMeasured / 1000;
        out[2] = s.pIdeal / 1000;
        out[3] = s.T;
        out[4] = s.V / 1e-23;
      },
      reset: () => restart(),
    },
    { dt: 1 / 600, channels, sampleInterval: 1 / 15, autoplay: true },
  );
  const palette = usePalette(() => ctrl);
  resetOn(ctrl, () => [params.gas, params.N]);
  inter.onChange = () => ctrl.invalidate();

  const rows = $derived.by(() => {
    const s = gs;
    if (!s) return [];
    return [
      { label: 'temperature T', value: s.T.toFixed(0), unit: 'K', color: '--series-4' },
      { label: 'volume V', value: fmt(s.V, 3), unit: 'm³' },
      { label: 'p measured', value: Number.isFinite(s.pMeasured) ? fmt(s.pMeasured / 1000, 3) : '—', unit: 'kPa', color: '--series-1', strong: true },
      { label: 'p = NkT/V', value: fmt(s.pIdeal / 1000, 3), unit: 'kPa', strong: true },
      { label: 'rms speed √⟨v²⟩', value: fmt(Math.sqrt((2 * s.KE) / s.N / s.masses[0]), 3), unit: 'm s⁻¹' },
      { label: 'work on gas W / heat in Q', value: `${fmt(s.W, 2)} / ${fmt(s.Q, 2)}`, unit: 'J' },
    ];
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
  initialGraphs={['p', 'T']}
  {presets}
  onpreset={(id) => Object.assign(params, presets.find((p) => p.id === id)?.values ?? {})}
  stopwatch={false}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      interaction={inter}
      label="Gas atoms in a box with a piston and a pressure gauge"
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
        bind:value={params.gas}
        options={Object.values(GASES).map((g) => ({ value: g.symbol, label: g.name }))}
      />
      <Slider def={sl('N')} bind:value={params.N} />
      <Slider def={sl('Lx')} bind:value={params.Lx} />
      <Toggle label="Move the piston quickly" hint="300 m s⁻¹ instead of 30 m s⁻¹" bind:checked={params.fast} />
      <Toggle label="Heat bath on the left wall" hint="Off = insulated box" bind:checked={params.bath} />
      {#if params.bath}<Slider def={sl('Tb')} bind:value={params.Tb} />{/if}
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

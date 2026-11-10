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
  import { MDSystem, ARGON, mb2d, type MDConfig } from '../../physics/lennardJones';
  import { packState, type MDRequest, type MDState } from '../../physics/mdState';
  import { k_B, eV } from '../../core/constants';
  import { alpha } from '../../sim/palette';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [
    { key: 'T', label: 'Temperature to hold', symbol: 'T', unit: 'K', min: 5, max: 300, step: 1 },
    { key: 'q', label: 'Heating rate per particle', symbol: 'P', unit: 'meV ps⁻¹', min: -2, max: 2, step: 0.05, hint: 'negative = cooling' },
  ];
  const { params, sl } = useParams({ mode: 'thermostat', T: 20, q: 0.2, start: 'solid' }, sliders);
  const presets = [
    { id: 'solid', label: 'Solid: crystal at 20 K', values: { mode: 'thermostat', T: 20, start: 'solid' } },
    { id: 'liquid', label: 'Liquid drop at 55 K', values: { mode: 'thermostat', T: 55, start: 'solid' } },
    { id: 'gas', label: 'Gas at 160 K', values: { mode: 'thermostat', T: 160, start: 'gas' } },
    { id: 'heat', label: 'Heat a crystal at a constant rate', values: { mode: 'power', q: 0.2, T: 20, start: 'solid' } },
    { id: 'cool', label: 'Cool a gas until it condenses', values: { mode: 'power', q: -0.2, T: 160, start: 'gas' } },
  ];
  const N = 250;
  const BOX = 30; // σ
  const MS = 1e12; // s → ps
  const meV = 1e-3 * eV;
  const channels: ChannelDef[] = [
    { key: 't', label: 't', unit: 'ps' },
    { key: 'T', label: 'temperature T', unit: 'K', color: '--series-4' },
    { key: 'ke', label: 'kinetic energy per particle', unit: 'meV', color: '--series-4' },
    { key: 'pe', label: 'potential energy per particle', unit: 'meV', color: '--series-1' },
    { key: 'e', label: 'internal energy per particle', unit: 'meV', color: '--series-3' },
  ];
  const graphs: GraphDef[] = [
    { id: 'T', title: 'Temperature', series: ['T'] },
    { id: 'E', title: 'Energy per particle', series: ['ke', 'pe', 'e'] },
  ];
  const info: SimInfo = {
    about: [
      'Matter is made of particles that attract each other when a little apart and repel strongly when pushed together. Here 250 argon atoms move in a flat box and interact with a Lennard-Jones force.',
      'Cold: the particles vibrate about fixed positions in a regular pattern — a solid. Warmer: they slide past each other but stay together — a liquid drop. Hot: they fly apart and fill the box — a gas.',
      'Temperature is a measure of the average random kinetic energy of the particles. In this flat (2D) world each particle has two directions to move in, so its mean kinetic energy is k_BT (in 3D it is 3/2 k_BT).',
      'The internal energy is the total of the random kinetic energy and the potential energy of the particles. When a solid melts or a liquid boils at a constant heating rate, the energy mostly goes into potential energy (breaking bonds), so the temperature rises much more slowly.',
    ],
    formulas: [
      { label: 'Mean kinetic energy (3D, booklet)', tex: '\\bar{E}_k = \\tfrac{3}{2}k_B T' },
      { label: 'Mean kinetic energy in this 2D model', tex: '\\bar{E}_k = k_B T', beyond: true },
      { label: 'Internal energy', tex: 'U = \\sum E_k + \\sum E_p', beyond: true },
      { label: 'Lennard-Jones potential energy of a pair', tex: 'E_p = 4\\varepsilon\\left[\\left(\\tfrac{\\sigma}{r}\\right)^{12} - \\left(\\tfrac{\\sigma}{r}\\right)^{6}\\right]', beyond: true },
    ],
    assumptions: [
      'A two-dimensional model: real matter is 3D, so melting and boiling temperatures here are not those of real argon (2D argon melts at about 50 K).',
      'Argon atoms: σ = 3.4 × 10⁻¹⁰ m, ε = 1.65 × 10⁻²¹ J (ε/k_B ≈ 120 K), m = 6.63 × 10⁻²⁶ kg (typical literature values). The force is cut off beyond 2.5σ.',
      'Classical mechanics (velocity Verlet, time step 9 fs); smooth repulsive walls; no gravity.',
      '“Temperature to hold” rescales the velocities gently towards the target (Berendsen thermostat); “Heat at a constant rate” adds a fixed amount of kinetic energy per step.',
      'Time is slowed down about 10¹¹ times; atoms are drawn with diameter ≈ σ. The state label is only a rough guide from the number of close neighbours.',
    ],
    tryThis: [
      'Heat the crystal at a constant rate and watch the temperature graph. Where does it rise more slowly, and what are the particles doing then?',
      'Compare the mean kinetic energy per particle with k_BT in the readouts.',
      'At 160 K, compare the histogram of speeds with the smooth Maxwell–Boltzmann curve.',
      'Cool the gas: what happens to the potential energy when a drop forms?',
    ],
  };

  // ---------- worker client ----------
  let md: MDState | null = $state.raw(null);
  let pendingSteps = 0;
  let resetCfg: MDConfig | null = null;
  let busy = false;
  let reqId = 0;
  let spare: Float32Array | undefined;
  let worker: Worker | null = null;
  let local: MDSystem | null = null;
  let lastSampled = -1;

  function onState(s: MDState) {
    busy = false;
    md = s;
    if (ctrl && !ctrl.running) ctrl.invalidate();
    flush();
  }
  function flush() {
    if (busy || (!resetCfg && pendingSteps === 0)) return;
    const req: MDRequest = {
      id: ++reqId,
      reset: resetCfg ?? undefined,
      steps: Math.min(pendingSteps, 2000),
      mode: params.mode,
      Ttarget: params.T,
      power: (params.q * meV) / 1e-12,
    };
    resetCfg = null;
    pendingSteps = 0;
    if (worker) {
      busy = true;
      if (spare && md && spare.length === 3 * md.N) req.buf = spare;
      spare = undefined;
      worker.postMessage(req, req.buf ? [req.buf.buffer] : []);
    } else {
      if (req.reset) local = new MDSystem(req.reset);
      if (!local) return;
      local.mode = req.mode as MDSystem['mode'];
      local.Ttarget = req.Ttarget;
      local.power = req.power;
      for (let i = 0; i < req.steps; i++) local.step();
      onState(packState(local, req.id, md?.buf));
    }
  }
  function restart() {
    resetCfg = { N, boxSigma: BOX, seed: 1, T0: params.start === 'gas' ? 160 : Math.min(params.T, 20), start: params.start as 'solid' | 'gas' };
    pendingSteps = 0;
    lastSampled = -1;
  }

  // ---------- drawing ----------
  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;
  const hist = new Float64Array(30);

  function draw() {
    flush();
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const usable = view.height - 76;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, view.height);
    const s = md;
    if (!s) return;
    const wide = W > 760;
    const side = Math.min(wide ? W * 0.55 : Math.min(W - 32, usable * 0.6), usable - 24);
    const bx = wide ? 24 : 16;
    const by = 12;
    const sc = side / s.L;
    ctx.strokeStyle = pal.text2;
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, side, side);
    ctx.lineWidth = 1;
    // particles coloured by speed
    const hot = pal.series[3].startsWith('#') ? pal.series[3] : '#e11d48';
    const vref = Math.sqrt((2 * k_B * Math.max(s.T, 1)) / ARGON.mass); // rms speed
    const r = Math.max(1.5, 0.5 * ARGON.sigma * sc);
    const b = s.buf;
    for (let i = 0; i < s.N; i++) {
      const px = bx + b[3 * i] * sc;
      const py = by + side - b[3 * i + 1] * sc;
      ctx.fillStyle = pal.series[0];
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
      const f = Math.min(1, b[3 * i + 2] / (2 * vref));
      if (f > 0.05) {
        ctx.fillStyle = alpha(hot, f);
        ctx.fill();
      }
    }
    // speed histogram with the 2D Maxwell–Boltzmann curve
    const hx0 = wide ? bx + side + 70 : bx + 50;
    const hx1 = wide ? W - 24 : bx + side;
    const hy0 = wide ? by + 150 : by + side + 30;
    const hy1 = wide ? Math.min(by + side, hy0 + 240) : usable - 10;
    if (hy1 - hy0 < 50 || hx1 - hx0 < 80) return;
    const vmax = 3.2 * Math.sqrt((k_B * Math.max(s.T, 1)) / ARGON.mass) * 1.25;
    hist.fill(0);
    const nb = hist.length;
    for (let i = 0; i < s.N; i++) {
      const k = Math.floor((b[3 * i + 2] / vmax) * nb);
      if (k < nb) hist[k]++;
    }
    const bw = vmax / nb;
    let ymax = 0;
    for (let k = 0; k < nb; k++) ymax = Math.max(ymax, hist[k] / (s.N * bw));
    const peak = mb2d(Math.sqrt((k_B * Math.max(s.T, 1)) / ARGON.mass), Math.max(s.T, 1));
    ymax = Math.max(ymax, peak) * 1.15;
    const X = (v: number) => hx0 + (v / vmax) * (hx1 - hx0);
    const Y = (f: number) => hy1 - (f / ymax) * (hy1 - hy0);
    ctx.fillStyle = alpha(pal.series[0].startsWith('#') ? pal.series[0] : '#3b82f6', 0.45);
    for (let k = 0; k < nb; k++) {
      const h = hist[k] / (s.N * bw);
      ctx.fillRect(X(k * bw) + 1, Y(h), X(bw) - X(0) - 2, hy1 - Y(h));
    }
    ctx.strokeStyle = pal.series[3];
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 80; i++) {
      const v = (vmax * i) / 80;
      const y = Y(mb2d(v, Math.max(s.T, 1)));
      if (i === 0) ctx.moveTo(X(v), y);
      else ctx.lineTo(X(v), y);
    }
    ctx.stroke();
    ctx.lineWidth = 1;
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
    for (let i = 0; i <= 4; i++) {
      const v = (vmax * i) / 4;
      ctx.fillText(`${Math.round(v)}`, X(v), hy1 + 4);
    }
    ctx.fillText('speed / m s⁻¹', (hx0 + hx1) / 2, hy1 + 18);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('share of particles (bars) and Maxwell–Boltzmann curve at T', hx0, hy0 - 6);
  }

  const ctrl: SimController = new SimController(
    {
      step: () => {
        pendingSteps++;
      },
      render: draw,
      sample: (_t, out) => {
        const s = md;
        if (!s || s.t === lastSampled) return false;
        lastSampled = s.t;
        out[0] = s.t * MS;
        out[1] = s.T;
        out[2] = s.KE / s.N / meV;
        out[3] = s.PE / s.N / meV;
        out[4] = (s.KE + s.PE) / s.N / meV;
      },
      reset: () => restart(),
    },
    // one controller step = one MD step; 1200 per second of animation ≈ 10 ps per second
    { dt: 1 / 1200, channels, sampleInterval: 1 / 15, maxSubsteps: 2000, autoplay: true },
  );
  const palette = usePalette(() => ctrl);
  resetOn(ctrl, () => params.start);

  const stateLabel = (n: number) => (n > 5.2 ? 'solid-like' : n > 2 ? 'liquid-like' : 'gas-like');
  const rows = $derived.by(() => {
    const s = md;
    if (!s) return [];
    const ke = s.KE / s.N / meV;
    return [
      { label: 'temperature T', value: s.T.toFixed(1), unit: 'K', color: '--series-4', strong: true },
      { label: 'mean Eₖ / k_BT', value: `${fmt(ke, 3)} / ${fmt((k_B * s.T) / meV, 3)}`, unit: 'meV' },
      { label: 'mean Eₚ per particle', value: fmt(s.PE / s.N / meV, 3), unit: 'meV', color: '--series-1' },
      { label: 'neighbours (rough state)', value: `${s.neighbours.toFixed(1)} · ${stateLabel(s.neighbours)}` },
    ];
  });

  onMount(() => {
    try {
      worker = new Worker(new URL('../../workers/md.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (e: MessageEvent<MDState>) => {
        spare = md?.buf;
        onState(e.data);
      };
      worker.onerror = () => {
        worker?.terminate();
        worker = null;
        busy = false;
        restart();
      };
    } catch {
      worker = null;
    }
    restart();
    ctrl.mount();
    flush();
    return () => {
      ctrl.destroy();
      worker?.terminate();
    };
  });
</script>

<SimShell
  {entry}
  {ctrl}
  {info}
  {graphs}
  initialGraphs={['T', 'E']}
  {presets}
  onpreset={(id) => Object.assign(params, presets.find((p) => p.id === id)?.values ?? {})}
  stopwatch={false}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      label="Particle model: argon atoms forming a solid, liquid or gas"
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
        label="Heating"
        bind:value={params.mode}
        options={[
          { value: 'thermostat', label: 'Hold T' },
          { value: 'power', label: 'Constant rate' },
          { value: 'off', label: 'Isolated' },
        ]}
      />
      {#if params.mode === 'thermostat'}
        <Slider def={sl('T')} bind:value={params.T} />
      {:else if params.mode === 'power'}
        <Slider def={sl('q')} bind:value={params.q} />
      {:else}
        <p class="tip">No energy in or out: the total energy stays constant.</p>
      {/if}
      <Segmented
        label="Start from"
        bind:value={params.start}
        options={[
          { value: 'solid', label: 'Crystal' },
          { value: 'gas', label: 'Gas' },
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
  .tip {
    font-size: var(--text-xs);
    color: var(--text-3);
  }
</style>

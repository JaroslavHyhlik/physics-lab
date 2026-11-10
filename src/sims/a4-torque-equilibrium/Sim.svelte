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
  import { Interaction } from '../../sim/interaction';
  import type { SimEntry } from '../../app/registry';
  import { Beam, beamTorque, ladderForces, type BeamParams, type LadderParams } from '../../physics/torque';
  import { fmt } from '../../core/format';
  import { Ruler } from '../../tools/ruler';
  import { drawBeam, drawLadder, beamPoint, blockSize } from './render';
  import * as M from './meta';

  let { entry }: { entry: SimEntry } = $props();
  const deg = Math.PI / 180;
  const { params, sl } = useParams(M.defaults, M.sliders);
  const bp = (): BeamParams => ({
    L: 4,
    mb: params.mb,
    xp: params.xp,
    masses: [
      { m: params.m1, x: params.x1 },
      { m: params.m2, x: params.x2 },
      { m: params.m3, x: params.x3 },
    ],
    g: params.g,
    thetaMax: 15 * deg,
  });
  const lp = (): LadderParams => ({ L: params.lL, theta: params.lth * deg, m: params.lm, M: params.lM, d: Math.min(params.ld, params.lL), mu: params.lmu, g: params.g });
  const beam = new Beam(bp());
  const view = new View();
  const inter = new Interaction();
  const ruler = new Ruler(-1, 0.1, 1, 0.1);
  let ctx: CanvasRenderingContext2D | null = null;

  const fitView = () => {
    if (params.mode === 'beam') view.fit(-2.6, 2.6, -0.6, 2.2, 20, 80);
    else view.fit(-params.lL - 0.8, 1.2, -0.6, params.lL + 0.4, 20, 80);
  };

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        if (params.mode === 'beam') beam.step(dt);
        if (beam.resting && beam.t > 0.5) ctrl.pause();
      },
      render: () => {
        if (!ctx) return;
        if (params.mode === 'beam') drawBeam(ctx, view, beam, palette.pal);
        else drawLadder(ctx, view, lp(), palette.pal);
        ruler.draw(ctx, view, palette.pal);
      },
      sample: (t, out) => {
        out[0] = t;
        out[1] = (beam.theta * 180) / Math.PI;
        out[2] = beam.resting ? 0 : beamTorque(beam.p, beam.theta);
      },
      reset: () => {
        beam.reset(bp());
        fitView();
      },
    },
    { dt: 1e-3, channels: M.channels, sampleInterval: 1 / 60, autoplay: true },
  );
  const palette = usePalette(() => ctrl);
  resetOn(ctrl, () => [params.mode, params.m1, params.x1, params.m2, params.x2, params.m3, params.x3, params.xp, params.mb, params.g, params.lL, params.lth, params.lm, params.lM, params.ld, params.lmu]);
  $effect(() => {
    void [params.mode, params.m1, params.x1, params.m2, params.x2, params.m3, params.x3, params.xp, params.mb, params.g];
    if (ctx && !dragging) ctrl.play();
  });

  // drag the masses along the beam (the beam is held level while dragging)
  let dragging = false;
  const keys = ['x1', 'x2', 'x3'] as const;
  const mkeys = ['m1', 'm2', 'm3'] as const;
  keys.forEach((k, i) => {
    inter.add({
      priority: 10,
      cursor: 'ew-resize',
      hit: (px, py) => {
        if (params.mode !== 'beam' || params[mkeys[i]] <= 0) return Infinity;
        const s = blockSize(params[mkeys[i]]);
        const [cx, cy] = beamPoint(beam, params[k], s / 2 + 0.04);
        return Math.hypot(px - view.sx(cx), py - view.sy(cy)) - (s / 2) * view.scale;
      },
      start: () => {
        dragging = true;
        ctrl.pause();
      },
      move: (px) => {
        params[k] = Math.round(Math.max(-2, Math.min(2, view.wx(px))) * 20) / 20;
      },
      end: () => {
        dragging = false;
        ctrl.reset();
        ctrl.play();
      },
    });
  });
  ruler.attach(view, inter);
  inter.onChange = () => ctrl.invalidate();

  const rows = $derived.by(() => {
    void ctrl.renderCount;
    if (params.mode === 'ladder') {
      const F = ladderForces(lp());
      return [
        { label: 'state', value: F.slips ? 'SLIPS' : 'in equilibrium', strong: true },
        { label: 'wall pushes N_w', value: fmt(F.Nw, 3), unit: 'N' },
        { label: 'floor pushes up N_f', value: fmt(F.Nf, 3), unit: 'N' },
        { label: 'friction needed', value: fmt(F.f, 3), unit: 'N' },
        { label: 'maximum μ_s N_f', value: fmt(F.fmax, 3), unit: 'N' },
        { label: 'safe to climb up to', value: fmt(F.dmax, 3), unit: 'm' },
      ];
    }
    const p = beam.p;
    let acw = p.mb * p.g * Math.max(0, p.xp);
    let cw = p.mb * p.g * Math.max(0, -p.xp);
    for (const q of p.masses) {
      const mom = q.m * p.g * (q.x - p.xp);
      if (mom < 0) acw += -mom;
      else cw += mom;
    }
    const tau = acw - cw;
    return [
      { label: 'state', value: Math.abs(tau) < 1e-6 ? 'balanced (Στ = 0)' : beam.resting ? 'tipped over' : 'turning', strong: true },
      { label: 'anticlockwise moments', value: fmt(acw, 4), unit: 'N m' },
      { label: 'clockwise moments', value: fmt(cw, 4), unit: 'N m' },
      { label: 'resultant torque', value: fmt(tau, 3), unit: 'N m' },
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
  info={M.info}
  graphs={M.graphs}
  initialGraphs={['theta']}
  presets={M.presets}
  onpreset={(id) => Object.assign(params, M.presets.find((p) => p.id === id)?.values ?? {})}
  {ruler}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      interaction={inter}
      label="Torque and equilibrium simulation"
      onready={(c) => {
        ctx = c;
        fitView();
        ctrl.invalidate();
      }}
      onresize={() => {
        fitView();
        ctrl.invalidate();
      }}
    />
  {/snippet}
  {#snippet readouts()}<Readouts {rows} />{/snippet}
  {#snippet controls()}
    <div class="controls">
      <Segmented
        label="Situation"
        bind:value={params.mode}
        options={[
          { value: 'beam', label: 'See-saw' },
          { value: 'ladder', label: 'Ladder' },
        ]}
      />
      {#if params.mode === 'beam'}
        <p class="tip">Drag the masses along the beam.</p>
        <Slider def={sl('m1')} bind:value={params.m1} />
        <Slider def={sl('m2')} bind:value={params.m2} />
        <Slider def={sl('m3')} bind:value={params.m3} />
        <Slider def={sl('xp')} bind:value={params.xp} />
        <Slider def={sl('mb')} bind:value={params.mb} />
      {:else}
        <Slider def={sl('lL')} bind:value={params.lL} />
        <Slider def={sl('lth')} bind:value={params.lth} />
        <Slider def={sl('lm')} bind:value={params.lm} />
        <Slider def={sl('lM')} bind:value={params.lM} />
        <Slider def={sl('ld')} bind:value={params.ld} />
        <Slider def={sl('lmu')} bind:value={params.lmu} />
      {/if}
      <Slider def={sl('g')} bind:value={params.g} />
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

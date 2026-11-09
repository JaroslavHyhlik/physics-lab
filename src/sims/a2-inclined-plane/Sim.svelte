<script lang="ts">
  import { onMount } from 'svelte';
  import SimShell from '../../sim/SimShell.svelte';
  import SimCanvas from '../../sim/SimCanvas.svelte';
  import Readouts from '../../sim/Readouts.svelte';
  import Slider from '../../ui/Slider.svelte';
  import Toggle from '../../ui/Toggle.svelte';
  import { SimController } from '../../sim/controller.svelte';
  import { useParams, usePalette, resetOn, redrawOn } from '../../sim/setup.svelte';
  import { View } from '../../sim/view';
  import { Interaction } from '../../sim/interaction';
  import type { SimEntry } from '../../app/registry';
  import { Incline, type InclineParams } from '../../physics/incline';
  import { fmt } from '../../core/format';
  import { Ruler } from '../../tools/ruler';
  import { drawIncline } from './render';
  import * as M from './meta';

  let { entry }: { entry: SimEntry } = $props();
  const deg = Math.PI / 180;
  const { params, sl } = useParams(M.defaults, M.sliders);

  const modelParams = (): InclineParams => ({
    theta: params.theta * deg,
    m: params.m,
    muS: params.muS,
    muD: Math.min(params.muD, params.muS),
    F: params.F,
    L: params.L,
    s0: params.L * 0.6,
    u: params.u,
    g: params.g,
    friction: params.friction,
  });
  const block = new Incline(modelParams());
  const view = new View();
  const inter = new Interaction();
  const ruler = new Ruler(0, -0.3, 2, -0.3);
  let ctx: CanvasRenderingContext2D | null = null;

  function fitView() {
    const L = params.L;
    const th = params.theta * deg;
    view.fit(-0.12 * L, L * Math.cos(th) + 0.12 * L, -0.06 * L, L * Math.sin(th) + 0.3 * L, 24, 80);
  }

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        block.step(dt);
        if (block.stopped) ctrl.pause();
      },
      render: () => {
        if (!ctx) return;
        drawIncline(ctx, view, block, palette.pal, { fbd: params.fbd, components: params.components });
        ruler.draw(ctx, view, palette.pal);
      },
      sample: (t, out) => {
        out[0] = t;
        out[1] = block.s;
        out[2] = block.v;
        out[3] = block.a;
        out[4] = block.friction;
        out[5] = -block.weightAlong;
        out[6] = block.p.m * block.a;
        out[7] = block.Ek;
        out[8] = block.Ep;
        out[9] = block.heat;
      },
      reset: () => {
        block.reset(modelParams());
        fitView();
      },
    },
    { dt: 1e-3, channels: M.channels, sampleInterval: 1 / 60, autoplay: true },
  );
  const palette = usePalette(() => ctrl);

  // μ_d can never exceed μ_s
  $effect(() => {
    if (params.muD > params.muS) params.muS = params.muD;
  });
  resetOn(ctrl, () => [params.theta, params.m, params.muS, params.muD, params.F, params.u, params.L, params.g, params.friction]);
  redrawOn(ctrl, () => [params.fbd, params.components]);
  ruler.attach(view, inter);
  inter.onChange = () => ctrl.invalidate();

  const rows = $derived.by(() => {
    void ctrl.renderCount;
    const st = block.stopped ? 'reached the end' : block.isStatic ? 'at rest (static friction)' : block.v > 0 ? 'moving up' : 'sliding down';
    return [
      { label: 'state', value: st, strong: true },
      { label: 'critical angle tan⁻¹ μ_s', value: ((block.criticalAngle * 180) / Math.PI).toFixed(1), unit: '°' },
      { label: 'normal force F_N', value: fmt(block.normal, 3), unit: 'N', color: '--series-3' },
      { label: 'friction F_f', value: fmt(Math.abs(block.friction), 3), unit: 'N', color: '--series-4' },
      { label: 'max static μ_s F_N', value: fmt(block.p.muS * block.normal, 3), unit: 'N' },
      { label: 'a', value: fmt(block.a, 3), unit: 'm s⁻²' },
      { label: 'v', value: fmt(block.v, 3), unit: 'm s⁻¹' },
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
  initialGraphs={['v', 'F']}
  presets={M.presets}
  onpreset={(id) => Object.assign(params, M.presets.find((p) => p.id === id)?.values ?? {})}
  {ruler}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      interaction={inter}
      label="Inclined plane simulation"
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
      <Slider def={sl('theta')} bind:value={params.theta} />
      <Slider def={sl('m')} bind:value={params.m} />
      <div class="group">
        <Toggle label="Friction" bind:checked={params.friction} />
        <Slider def={sl('muS')} bind:value={params.muS} disabled={!params.friction} />
        <Slider def={sl('muD')} bind:value={params.muD} disabled={!params.friction} />
      </div>
      <div class="group">
        <Slider def={sl('F')} bind:value={params.F} />
        <Slider def={sl('u')} bind:value={params.u} />
        <Slider def={sl('L')} bind:value={params.L} />
        <Slider def={sl('g')} bind:value={params.g} />
      </div>
      <div class="group">
        <Toggle label="Free-body diagram" hint="Arrow lengths ∝ force" bind:checked={params.fbd} />
        <Toggle label="Components of the weight" hint="mg sinθ and mg cosθ (dashed)" bind:checked={params.components} />
      </div>
    </div>
  {/snippet}
</SimShell>

<style>
  .controls {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .group {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding-top: var(--space-3);
    border-top: 1px solid var(--border);
  }
</style>

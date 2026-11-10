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
  import { curveForces, idealSpeed, maxSpeed, minSpeed, CurveRun, type CurveParams } from '../../physics/bankedCurve';
  import { fmt } from '../../core/format';
  import { drawCurve } from './render';
  import * as M from './meta';

  let { entry }: { entry: SimEntry } = $props();
  const deg = Math.PI / 180;
  const { params, sl } = useParams(M.defaults, M.sliders);
  const cp = (): CurveParams => ({ m: params.m, r: params.r, theta: params.theta * deg, mu: params.mu, g: params.g });
  const run = new CurveRun(params.r, params.v);
  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;

  function state() {
    const p = cp();
    return {
      p,
      v: params.v,
      phi: run.phi,
      F: curveForces(p, params.v),
      vIdeal: idealSpeed(p),
      vMin: minSpeed(p),
      vMax: maxSpeed(p),
      fbd: params.fbd,
      components: params.components,
    };
  }

  const ctrl: SimController = new SimController(
    {
      step: (dt) => run.step(dt),
      render: () => {
        if (ctx) drawCurve(ctx, view.width, view.height, palette.pal, state());
      },
      sample: (t, out) => {
        const F = curveForces(cp(), params.v);
        out[0] = t;
        out[1] = params.v;
        out[2] = F.ac;
        out[3] = F.N;
        out[4] = F.f;
        out[5] = F.fMax;
      },
      reset: () => {
        run.phi = 0;
        run.t = 0;
      },
    },
    { dt: 1e-3, channels: M.channels, sampleInterval: 1 / 30, autoplay: true },
  );
  const palette = usePalette(() => ctrl);

  // all parameters apply live, so the graphs show what happens when you change them
  $effect(() => {
    run.r = params.r;
    run.v = params.v;
  });
  redrawOn(ctrl, () => [params.v, params.r, params.theta, params.mu, params.m, params.g, params.fbd, params.components]);

  const rows = $derived.by(() => {
    void ctrl.renderCount;
    const s = state();
    const status = {
      ideal: 'ideal speed: no friction needed',
      'friction-down': 'holds: friction acts down the bank',
      'friction-up': 'holds: friction acts up the bank',
      'slides-out': 'TOO FAST: slides outwards',
      'slides-in': 'TOO SLOW: slides down the bank',
    }[s.F.regime];
    return [
      { label: 'status', value: status, strong: true },
      { label: 'speed', value: `${fmt(params.v, 3)} m s⁻¹ = ${fmt(params.v * 3.6, 3)} km h⁻¹` },
      { label: 'ideal speed √(rg tanθ)', value: fmt(s.vIdeal, 3), unit: 'm s⁻¹' },
      { label: 'safe range', value: `${fmt(s.vMin, 3)} – ${Number.isFinite(s.vMax) ? fmt(s.vMax, 3) : '∞'}`, unit: 'm s⁻¹' },
      { label: 'a = v²/r', value: fmt(s.F.ac, 3), unit: 'm s⁻²' },
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
  initialGraphs={['F', 'a']}
  presets={M.presets}
  onpreset={(id) => Object.assign(params, M.presets.find((p) => p.id === id)?.values ?? {})}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      label="Car on a banked curve"
      onready={(c) => {
        ctx = c;
        ctrl.invalidate();
      }}
      onresize={() => ctrl.invalidate()}
    />
  {/snippet}
  {#snippet readouts()}<Readouts {rows} />{/snippet}
  {#snippet controls()}
    <div class="controls">
      <Slider def={sl('v')} bind:value={params.v} />
      <Slider def={sl('r')} bind:value={params.r} />
      <Slider def={sl('theta')} bind:value={params.theta} />
      <Slider def={sl('mu')} bind:value={params.mu} />
      <Slider def={sl('m')} bind:value={params.m} />
      <Slider def={sl('g')} bind:value={params.g} />
      <div class="group">
        <Toggle label="Free-body diagram (cross-section)" hint="Arrow lengths ∝ force" bind:checked={params.fbd} />
        <Toggle label="Components of F_N" hint="Vertical and horizontal (dashed)" bind:checked={params.components} />
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

<script lang="ts">
  import { onMount } from 'svelte';
  import SimShell from '../../sim/SimShell.svelte';
  import SimCanvas from '../../sim/SimCanvas.svelte';
  import Readouts from '../../sim/Readouts.svelte';
  import Slider from '../../ui/Slider.svelte';
  import Toggle from '../../ui/Toggle.svelte';
  import Segmented from '../../ui/Segmented.svelte';
  import { SimController } from '../../sim/controller.svelte';
  import { useParams, usePalette, resetOn, redrawOn } from '../../sim/setup.svelte';
  import { View } from '../../sim/view';
  import type { SimEntry } from '../../app/registry';
  import { Lift, Pulley } from '../../physics/newton';
  import { fmt } from '../../core/format';
  import { drawLift, drawPulley } from './render';
  import * as M from './meta';

  let { entry }: { entry: SimEntry } = $props();
  const { params, sl } = useParams(M.defaults, M.sliders);

  const liftP = () => ({ m: params.m, a: params.a, t1: params.t1, t2: params.t2, dir: (params.up ? 1 : -1) as 1 | -1, g: params.g, freeFall: params.freeFall });
  const pulleyP = () => ({
    mode: (params.mode === 'table' ? 'table' : 'atwood') as 'atwood' | 'table',
    m1: params.m1,
    m2: params.m2,
    muS: params.muS,
    muD: Math.min(params.muD, params.muS),
    g: params.g,
    L: params.mode === 'table' ? 2.0 : 0.9,
  });
  const lift = new Lift(liftP());
  const sys = new Pulley(pulleyP());
  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;
  const isLift = () => params.mode === 'lift';

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        if (isLift()) {
          lift.step(dt);
          if (lift.t > lift.duration + 1 || (lift.p.freeFall && lift.t > 2.5)) ctrl.pause();
        } else {
          sys.step(dt);
          if (sys.stopped || (!sys.moves && sys.t > 2)) ctrl.pause();
        }
      },
      render: () => {
        if (!ctx) return;
        if (isLift()) drawLift(ctx, view.width, view.height, lift, palette.pal, params.forces);
        else drawPulley(ctx, view.width, view.height, sys, palette.pal, params.forces);
      },
      sample: (t, out) => {
        out[0] = t;
        if (isLift()) {
          out[1] = lift.height();
          out[2] = lift.velocity();
          out[3] = lift.accel();
          out[4] = lift.normal();
          out[5] = lift.p.m * lift.p.g;
        } else {
          out[1] = sys.s;
          out[2] = sys.v;
          out[3] = sys.a;
          out[4] = sys.tension;
          out[5] = (sys.p.mode === 'atwood' ? sys.p.m1 : sys.p.m2) * sys.p.g;
        }
      },
      reset: () => {
        lift.reset(liftP());
        sys.reset(pulleyP());
      },
    },
    { dt: 1e-3, channels: M.channels, sampleInterval: 1 / 60, autoplay: true },
  );
  const palette = usePalette(() => ctrl);
  $effect(() => {
    if (params.muD > params.muS) params.muS = params.muD;
  });
  resetOn(ctrl, () => [params.mode, params.m, params.a, params.t1, params.t2, params.up, params.freeFall, params.m1, params.m2, params.muS, params.muD, params.g]);
  $effect(() => {
    void [params.mode, params.m, params.a, params.t1, params.t2, params.up, params.freeFall, params.m1, params.m2, params.muS, params.muD, params.g];
    if (ctx) ctrl.play();
  });
  redrawOn(ctrl, () => [params.forces]);

  const rows = $derived.by(() => {
    void ctrl.renderCount;
    if (params.mode === 'lift') {
      const N = lift.normal();
      const a = lift.accel();
      const phase = lift.p.freeFall
        ? 'free fall'
        : Math.abs(a) < 1e-9
          ? Math.abs(lift.velocity()) > 1e-9
            ? 'constant velocity'
            : 'at rest'
          : a * lift.velocity() > 0 || Math.abs(lift.velocity()) < 1e-9
            ? 'speeding up'
            : 'slowing down';
      return [
        { label: 'phase', value: phase, strong: true },
        { label: 'scales reading N', value: fmt(N, 3), unit: 'N', color: '--series-3' },
        { label: 'weight mg', value: fmt(lift.p.m * lift.p.g, 3), unit: 'N', color: '--series-2' },
        { label: 'a (up +)', value: fmt(a, 3), unit: 'm s⁻²' },
        { label: 'v (up +)', value: fmt(lift.velocity(), 3), unit: 'm s⁻¹' },
      ];
    }
    return [
      { label: 'state', value: sys.moves ? (sys.stopped ? 'stopped at the end' : 'moving') : 'at rest (static)', strong: true },
      { label: 'acceleration a', value: fmt(sys.a, 3), unit: 'm s⁻²' },
      { label: 'tension T', value: fmt(sys.tension, 3), unit: 'N', color: '--series-3' },
      ...(params.mode === 'table' ? [{ label: 'friction', value: fmt(sys.friction, 3), unit: 'N', color: '--series-5' }] : []),
      { label: 'v', value: fmt(sys.v, 3), unit: 'm s⁻¹' },
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
      label="Newton's second law: lift and connected bodies"
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
      <Segmented
        label="Situation"
        bind:value={params.mode}
        options={[
          { value: 'lift', label: 'Lift' },
          { value: 'atwood', label: 'Atwood' },
          { value: 'table', label: 'Table + pulley' },
        ]}
      />
      {#if params.mode === 'lift'}
        <Slider def={sl('m')} bind:value={params.m} />
        <Toggle label="Cable snaps (free fall)" bind:checked={params.freeFall} />
        {#if !params.freeFall}
          <Segmented
            label="Direction"
            bind:value={params.up}
            options={[
              { value: true, label: 'Up' },
              { value: false, label: 'Down' },
            ]}
          />
          <Slider def={sl('a')} bind:value={params.a} />
          <Slider def={sl('t1')} bind:value={params.t1} />
          <Slider def={sl('t2')} bind:value={params.t2} />
        {/if}
      {:else}
        <Slider def={sl('m1')} bind:value={params.m1} />
        <Slider def={sl('m2')} bind:value={params.m2} />
        {#if params.mode === 'table'}
          <Slider def={sl('muS')} bind:value={params.muS} />
          <Slider def={sl('muD')} bind:value={params.muD} />
        {/if}
      {/if}
      <Slider def={sl('g')} bind:value={params.g} />
      <Toggle label="Force arrows" hint="Lengths ∝ force" bind:checked={params.forces} />
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

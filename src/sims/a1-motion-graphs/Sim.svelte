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
  import { Interaction } from '../../sim/interaction';
  import type { SimEntry } from '../../app/registry';
  import { Mover, scripts, type DriveMode } from '../../physics/motion';
  import { fmt } from '../../core/format';
  import { drawMotion, layout, Series } from './render';
  import * as M from './meta';

  let { entry }: { entry: SimEntry } = $props();
  const { params, sl } = useParams(M.defaults, M.sliders);
  const mover = new Mover();
  const data = new Series();
  const view = new View();
  const inter = new Interaction();
  let ctx: CanvasRenderingContext2D | null = null;
  let tc = $state(3); // time cursor [s]
  let dragTarget = 0;

  function applyInputs() {
    mover.mode = params.mode as DriveMode;
    mover.amax = params.amax;
    if (mover.mode === 'acc') mover.input = params.acc;
    if (mover.mode === 'vel') mover.input = params.vel;
    if (mover.mode === 'pos') mover.input = dragTarget;
  }

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        mover.step(dt);
        if (mover.t >= 20) ctrl.pause();
      },
      render: () => {
        if (ctx) drawMotion(ctx, view.width, view.height, mover, data, palette.pal, params.tools, tc);
      },
      sample: (t, out) => {
        out[0] = t;
        out[1] = mover.x;
        out[2] = mover.v;
        out[3] = mover.a;
        data.push(t, mover.x, mover.v, mover.a);
      },
      reset: () => {
        data.clear();
        applyInputs();
        const sc = scripts[params.script] ?? scripts.trip;
        mover.script = sc.s;
        if (mover.mode === 'script') mover.reset(sc.s.x0, sc.s.u);
        else mover.reset(0, 0);
        dragTarget = mover.x;
        if (mover.mode === 'pos') mover.input = dragTarget;
      },
    },
    { dt: 1e-3, channels: M.channels, sampleInterval: 1 / 60, autoplay: true },
  );
  const palette = usePalette(() => ctrl);
  resetOn(ctrl, () => [params.mode, params.script]);
  $effect(() => {
    void [params.mode, params.script];
    if (ctx) ctrl.play();
  });
  // live inputs
  $effect(() => {
    void [params.acc, params.vel, params.amax];
    applyInputs();
  });
  redrawOn(ctrl, () => [params.tools, tc]);

  // drag the walker (position mode) and the time cursor
  inter.add({
    priority: 20,
    cursor: 'ew-resize',
    hit: (px, py) => {
      if (!params.tools) return Infinity;
      const L = layout(view.width, view.height, mover.t);
      const cx = L.x0 + (tc / L.T) * (L.x1 - L.x0);
      return py > L.plots[0].y - 14 ? Math.abs(px - cx) : Infinity;
    },
    move: (px) => {
      const L = layout(view.width, view.height, mover.t);
      const tmax = data.n ? data.t[data.n - 1] : 0;
      tc = Math.max(0, Math.min(tmax, ((px - L.x0) / (L.x1 - L.x0)) * L.T));
    },
  });
  inter.add({
    priority: 10,
    cursor: 'grab',
    hit: (px, py) => {
      const L = layout(view.width, view.height, mover.t);
      const end = view.width > 700 ? view.width - 250 : L.x1;
      const x = L.x0 + ((mover.x + 10) / 20) * (end - L.x0);
      return Math.hypot(px - x, py - (L.trackY - 13)) - 10;
    },
    start: () => {
      if (params.mode !== 'pos') params.mode = 'pos';
    },
    move: (px) => {
      const L = layout(view.width, view.height, mover.t);
      const end = view.width > 700 ? view.width - 250 : L.x1;
      dragTarget = Math.max(-10, Math.min(10, ((px - L.x0) / (end - L.x0)) * 20 - 10));
      mover.input = dragTarget;
      if (!ctrl.running) ctrl.play();
    },
  });
  inter.onChange = () => ctrl.invalidate();

  const rows = $derived.by(() => {
    void ctrl.renderCount;
    return [
      { label: 'x', value: fmt(mover.x, 3), unit: 'm', color: '--series-1', strong: true },
      { label: 'v', value: fmt(mover.v, 3), unit: 'm s⁻¹', color: '--series-2' },
      { label: 'a', value: fmt(mover.a, 3), unit: 'm s⁻²', color: '--series-3' },
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
  initialGraphs={['x', 'v']}
  presets={M.presets}
  onpreset={(id) => Object.assign(params, { mode: 'script', script: id })}
  stopwatch={false}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      interaction={inter}
      label="Motion graphs lab"
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
        label="Drive the motion by"
        bind:value={params.mode}
        options={[
          { value: 'script', label: 'Preset' },
          { value: 'acc', label: 'a' },
          { value: 'vel', label: 'v' },
          { value: 'pos', label: 'Drag x' },
        ]}
      />
      {#if params.mode === 'script'}
        <label class="sel">
          <span>Preset motion</span>
          <select bind:value={params.script}>
            {#each Object.entries(scripts) as [id, s] (id)}<option value={id}>{s.label}</option>{/each}
          </select>
        </label>
      {:else if params.mode === 'acc'}
        <Slider def={sl('acc')} bind:value={params.acc} />
      {:else if params.mode === 'vel'}
        <Slider def={sl('vel')} bind:value={params.vel} />
        <Slider def={sl('amax')} bind:value={params.amax} />
      {:else}
        <p class="tip">Drag the walker along the track. Its acceleration is limited, so the graphs stay smooth.</p>
        <Slider def={sl('amax')} bind:value={params.amax} />
      {/if}
      <Toggle label="Gradient & area tool" hint="Drag the dashed time cursor on the graphs" bind:checked={params.tools} />
      <p class="tip">The run stops after 20 s; press reset to start again.</p>
    </div>
  {/snippet}
</SimShell>

<style>
  .controls {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .sel {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: var(--text-sm);
    color: var(--text-2);
  }
  select {
    border: 1px solid var(--border-strong);
    background: var(--surface);
    border-radius: var(--radius-s);
    padding: 9px 10px;
    font-weight: 600;
    min-height: var(--touch);
    color: var(--text);
  }
  .tip {
    font-size: var(--text-xs);
    color: var(--text-3);
  }
</style>

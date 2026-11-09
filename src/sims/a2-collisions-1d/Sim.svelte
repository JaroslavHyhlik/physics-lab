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
  import { Collision1D, type CollisionParams } from '../../physics/collision1d';
  import { fmt } from '../../core/format';
  import { Ruler } from '../../tools/ruler';
  import { drawCollision } from './render';
  import * as M from './meta';

  let { entry }: { entry: SimEntry } = $props();
  const { params, sl } = useParams(M.defaults, M.sliders);

  const W = 0.4; // cart length incl. bumper [m]
  const modelParams = (): CollisionParams => {
    // start positions so that the carts meet near the middle of the track
    const vr = params.u1 - params.u2;
    let x1 = -1.2;
    let x2 = 1.2;
    if (vr > 0 && params.u1 > 0 && params.u2 > 0) {
      x1 = -2;
      x2 = -0.6;
    }
    if (vr > 0 && params.u1 < 0 && params.u2 < 0) {
      x1 = 0.6;
      x2 = 2;
    }
    return { m1: params.m1, m2: params.m2, u1: params.u1, u2: params.u2, e: params.e, k: params.k, x1, x2, w: W };
  };
  const col = new Collision1D(modelParams());
  const view = new View();
  const inter = new Interaction();
  const ruler = new Ruler(-1, -0.25, 0, -0.25);
  let ctx: CanvasRenderingContext2D | null = null;
  let p0 = 1;

  const fitView = () => view.fit(-2.6, 2.6, -0.55, 0.9, 20, 80);

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        col.step(dt);
        const out = Math.abs(col.y[0]) > 2.9 && Math.abs(col.y[2]) > 2.9;
        if ((col.done && (out || col.t > (col.contactEnd || 0) + 3)) || col.t > 12) ctrl.pause();
      },
      render: () => {
        if (!ctx) return;
        drawCollision(ctx, view, col, palette.pal, { arrows: params.arrows, bars: params.bars, cm: params.cm, p0 });
        ruler.draw(ctx, view, palette.pal);
      },
      sample: (t, out) => {
        const p1 = col.p.m1 * col.y[1];
        const p2 = col.p.m2 * col.y[3];
        out[0] = t;
        out[1] = col.y[0];
        out[2] = col.y[2];
        out[3] = col.y[1];
        out[4] = col.y[3];
        out[5] = col.vcm;
        out[6] = col.force();
        out[7] = p1;
        out[8] = p2;
        out[9] = p1 + p2;
        out[10] = 0.5 * col.p.m1 * col.y[1] ** 2;
        out[11] = 0.5 * col.p.m2 * col.y[3] ** 2;
        out[12] = col.kinetic;
      },
      reset: () => {
        col.reset(modelParams());
        p0 = Math.max(Math.abs(col.p.m1 * col.p.u1), Math.abs(col.p.m2 * col.p.u2), Math.abs(col.momentum), 0.1);
      },
    },
    { dt: 1e-4, channels: M.channels, sampleInterval: 0.002, autoplay: true, frameStep: 0.01 },
  );
  const palette = usePalette(() => ctrl);

  resetOn(ctrl, () => [params.m1, params.m2, params.u1, params.u2, params.e, params.k]);
  $effect(() => {
    void [params.m1, params.m2, params.u1, params.u2, params.e, params.k];
    if (ctx) ctrl.play();
  });
  redrawOn(ctrl, () => [params.arrows, params.bars, params.cm]);
  ruler.attach(view, inter);
  inter.onChange = () => ctrl.invalidate();

  const rows = $derived.by(() => {
    void ctrl.renderCount;
    const p = col.p;
    const done = col.done;
    const KE0 = 0.5 * p.m1 * p.u1 ** 2 + 0.5 * p.m2 * p.u2 ** 2;
    const dtc = col.contactEnd - col.contactStart;
    const eMeas = (col.y[3] - col.y[1]) / (p.u1 - p.u2);
    return [
      { label: 'before → after', value: '' },
      { label: 'cart 1 velocity', value: `${fmt(p.u1, 3)} → ${done ? fmt(col.y[1], 3) : '…'}`, unit: 'm s⁻¹', color: '--series-1' },
      { label: 'cart 2 velocity', value: `${fmt(p.u2, 3)} → ${done ? fmt(col.y[3], 3) : '…'}`, unit: 'm s⁻¹', color: '--series-2' },
      { label: 'total momentum', value: `${fmt(p.m1 * p.u1 + p.m2 * p.u2, 4)} → ${fmt(col.momentum, 4)}`, unit: 'kg m s⁻¹', strong: true },
      { label: 'total Eₖ', value: `${fmt(KE0, 3)} → ${fmt(col.kinetic, 3)}`, unit: 'J' },
      ...(done
        ? [
            { label: 'impulse J on cart 2', value: fmt(col.impulse, 3), unit: 'N s' },
            { label: 'contact time Δt', value: fmt(dtc, 3), unit: 's' },
            { label: 'average force J/Δt', value: fmt(col.impulse / dtc, 3), unit: 'N' },
            { label: 'measured e', value: Number.isFinite(eMeas) ? eMeas.toFixed(3) : '—' },
          ]
        : []),
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
      label="One-dimensional collision simulation"
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
      <Slider def={sl('m1')} bind:value={params.m1} />
      <Slider def={sl('u1')} bind:value={params.u1} />
      <Slider def={sl('m2')} bind:value={params.m2} />
      <Slider def={sl('u2')} bind:value={params.u2} />
      <div class="group">
        <Slider def={sl('e')} bind:value={params.e} />
        <Slider def={sl('k')} bind:value={params.k} />
      </div>
      <div class="group">
        <Toggle label="Velocity arrows" bind:checked={params.arrows} />
        <Toggle label="Momentum bars" bind:checked={params.bars} />
        <Toggle label="Centre of mass" color="var(--series-5)" bind:checked={params.cm} />
      </div>
      <p class="tip">Tip: use slow motion (0.1×) to watch the bumpers compress.</p>
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
  .tip {
    font-size: var(--text-xs);
    color: var(--text-3);
  }
</style>

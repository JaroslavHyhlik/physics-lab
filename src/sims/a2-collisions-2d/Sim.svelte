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
  import { Collision2D, standardSetup } from '../../physics/collision2d';
  import { fmt } from '../../core/format';
  import { Ruler } from '../../tools/ruler';
  import { drawCollision2D } from './render';
  import * as M from './meta';

  let { entry }: { entry: SimEntry } = $props();
  const { params, sl } = useParams(M.defaults, M.sliders);

  const setup = () => standardSetup(params.m1, params.m2, params.r, params.r, params.u1, params.u2, params.b, params.e);
  const col = new Collision2D(setup());
  const view = new View();
  const inter = new Interaction();
  const ruler = new Ruler(-0.5, -0.6, 0.5, -0.6);
  let ctx: CanvasRenderingContext2D | null = null;
  let pScale = 1;

  const fitView = () => view.fit(-1.4, 1.4, -0.75, 0.75, 16, 72);

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        col.step(dt);
        const out = (x: number, y: number) => Math.abs(x) > 1.8 || Math.abs(y) > 1.2;
        if ((col.collided && out(col.s[0], col.s[1]) && out(col.s[4], col.s[5])) || col.t > 6) ctrl.pause();
      },
      render: () => {
        if (!ctx) return;
        drawCollision2D(ctx, view, col, palette.pal, {
          trails: params.trails,
          arrows: params.arrows,
          pdiagram: params.pdiagram,
          cmframe: params.cmframe,
          pScale,
        });
        ruler.draw(ctx, view, palette.pal);
      },
      sample: (t, out) => {
        const s = col.s;
        out[0] = t;
        out[1] = s[2];
        out[2] = s[3];
        out[3] = s[6];
        out[4] = s[7];
        out[5] = col.px;
        out[6] = col.py;
        out[7] = col.kinetic;
      },
      reset: () => {
        col.reset(setup());
        const q = col.p;
        pScale = Math.max(Math.abs(q.m1 * q.u1x) + Math.abs(q.m2 * q.u2x), 0.1);
      },
    },
    { dt: 1e-3, channels: M.channels, sampleInterval: 1 / 60, autoplay: true },
  );
  const palette = usePalette(() => ctrl);

  // puck radius limits the impact parameter range
  $effect(() => {
    if (params.b > 2.4 * params.r) params.b = Math.round(2.4 * params.r * 1000) / 1000;
  });
  resetOn(ctrl, () => [params.m1, params.m2, params.u1, params.u2, params.b, params.e, params.r]);
  $effect(() => {
    void [params.m1, params.m2, params.u1, params.u2, params.b, params.e, params.r];
    if (ctx) ctrl.play();
  });
  redrawOn(ctrl, () => [params.trails, params.arrows, params.pdiagram, params.cmframe]);
  ruler.attach(view, inter);
  inter.onChange = () => ctrl.invalidate();

  const deg = (a: number) => (a * 180) / Math.PI;
  const rows = $derived.by(() => {
    void ctrl.renderCount;
    const q = col.p;
    const s = col.s;
    const p0x = q.m1 * q.u1x + q.m2 * q.u2x;
    const p0y = q.m1 * q.u1y + q.m2 * q.u2y;
    const K0 = 0.5 * q.m1 * (q.u1x ** 2 + q.u1y ** 2) + 0.5 * q.m2 * (q.u2x ** 2 + q.u2y ** 2);
    const base = [
      { label: 'total pₓ before → now', value: `${fmt(p0x, 4)} → ${fmt(col.px, 4)}`, unit: 'kg m s⁻¹', strong: true },
      { label: 'total pᵧ before → now', value: `${fmt(p0y, 3)} → ${fmt(Math.abs(col.py) < 1e-12 ? 0 : col.py, 3)}`, unit: 'kg m s⁻¹' },
      { label: 'total Eₖ before → now', value: `${fmt(K0, 3)} → ${fmt(col.kinetic, 3)}`, unit: 'J' },
    ];
    if (!col.collided) return [...base, { label: 'status', value: q.y1 >= q.r1 + q.r2 ? 'the pucks will miss' : 'approaching' }];
    const a1 = Math.atan2(s[3], s[2]);
    const a2 = Math.atan2(s[7], s[6]);
    const s1 = Math.hypot(s[2], s[3]);
    const s2 = Math.hypot(s[6], s[7]);
    let between = Math.abs(deg(a1 - a2));
    if (between > 180) between = 360 - between;
    return [
      ...base,
      { label: 'puck 1 leaves at', value: `${fmt(s1, 3)} m s⁻¹, ${deg(a1).toFixed(1)}°`, color: '--series-1' },
      { label: 'puck 2 leaves at', value: `${fmt(s2, 3)} m s⁻¹, ${deg(a2).toFixed(1)}°`, color: '--series-2' },
      { label: 'angle between them', value: s1 > 1e-6 && s2 > 1e-6 ? between.toFixed(1) : '—', unit: '°' },
      { label: 'impulse on puck 2', value: fmt(Math.hypot(col.J[0], col.J[1]), 3), unit: 'N s' },
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
  initialGraphs={['v', 'p']}
  presets={M.presets}
  onpreset={(id) => Object.assign(params, M.presets.find((p) => p.id === id)?.values ?? {})}
  {ruler}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      interaction={inter}
      label="Two-dimensional collision on an air table"
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
        <Slider def={sl('b')} bind:value={params.b} />
        <Slider def={sl('e')} bind:value={params.e} />
        <Slider def={sl('r')} bind:value={params.r} />
      </div>
      <div class="group">
        <Toggle label="Paths and line of centres" bind:checked={params.trails} />
        <Toggle label="Velocity arrows" bind:checked={params.arrows} />
        <Toggle label="Momentum vector diagram" bind:checked={params.pdiagram} />
        <Toggle label="Centre-of-mass frame" hint="Watch from a frame moving with the centre of mass (×)" bind:checked={params.cmframe} />
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

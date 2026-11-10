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
  import { Coaster, Track, tracks } from '../../physics/coaster';
  import { fmt } from '../../core/format';
  import { Ruler } from '../../tools/ruler';
  import { drawCoaster } from './render';
  import * as M from './meta';

  let { entry }: { entry: SimEntry } = $props();
  const { params, sl } = useParams(M.defaults, M.sliders);

  const trackCache = new Map<string, Track>();
  const getTrack = (id: string) => {
    const key = tracks[id] ? id : 'hills';
    if (!trackCache.has(key)) trackCache.set(key, new Track(tracks[key].points));
    return trackCache.get(key)!;
  };
  const mp = () => ({ m: params.m, mu: params.mu, g: params.g, s0: (tracks[params.track] ?? tracks.hills).s0, u: params.u });
  const car = new Coaster(getTrack(params.track), mp());
  const view = new View();
  const inter = new Interaction();
  const ruler = new Ruler(0, -1, 10, -1);
  let ctx: CanvasRenderingContext2D | null = null;
  let poly = new Float64Array(0);
  let neg = new Uint8Array(0);
  let E0 = 1;

  /** track polyline + where the car (moving with its energy) would need a negative N */
  function buildPolyline() {
    const tr = car.track;
    const n = 600;
    poly = new Float64Array(2 * (n + 1));
    neg = new Uint8Array(n + 1);
    const Etot = 0.5 * params.u ** 2 + params.g * tr.at(car.p.s0).y; // per unit mass
    for (let i = 0; i <= n; i++) {
      const s = (tr.length * i) / n;
      const a = tr.at(s);
      poly[2 * i] = a.x;
      poly[2 * i + 1] = a.y;
      const v2 = 2 * (Etot - params.g * a.y);
      neg[i] = params.mu === 0 && v2 > 0 && v2 * a.k + params.g * a.tx < 0 ? 1 : 0;
    }
  }

  function fitView() {
    let x0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < poly.length; i += 2) {
      x0 = Math.min(x0, poly[i]);
      x1 = Math.max(x1, poly[i]);
      y1 = Math.max(y1, poly[i + 1]);
    }
    view.fit(x0 - 2, x1 + 2, -3, y1 + 4, 20, 80);
  }

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        car.step(dt);
        if (car.stopped && car.t > 0.5) ctrl.pause();
      },
      render: () => {
        if (!ctx) return;
        drawCoaster(ctx, view, car, palette.pal, { bars: params.bars, gforce: params.gforce, E0, poly, neg });
        ruler.draw(ctx, view, palette.pal);
      },
      sample: (t, out) => {
        out[0] = t;
        out[1] = car.Ek / 1000;
        out[2] = car.Ep / 1000;
        out[3] = car.heat / 1000;
        out[4] = (car.Ek + car.Ep + car.heat) / 1000;
        out[5] = Math.abs(car.v);
        out[6] = car.pos.y;
        out[7] = car.N / (car.p.m * car.p.g);
      },
      reset: () => {
        car.reset(mp(), getTrack(params.track));
        E0 = car.Ek + car.Ep;
        buildPolyline();
        fitView();
      },
    },
    { dt: 1e-3, channels: M.channels, sampleInterval: 1 / 30, autoplay: true },
  );
  const palette = usePalette(() => ctrl);
  resetOn(ctrl, () => [params.track, params.m, params.mu, params.u, params.g]);
  $effect(() => {
    void [params.track, params.m, params.mu, params.u, params.g];
    if (ctx) ctrl.play();
  });
  redrawOn(ctrl, () => [params.bars, params.gforce]);
  ruler.attach(view, inter);
  inter.onChange = () => ctrl.invalidate();

  const rows = $derived.by(() => {
    void ctrl.renderCount;
    const h0 = car.track.at(car.p.s0).y;
    const dh = h0 - car.pos.y;
    return [
      { label: 'speed', value: fmt(Math.abs(car.v), 3), unit: 'm s⁻¹', strong: true },
      { label: '√(u² + 2gΔh) (no friction)', value: dh > -1e-9 || params.u > 0 ? fmt(Math.sqrt(Math.max(0, params.u ** 2 + 2 * params.g * dh)), 3) : '—', unit: 'm s⁻¹' },
      { label: 'height', value: fmt(car.pos.y, 3), unit: 'm' },
      { label: 'g-force N/mg', value: (car.N / (car.p.m * car.p.g)).toFixed(2) },
      { label: 'thermal energy', value: fmt(car.heat / 1000, 3), unit: 'kJ' },
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
  initialGraphs={['E', 'n']}
  presets={M.presets}
  onpreset={(id) => Object.assign(params, M.presets.find((p) => p.id === id)?.values ?? {})}
  {ruler}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      interaction={inter}
      label="Roller coaster energy simulation"
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
      <label class="sel">
        <span>Track</span>
        <select bind:value={params.track}>
          {#each Object.entries(tracks) as [id, t] (id)}<option value={id}>{t.label}</option>{/each}
        </select>
      </label>
      <Slider def={sl('m')} bind:value={params.m} />
      <Slider def={sl('mu')} bind:value={params.mu} />
      <Slider def={sl('u')} bind:value={params.u} />
      <Slider def={sl('g')} bind:value={params.g} />
      <Toggle label="Energy bars" bind:checked={params.bars} />
      <Toggle label="g-force on the riders" hint="N/mg; red track = car must be held on" bind:checked={params.gforce} />
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
</style>

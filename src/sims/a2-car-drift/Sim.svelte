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
  import type { SimEntry } from '../../app/registry';
  import { DriftCar, type DriftParams } from '../../physics/drift';
  import { fmt } from '../../core/format';
  import { g } from '../../core/constants';
  import { drawDrift, Skids, wheelPositions } from './render';
  import * as M from './meta';

  let { entry }: { entry: SimEntry } = $props();
  const { params, sl } = useParams(M.defaults, M.sliders);
  const L = 2.6;
  const mp = (): DriftParams => ({
    m: params.m,
    a: L * (1 - params.front / 100),
    b: (L * params.front) / 100,
    Iz: params.m * 1.5,
    muS: params.muS,
    muD: Math.min(params.muD, params.muS),
    Ck: params.Ck,
    Pmax: params.P * 1000,
    g,
    CdA: 0,
    rho: 1.2,
  });
  const car = new DriftCar(mp());
  const skids = new Skids();
  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;

  // driver inputs (keyboard + on-screen buttons)
  const keys = { left: false, right: false, gas: false, brake: false, hand: false };
  const MAX_STEER = 0.55; // rad
  const STEER_RATE = 2.2; // rad s⁻¹

  function follow() {
    view.scale = Math.max(6, Math.min(30, view.width / 60));
    view.cx = car.y[0];
    view.cy = car.y[1];
  }

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        const target = (keys.left ? MAX_STEER : 0) + (keys.right ? -MAX_STEER : 0);
        const d = target - car.ctl.steer;
        car.ctl.steer += Math.max(-STEER_RATE * dt, Math.min(STEER_RATE * dt, d));
        car.ctl.throttle = keys.gas ? 1 : 0;
        car.ctl.brake = keys.brake ? 1 : 0;
        car.ctl.handbrake = keys.hand;
        car.step(dt);
      },
      render: () => {
        if (!ctx) return;
        follow();
        drawDrift(ctx, view, car, skids, palette.pal, params.forces, params.circles);
      },
      sample: (t, out) => {
        const w = wheelPositions(car);
        skids.add(0, w[0][0], w[0][1], car.front.sliding && car.speed > 1);
        skids.add(1, w[1][0], w[1][1], car.front.sliding && car.speed > 1);
        skids.add(2, w[2][0], w[2][1], car.rear.sliding && car.speed > 1);
        skids.add(3, w[3][0], w[3][1], car.rear.sliding && car.speed > 1);
        out[0] = t;
        out[1] = car.speed;
        out[2] = (car.beta * 180) / Math.PI;
        out[3] = car.latAccel / g;
        out[4] = (car.y[5] * 180) / Math.PI;
      },
      reset: () => {
        car.reset(mp());
        car.y[1] = 0;
        skids.clear();
      },
    },
    { dt: 1e-3, channels: M.channels, sampleInterval: 1 / 30, autoplay: true },
  );
  const palette = usePalette(() => ctrl);
  $effect(() => {
    if (params.muD > params.muS) params.muS = params.muD;
  });
  // parameters apply live (the car keeps driving)
  $effect(() => {
    const p = mp();
    Object.assign(car.p, p);
    const Lr = p.a + p.b;
    car.front.Fz = (p.m * p.g * p.b) / Lr;
    car.rear.Fz = (p.m * p.g * p.a) / Lr;
  });
  resetOn(ctrl, () => []);
  redrawOn(ctrl, () => [params.forces, params.circles]);

  function onKey(e: KeyboardEvent, down: boolean) {
    const t = e.target as HTMLElement;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT')) return;
    const k = e.key.toLowerCase();
    let used = true;
    if (k === 'arrowleft' || k === 'a') keys.left = down;
    else if (k === 'arrowright' || k === 'd') keys.right = down;
    else if (k === 'arrowup' || k === 'w') keys.gas = down;
    else if (k === 'arrowdown' || k === 's') keys.brake = down;
    else if (k === 'h' || k === 'shift') keys.hand = down;
    else used = false;
    if (used) {
      e.preventDefault();
      if (down && !ctrl.running) ctrl.play();
    }
  }
  const hold = (name: keyof typeof keys) => ({
    onpointerdown: (e: PointerEvent) => {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      keys[name] = true;
      if (!ctrl.running) ctrl.play();
    },
    onpointerup: () => (keys[name] = false),
    onpointercancel: () => (keys[name] = false),
  });

  const rows = $derived.by(() => {
    void ctrl.renderCount;
    return [
      { label: 'speed', value: `${fmt(car.speed * 3.6, 3)} km h⁻¹`, strong: true },
      { label: 'drift angle β', value: ((car.beta * 180) / Math.PI).toFixed(1), unit: '°' },
      { label: 'sideways acceleration', value: (car.latAccel / g).toFixed(2), unit: 'g' },
      { label: 'front tyres', value: car.front.sliding ? 'SLIDING (μ_d)' : 'grip (μ_s)' },
      { label: 'rear tyres', value: car.rear.sliding ? 'SLIDING (μ_d)' : 'grip (μ_s)' },
    ];
  });

  onMount(() => {
    ctrl.mount();
    return () => ctrl.destroy();
  });
</script>

<svelte:window onkeydown={(e) => onKey(e, true)} onkeyup={(e) => onKey(e, false)} />

<SimShell
  {entry}
  {ctrl}
  info={M.info}
  graphs={M.graphs}
  initialGraphs={['beta', 'ay']}
  presets={M.presets}
  onpreset={(id) => Object.assign(params, M.presets.find((p) => p.id === id)?.values ?? {})}
  stopwatch={false}
  shortcuts={false}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      label="Car drift simulation, top view"
      onready={(c) => {
        ctx = c;
        ctrl.invalidate();
      }}
      onresize={() => ctrl.invalidate()}
    />
    <div class="pad left">
      <button type="button" aria-label="Steer left" {...hold('left')}>◀</button>
      <button type="button" aria-label="Steer right" {...hold('right')}>▶</button>
    </div>
    <div class="pad right">
      <button type="button" class="hand" aria-label="Handbrake" {...hold('hand')}>HB</button>
      <button type="button" class="brake" aria-label="Brake" {...hold('brake')}>Brake</button>
      <button type="button" class="gas" aria-label="Throttle" {...hold('gas')}>Gas</button>
    </div>
  {/snippet}
  {#snippet readouts()}<Readouts {rows} />{/snippet}
  {#snippet controls()}
    <div class="controls">
      <p class="tip">Drive with the arrow keys or W A S D, H = handbrake — or the on-screen buttons.</p>
      <Slider def={sl('muS')} bind:value={params.muS} />
      <Slider def={sl('muD')} bind:value={params.muD} />
      <Slider def={sl('P')} bind:value={params.P} />
      <Slider def={sl('m')} bind:value={params.m} />
      <Slider def={sl('front')} bind:value={params.front} />
      <Slider def={sl('Ck')} bind:value={params.Ck} />
      <Toggle label="Tyre force arrows" hint="Green = grip, red = sliding" bind:checked={params.forces} />
      <Toggle label="Friction circles" hint="Outer: μ_s F_N, dashed: μ_d F_N" bind:checked={params.circles} />
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
  .pad {
    position: absolute;
    bottom: 76px;
    display: flex;
    gap: 8px;
    user-select: none;
    -webkit-user-select: none;
  }
  .pad.left {
    left: 12px;
  }
  .pad.right {
    right: 12px;
  }
  .pad button {
    min-width: 56px;
    height: 56px;
    border-radius: 14px;
    border: 1px solid var(--border-strong);
    background: var(--glass);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    font-weight: 700;
    font-size: var(--text-sm);
    color: var(--text);
    touch-action: none;
  }
  .pad button:active {
    background: var(--accent-soft);
  }
  .gas {
    color: var(--success) !important;
  }
  .brake {
    color: var(--danger) !important;
  }
</style>

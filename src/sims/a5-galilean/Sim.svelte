<script lang="ts">
  import { onMount } from 'svelte';
  import SimShell from '../../sim/SimShell.svelte';
  import SimCanvas from '../../sim/SimCanvas.svelte';
  import Readouts from '../../sim/Readouts.svelte';
  import Slider from '../../ui/Slider.svelte';
  import { SimController } from '../../sim/controller.svelte';
  import { useParams, usePalette, resetOn } from '../../sim/setup.svelte';
  import { View } from '../../sim/view';
  import type { SimEntry } from '../../app/registry';
  import type { NumberParamDef } from '../../sim/params.svelte';
  import type { SimInfo, GraphDef } from '../../sim/types';
  import type { ChannelDef } from '../../core/recorder';
  import { galilean } from '../../physics/relativity';
  import { alpha } from '../../sim/palette';
  import { drawArrow } from '../../sim/draw';
  import { g } from '../../core/constants';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [
    { key: 'v', label: 'Speed of the train (frame S′)', symbol: 'v', unit: 'm s⁻¹', min: -20, max: 20, step: 0.5 },
    { key: 'ux', label: 'Ball: horizontal velocity in the train', symbol: 'u′ₓ', unit: 'm s⁻¹', min: -15, max: 15, step: 0.5 },
    { key: 'uy', label: 'Ball: vertical velocity', symbol: 'u_y', unit: 'm s⁻¹', min: 0, max: 12, step: 0.5 },
  ];
  const { params, sl } = useParams({ v: 10, ux: 4, uy: 6 }, sliders);
  const channels: ChannelDef[] = [
    { key: 't', label: 't', unit: 's' },
    { key: 'x', label: 'x (platform frame S)', unit: 'm', color: '--series-1' },
    { key: 'xp', label: 'x′ (train frame S′)', unit: 'm', color: '--series-2' },
    { key: 'ux', label: 'uₓ in S', unit: 'm s⁻¹', color: '--series-1' },
    { key: 'uxp', label: 'u′ₓ in S′', unit: 'm s⁻¹', color: '--series-2' },
  ];
  const graphs: GraphDef[] = [
    { id: 'x', title: 'Horizontal position in each frame', series: ['x', 'xp'] },
    { id: 'u', title: 'Horizontal velocity in each frame', series: ['ux', 'uxp'] },
  ];
  const info: SimInfo = {
    about: [
      'A ball is thrown inside a moving train. A passenger (frame S′, moving with the train) and someone standing on the platform (frame S) describe the same motion differently.',
      'Positions differ by the distance the train has moved, x′ = x − vt, and velocities differ by the speed of the train, u′ = u − v. But both observers agree on time (t′ = t) and on the acceleration: the ball falls with g in both frames, so the laws of motion are the same in every inertial frame.',
      'In the train the ball may go straight up and down; seen from the platform it follows a parabola. Both descriptions are correct — motion is relative.',
    ],
    formulas: [
      { label: 'Galilean transformation', tex: "x' = x - vt, \\qquad t' = t", hl: true },
      { label: 'Galilean velocity addition', tex: "u' = u - v", hl: true },
      { label: 'Acceleration is the same in both frames', tex: "a' = a", beyond: true },
    ],
    assumptions: [
      'Speeds much smaller than the speed of light, so Galilean relativity applies (see the Lorentz simulations for high speeds).',
      'The train moves at constant velocity (inertial frame); no air resistance; the ball lands on the train floor.',
      'Positions are measured from the point where both origins coincide at t = 0.',
    ],
    tryThis: [
      'Set u′ₓ = −v: what does the platform observer see the ball do?',
      'Throw the ball straight up in the train (u′ₓ = 0): where does it land in the train? In S?',
      'Compare the slopes of the two x–t graphs: they differ by exactly v.',
    ],
  };

  const H0 = 1.5; // launch height [m]
  let t = 0;
  const T = () => (params.uy + Math.sqrt(params.uy ** 2 + 2 * g * H0)) / g; // flight time
  const ball = (tt: number) => {
    const tc = Math.min(tt, T());
    const xp = params.ux * tc;
    const y = H0 + params.uy * tc - 0.5 * g * tc * tc;
    const x = xp + params.v * tc; // inverse Galilean: x = x′ + vt
    return { xp, x, y: Math.max(0, y) };
  };
  const viewS = new View();
  let ctx: CanvasRenderingContext2D | null = null;
  const W = { w: 1, h: 1 };

  function panel(ctx: CanvasRenderingContext2D, y0: number, hgt: number, frame: 'S' | "S'") {
    const pal = palette.pal;
    const tf = T();
    const xs = [0, params.v * tf, params.ux * tf, (params.ux + params.v) * tf, 20, -20];
    const lo = Math.min(...xs) - 6;
    const hi = Math.max(...xs) + 6;
    const scale = Math.min((W.w - 40) / (hi - lo), (hgt - 40) / 9);
    const X = (x: number) => 20 + (x - lo) * scale;
    const Y = (y: number) => y0 + hgt - 22 - y * scale;
    ctx.fillStyle = pal.text3;
    ctx.font = '700 11px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(frame === 'S' ? 'FRAME S: PLATFORM AT REST' : 'FRAME S′: TRAIN AT REST', 70, y0 + 6);
    // ground with marks: platform marks move in S′
    const shift = frame === 'S' ? 0 : params.v * t;
    ctx.strokeStyle = pal.gridStrong;
    ctx.beginPath();
    ctx.moveTo(0, Y(0));
    ctx.lineTo(W.w, Y(0));
    ctx.stroke();
    ctx.fillStyle = pal.text3;
    ctx.font = '500 10px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (let m = Math.floor((lo + shift) / 5) * 5; m <= hi + shift; m += 5) {
      const px = X(m - shift);
      ctx.fillRect(px - 0.5, Y(0), 1, 6);
      ctx.fillText(`${m}`, px, Y(0) + 8);
    }
    // train: in S it moves by vt; in S′ it stays
    const tx = frame === 'S' ? params.v * t : 0;
    ctx.fillStyle = alpha(pal.series[1].startsWith('#') ? pal.series[1] : '#f2711c', 0.18);
    ctx.strokeStyle = pal.series[1];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(X(tx - 8), Y(4), 24 * scale, 4 * scale, 6);
    ctx.fill();
    ctx.stroke();
    // ball path so far and ball
    ctx.strokeStyle = pal.series[0];
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    const n = 60;
    for (let i = 0; i <= n; i++) {
      const ti = (t * i) / n;
      const b = ball(ti);
      const bx = frame === 'S' ? b.x : b.xp;
      if (i === 0) ctx.moveTo(X(bx), Y(b.y));
      else ctx.lineTo(X(bx), Y(b.y));
    }
    ctx.stroke();
    ctx.setLineDash([]);
    const b = ball(t);
    const bx = frame === 'S' ? b.x : b.xp;
    ctx.fillStyle = pal.series[0];
    ctx.beginPath();
    ctx.arc(X(bx), Y(b.y), 7, 0, Math.PI * 2);
    ctx.fill();
    // velocity arrow of the ball in this frame
    const done = t >= T();
    const ux = frame === 'S' ? params.ux + params.v : params.ux;
    const uy = params.uy - g * Math.min(t, T());
    if (!done) drawArrow(ctx, X(bx), Y(b.y), X(bx) + ux * scale * 0.25, Y(b.y) - uy * scale * 0.25, pal.series[2], undefined, 2);
    // the other frame's velocity arrow (train or platform)
    const fv = frame === 'S' ? params.v : -params.v;
    if (Math.abs(fv) > 0.01) drawArrow(ctx, X((frame === 'S' ? tx : 0) + 4), Y(4.6), X((frame === 'S' ? tx : 0) + 4) + fv * scale * 0.3, Y(4.6), pal.series[1], undefined, 2);
  }

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    W.w = viewS.width;
    W.h = viewS.height;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W.w, W.h);
    const usable = W.h - 76;
    panel(ctx, 0, usable / 2, 'S');
    ctx.strokeStyle = pal.gridStrong;
    ctx.beginPath();
    ctx.moveTo(0, usable / 2);
    ctx.lineTo(W.w, usable / 2);
    ctx.stroke();
    panel(ctx, usable / 2, usable / 2, "S'");
  }

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        t += dt;
        if (t > T() + 0.6) ctrl.pause();
      },
      render: draw,
      sample: (tt, out) => {
        const b = ball(tt);
        const flying = tt < T();
        out[0] = tt;
        out[1] = b.x;
        out[2] = b.xp;
        out[3] = flying ? params.ux + params.v : 0;
        out[4] = flying ? params.ux : 0;
      },
      reset: () => {
        t = 0;
      },
    },
    { dt: 1e-3, channels, sampleInterval: 1 / 60, autoplay: true },
  );
  const palette = usePalette(() => ctrl);
  resetOn(ctrl, () => [params.v, params.ux, params.uy]);
  $effect(() => {
    void [params.v, params.ux, params.uy];
    if (ctx) ctrl.play();
  });

  const rows = $derived.by(() => {
    void ctrl.renderCount;
    const b = ball(t);
    const [xp] = galilean(b.x, Math.min(t, T()), params.v);
    return [
      { label: 'ball: x in S', value: fmt(b.x, 3), unit: 'm', color: '--series-1' },
      { label: 'x′ = x − vt', value: fmt(xp, 3), unit: 'm', color: '--series-2', strong: true },
      { label: 'uₓ in S = u′ₓ + v', value: fmt(params.ux + params.v, 3), unit: 'm s⁻¹' },
      { label: 't = t′', value: fmt(Math.min(t, T()), 3), unit: 's' },
    ];
  });

  onMount(() => {
    ctrl.mount();
    return () => ctrl.destroy();
  });
</script>

<SimShell {entry} {ctrl} {info} {graphs} initialGraphs={['x', 'u']}>
  {#snippet stage()}
    <SimCanvas
      view={viewS}
      label="Galilean transformation: train and platform frames"
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
      <Slider def={sl('ux')} bind:value={params.ux} />
      <Slider def={sl('uy')} bind:value={params.uy} />
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

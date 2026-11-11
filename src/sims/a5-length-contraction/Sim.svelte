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
  import { trainTunnel } from '../../physics/relativity';
  import { c } from '../../core/constants';
  import { alpha } from '../../sim/palette';
  import { drawTag, niceStep } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [
    { key: 'beta', label: 'Speed of the train', symbol: 'v/c', unit: '', min: 0.05, max: 0.99, step: 0.01 },
    { key: 'L0', label: 'Proper length of the train', symbol: 'L_0', unit: 'm', min: 20, max: 200, step: 5 },
    { key: 'T0', label: 'Proper length of the tunnel', symbol: 'T_0', unit: 'm', min: 20, max: 200, step: 5 },
  ];
  const { params, sl } = useParams({ beta: 0.8, L0: 100, T0: 80 }, sliders);
  const presets = [
    { id: 'paradox', label: '100 m train, 80 m tunnel, 0.8c', values: { beta: 0.8, L0: 100, T0: 80 } },
    { id: 'slow', label: 'Too slow: the train does not fit', values: { beta: 0.3, L0: 100, T0: 80 } },
    { id: 'fast', label: 'Very fast: 0.95c', values: { beta: 0.95, L0: 100, T0: 80 } },
  ];
  const channels: ChannelDef[] = [
    { key: 'ct', label: 'ct (own frame)', unit: 'm' },
    { key: 'xf', label: 'train front x (tunnel frame)', unit: 'm', color: '--series-2' },
    { key: 'xr', label: 'train rear x (tunnel frame)', unit: 'm', color: '--series-2', dash: [6, 4] },
    { key: 'xe', label: 'tunnel entrance x′ (train frame)', unit: 'm', color: '--series-1', dash: [6, 4] },
    { key: 'xx', label: 'tunnel exit x′ (train frame)', unit: 'm', color: '--series-1' },
  ];
  const graphs: GraphDef[] = [
    { id: 'S', title: 'Train in the tunnel frame S', series: ['xf', 'xr'] },
    { id: 'Sp', title: 'Tunnel in the train frame S′', series: ['xe', 'xx'] },
  ];
  const info: SimInfo = {
    about: [
      'A train with proper length L₀ (measured in its own rest frame) moves through a tunnel with proper length T₀ (measured in the tunnel’s rest frame). Each observer measures the other object as shorter by the factor γ: moving objects are contracted along the direction of motion.',
      'In the tunnel frame S the 100 m train is only 60 m long at 0.8c, so it fits inside the 80 m tunnel, and both doors can be closed at the same moment with the train inside. In the train frame S′ the tunnel is only 48 m long — the train cannot fit. So who is right?',
      'Both. The two door closings are simultaneous in S but not in S′: in the train frame the exit door closes first (before the front arrives) and opens again, and the entrance door closes later (after the rear has passed). Simultaneity is relative, so there is no contradiction.',
    ],
    formulas: [
      { label: 'Length contraction', tex: 'L = \\dfrac{L_0}{\\gamma}', hl: true },
      { label: 'Lorentz factor', tex: '\\gamma = \\dfrac{1}{\\sqrt{1 - \\dfrac{v^{2}}{c^{2}}}}', hl: true },
      { label: 'Lorentz transformation of time', tex: "t' = \\gamma\\left(t - \\dfrac{vx}{c^{2}}\\right)", hl: true },
      { label: 'Time between the door closings in S′', tex: "\\Delta t' = \\dfrac{\\gamma v T_0}{c^{2}}", beyond: true },
    ],
    assumptions: [
      'Time in the animation is slowed down enormously: the whole passage takes well under a microsecond.',
      'Each panel shows its own frame at its own time coordinate (ct in S, ct′ in S′); both start when the train front reaches the tunnel entrance.',
      'The doors close for a short moment and open again; they close only if the train fits in the tunnel frame.',
      'Only lengths along the motion contract; heights are unchanged.',
    ],
    tryThis: [
      'At what speed does the 100 m train just fit in the 80 m tunnel? (γ = 1.25)',
      'In the train frame, which door closes first? How long before the other, in nanoseconds?',
      'Make the tunnel longer than the train. Does the train fit in its own frame now?',
    ],
  };

  const DURATION = 8; // s of animation for the whole passage
  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;
  let t = 0;
  const model = $derived(trainTunnel(params.beta, params.L0, params.T0));
  // common ct range for both frames
  const range = $derived.by(() => {
    const b = params.beta;
    const m = model;
    const end = 1.08 * Math.max((params.T0 + m.trainInS) / b, (m.tunnelInSp + params.L0) / b);
    return { start: -0.12 * end, end };
  });
  const ctAt = (tt: number) => range.start + ((range.end - range.start) * Math.min(tt, DURATION)) / DURATION;
  const halfDoor = $derived(model.fits ? 0.25 * (model.ctFrontOut - model.ctRearIn) : 0);

  function panel(ctx: CanvasRenderingContext2D, y0: number, hgt: number, W: number, frame: 'S' | 'Sp', scale: number, xLo: number) {
    const pal = palette.pal;
    const m = model;
    const ct = ctAt(t);
    const X = (x: number) => 24 + (x - xLo) * scale;
    const base = y0 + hgt - 34;
    const trainH = Math.min(26, hgt * 0.22);
    const tunH = trainH + 18;
    ctx.fillStyle = pal.text3;
    ctx.font = '700 11px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(frame === 'S' ? 'FRAME S: TUNNEL AT REST' : 'FRAME S′: TRAIN AT REST', 70, y0 + 8);
    ctx.font = '500 11px Inter Variable, system-ui, sans-serif';
    ctx.fillText(`${frame === 'S' ? 'ct' : 'ct′'} = ${fmt(ct, 3)} m  (t = ${fmt((ct / c) * 1e9, 3)} ns)`, 70, y0 + 24);
    // ground ticks
    ctx.strokeStyle = pal.gridStrong;
    ctx.beginPath();
    ctx.moveTo(0, base);
    ctx.lineTo(W, base);
    ctx.stroke();
    const step = niceStep(scale, 60);
    ctx.fillStyle = pal.text3;
    ctx.font = '500 10px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (let x = Math.ceil(xLo / step) * step; X(x) < W; x += step) {
      ctx.fillRect(X(x) - 0.5, base, 1, 5);
      ctx.fillText(`${+x.toPrecision(6)}`.replace('-', '−'), X(x), base + 7);
    }
    ctx.fillText(frame === 'S' ? 'x / m' : 'x′ / m', W - 24, base + 18);
    // tunnel
    const ent = frame === 'S' ? 0 : m.entranceSpAt(ct);
    const ext = frame === 'S' ? params.T0 : m.exitSpAt(ct);
    ctx.fillStyle = alpha(pal.text3.startsWith('#') ? pal.text3 : '#888888', 0.18);
    ctx.fillRect(X(ent), base - tunH, X(ext) - X(ent), tunH);
    ctx.fillStyle = pal.text2;
    ctx.fillRect(X(ent), base - tunH - 6, X(ext) - X(ent), 6);
    // train
    const front = frame === 'S' ? m.frontS(ct) : 0;
    const rear = frame === 'S' ? m.rearS(ct) : -params.L0;
    ctx.fillStyle = alpha(pal.series[1].startsWith('#') ? pal.series[1] : '#f2711c', 0.85);
    ctx.beginPath();
    ctx.roundRect(X(rear), base - trainH - 2, X(front) - X(rear), trainH, [4, 10, 4, 4]);
    ctx.fill();
    // doors: closed for a short time around their events (dilated by γ in S′, where they move)
    const doors: [number, number][] =
      frame === 'S'
        ? [
            [ent, m.ctDoors],
            [ext, m.ctDoors],
          ]
        : [
            [ent, m.entranceSp[1]],
            [ext, m.exitSp[1]],
          ];
    const half = frame === 'S' ? halfDoor : halfDoor * m.gamma;
    doors.forEach(([xd, ctE], k) => {
      const closed = m.fits && Math.abs(ct - ctE) < half;
      ctx.fillStyle = closed ? pal.negative : alpha(pal.text2.startsWith('#') ? pal.text2 : '#666666', 0.35);
      ctx.fillRect(X(xd) - (closed ? 3 : 1), base - tunH, closed ? 6 : 2, tunH);
      if (closed) drawTag(ctx, X(xd), base - tunH - 18, k === 0 ? 'entrance closed' : 'exit closed', pal.negative, pal.surface);
    });
    // lengths
    ctx.fillStyle = pal.series[1];
    ctx.font = '600 11px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const trainLen = frame === 'S' ? m.trainInS : params.L0;
    const tunLen = frame === 'S' ? params.T0 : m.tunnelInSp;
    ctx.fillText(`train ${fmt(trainLen, 3)} m`, (X(rear) + X(front)) / 2, base - trainH - 6);
    ctx.fillStyle = pal.text2;
    ctx.textBaseline = 'top';
    ctx.fillText(`tunnel ${fmt(tunLen, 3)} m`, (X(ent) + X(ext)) / 2, base + 18);
    ctx.textBaseline = 'alphabetic';
  }

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const H = view.height;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    const usable = H - 76;
    const b = params.beta;
    const { start, end } = range;
    const m = model;
    // same scale in both panels, so the contraction is visible
    const sLo = b * start - m.trainInS;
    const sHi = Math.max(b * end, params.T0);
    const pLo = Math.min(-b * end, -params.L0);
    const pHi = Math.max(m.tunnelInSp - b * start, 0);
    const scale = (W - 48) / Math.max(sHi - sLo, pHi - pLo);
    panel(ctx, 0, usable / 2, W, 'S', scale, sLo);
    ctx.strokeStyle = pal.gridStrong;
    ctx.beginPath();
    ctx.moveTo(0, usable / 2);
    ctx.lineTo(W, usable / 2);
    ctx.stroke();
    panel(ctx, usable / 2, usable / 2, W, 'Sp', scale, pLo);
  }

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        t += dt;
        if (t > DURATION + 0.3) ctrl.pause();
      },
      render: draw,
      sample: (tt, out) => {
        const ct = ctAt(tt);
        out[0] = ct;
        out[1] = model.frontS(ct);
        out[2] = model.rearS(ct);
        out[3] = model.entranceSpAt(ct);
        out[4] = model.exitSpAt(ct);
        return tt <= DURATION;
      },
      reset: () => {
        t = 0;
      },
    },
    { dt: 1e-3, channels, sampleInterval: 1 / 30, autoplay: true },
  );
  const palette = usePalette(() => ctrl);
  resetOn(ctrl, () => [params.beta, params.L0, params.T0]);
  $effect(() => {
    void [params.beta, params.L0, params.T0];
    if (ctx) ctrl.play();
  });

  const rows = $derived.by(() => {
    const m = model;
    const dtp = (m.entranceSp[1] - m.exitSp[1]) / c;
    return [
      { label: 'γ', value: m.gamma.toFixed(4) },
      { label: 'train in S: L₀/γ', value: fmt(m.trainInS, 3), unit: 'm', color: '--series-2', strong: true },
      { label: 'tunnel in S′: T₀/γ', value: fmt(m.tunnelInSp, 3), unit: 'm', strong: true },
      { label: 'fits in tunnel frame?', value: m.fits ? 'yes' : 'no' },
      ...(m.fits ? [{ label: 'S′: exit closes earlier by', value: fmt(dtp * 1e9, 3), unit: 'ns' }] : []),
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
  {info}
  {graphs}
  initialGraphs={['S', 'Sp']}
  {presets}
  onpreset={(id) => Object.assign(params, presets.find((p) => p.id === id)?.values ?? {})}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      label="Length contraction: a train in a tunnel seen from both frames"
      onready={(c2) => {
        ctx = c2;
        ctrl.invalidate();
      }}
      onresize={() => ctrl.invalidate()}
    />
  {/snippet}
  {#snippet readouts()}<Readouts {rows} />{/snippet}
  {#snippet controls()}
    <div class="controls">
      <Slider def={sl('beta')} bind:value={params.beta} />
      <Slider def={sl('L0')} bind:value={params.L0} />
      <Slider def={sl('T0')} bind:value={params.T0} />
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

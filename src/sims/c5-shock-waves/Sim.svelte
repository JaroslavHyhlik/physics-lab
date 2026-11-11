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
  import type { SimInfo } from '../../sim/types';
  import { machAngle } from '../../physics/doppler';
  import { drawWavefronts } from '../../sim/wavefronts';
  import { alpha } from '../../sim/palette';
  import { drawTag } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [{ key: 'M', label: 'Speed of the source / speed of sound', symbol: 'u_s/v', unit: '', min: 0.3, max: 3, step: 0.01 }];
  const { params, sl } = useParams({ M: 2 }, sliders);
  const presets = [
    { id: 'sub', label: 'Subsonic (0.7 × speed of sound)', values: { M: 0.7 } },
    { id: 'sonic', label: 'At the speed of sound', values: { M: 1 } },
    { id: 'mach2', label: 'Mach 2', values: { M: 2 } },
    { id: 'mach3', label: 'Mach 3', values: { M: 3 } },
  ];
  const v = 340;
  const info: SimInfo = {
    about: [
      'A source moving slower than sound stays inside its own wavefronts. At the speed of sound the fronts pile up in front of it. Faster than sound, the source outruns its waves: the wavefronts overlap along a cone (in 3D) whose edge is a shock wave — the sonic boom heard on the ground as the cone passes.',
      'In the time t the source travels u_s t while the first wavefront has spread out to radius vt, so the half-angle of the cone is given by sin θ = v/u_s = 1/M, where M = u_s/v is the Mach number.',
    ],
    formulas: [
      { label: 'Mach cone', tex: '\\sin\\theta = \\dfrac{v}{u_s}', beyond: true },
      { label: 'Mach number', tex: 'M = \\dfrac{u_s}{v}', beyond: true },
    ],
    assumptions: ['Speed of sound 340 m s⁻¹ in still air; a point source moving in a straight line at constant speed.', 'Time is slowed down; only some wavefronts are drawn.'],
    tryThis: ['Measure the cone angle at Mach 2 with the protractor in your head: is it 30°?', 'Why is there no cone below Mach 1?', 'How does the cone change as the plane goes faster?'],
  };

  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;
  let t = 0;
  const f = 40; // Hz (fronts emitted)
  const SLOW = 0.08;

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const usable = view.height - 76;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, view.height);
    const wArea = W > 760 ? W - 270 : W;
    const us = params.M * v;
    const span = us * 0.6 + 60; // metres shown horizontally
    const scale = (wArea - 40) / span;
    const xs0 = -span / 2 + 10;
    const X = (x: number) => wArea / 2 + x * scale;
    const Y = (y: number) => usable / 2 - y * scale;
    const xs = xs0 + us * t;
    const skip = Math.max(1, Math.ceil(16 / (Math.min(v, Math.abs(v - us) + 1) / f * scale)));
    drawWavefronts(ctx, X, Y, scale, t, f, v, xs0, us, span, alpha(pal.series[0].startsWith('#') ? pal.series[0] : '#3b82f6', 0.5), skip);
    ctx.fillStyle = pal.series[3];
    ctx.beginPath();
    ctx.arc(X(xs), Y(0), 8, 0, Math.PI * 2);
    ctx.fill();
    const th = machAngle(v, us);
    if (th !== null) {
      const len = us * t;
      ctx.strokeStyle = pal.series[3];
      ctx.lineWidth = 2;
      for (const s of [1, -1]) {
        ctx.beginPath();
        ctx.moveTo(X(xs), Y(0));
        ctx.lineTo(X(xs - Math.cos(th) * len * Math.cos(th)), Y(s * Math.sin(th) * len * Math.cos(th)));
        ctx.stroke();
      }
      ctx.lineWidth = 1;
      drawTag(ctx, X(xs) - 60, Y(0) - 20, `θ = ${((th * 180) / Math.PI).toFixed(1)}°`, pal.series[3], pal.surface);
    }
  }

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        t += dt * SLOW;
        const us = params.M * v;
        if (us * t > (us * 0.6 + 60) - 30) t = 0;
      },
      render: draw,
      reset: () => {
        t = 0;
      },
    },
    { dt: 1 / 240, autoplay: true },
  );
  const palette = usePalette(() => ctrl);
  resetOn(ctrl, () => [params.M]);

  const rows = $derived.by(() => {
    const th = machAngle(v, params.M * v);
    return [
      { label: 'source speed u_s', value: fmt(params.M * v, 3), unit: 'm s⁻¹' },
      { label: 'Mach number', value: params.M.toFixed(2) },
      { label: 'cone half-angle θ', value: th === null ? 'no cone' : `${((th * 180) / Math.PI).toFixed(2)}°`, strong: true },
      { label: 'sin θ = v/u_s', value: th === null ? '—' : (1 / params.M).toFixed(4) },
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
  graphs={[]}
  {presets}
  onpreset={(id) => Object.assign(params, presets.find((q) => q.id === id)?.values ?? {})}
  stopwatch={false}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      label="Wavefronts of a supersonic source forming a Mach cone"
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
      <Slider def={sl('M')} bind:value={params.M} />
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

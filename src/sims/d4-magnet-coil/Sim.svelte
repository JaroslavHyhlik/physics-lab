<script lang="ts">
  import { onMount } from 'svelte';
  import SimShell from '../../sim/SimShell.svelte';
  import SimCanvas from '../../sim/SimCanvas.svelte';
  import Readouts from '../../sim/Readouts.svelte';
  import Slider from '../../ui/Slider.svelte';
  import Segmented from '../../ui/Segmented.svelte';
  import Toggle from '../../ui/Toggle.svelte';
  import { SimController } from '../../sim/controller.svelte';
  import { useParams, usePalette, resetOn } from '../../sim/setup.svelte';
  import { View } from '../../sim/view';
  import { Interaction } from '../../sim/interaction';
  import type { SimEntry } from '../../app/registry';
  import type { NumberParamDef } from '../../sim/params.svelte';
  import type { SimInfo, GraphDef } from '../../sim/types';
  import type { ChannelDef } from '../../core/recorder';
  import { fluxFromMagnet, emfMagnetCoil, type MagnetModel } from '../../physics/induction';
  import { drawTag } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [
    { key: 'N', label: 'Number of turns', symbol: 'N', unit: '', min: 10, max: 1000, step: 10 },
    { key: 'v', label: 'Speed of the magnet', symbol: 'v', unit: 'm s⁻¹', min: 0.05, max: 1.5, step: 0.01 },
    { key: 'f', label: 'Frequency of oscillation', symbol: 'f', unit: 'Hz', min: 0.2, max: 3, step: 0.05 },
  ];
  const { params, sl } = useParams({ motion: 'push', N: 200, v: 0.3, f: 1, flip: false }, sliders);
  const presets = [
    { id: 'push', label: 'Push the magnet through the coil', values: { motion: 'push', v: 0.3, N: 200 } },
    { id: 'fast', label: 'Twice as fast', values: { motion: 'push', v: 0.6, N: 200 } },
    { id: 'osc', label: 'Magnet bouncing on a spring', values: { motion: 'osc', f: 1, N: 200 } },
    { id: 'drag', label: 'Move it yourself', values: { motion: 'drag' } },
  ];
  const mag: MagnetModel = { a: 0.008, length: 0.05, loops: 30, I: 300 };
  const RC = 0.02; // coil radius [m]
  const RES = 10; // resistance of coil + meter [Ω]
  const channels: ChannelDef[] = [
    { key: 't', label: 't', unit: 's' },
    { key: 'phi', label: 'flux linkage NΦ', unit: 'mWb', color: '--series-1' },
    { key: 'emf', label: 'induced emf ε', unit: 'mV', color: '--series-4' },
  ];
  const graphs: GraphDef[] = [
    { id: 'phi', title: 'Flux linkage', series: ['phi'] },
    { id: 'emf', title: 'Induced emf', series: ['emf'] },
  ];
  const info: SimInfo = {
    about: [
      'Magnetic flux Φ = BA cos θ measures how much magnetic field passes through an area. For a coil of N turns the flux linkage is NΦ.',
      'Faraday’s law: an emf is induced whenever the flux linkage changes, ε = −NΔΦ/Δt. Moving the magnet faster, or using more turns, gives a bigger emf. A stationary magnet induces nothing, however strong.',
      'Lenz’s law (the minus sign): the induced current flows so that its own magnetic field opposes the change that caused it. Push a north pole in and the near end of the coil becomes a north pole, repelling the magnet; pull it out and that end becomes south, attracting it. You must do work to move the magnet — that is where the electrical energy comes from.',
    ],
    formulas: [
      { label: 'Magnetic flux', tex: '\\Phi = BA\\cos\\theta', hl: true },
      { label: 'Faraday’s and Lenz’s law', tex: '\\varepsilon = -N\\dfrac{\\Delta\\Phi}{\\Delta t}', hl: true },
    ],
    assumptions: [
      'Bar magnet 5 cm long, 8 mm radius, modelled by its equivalent surface current (field at its centre about 0.4 T); thin coil of radius 2 cm. Flux from the exact mutual inductance of circular turns.',
      'Total resistance of coil and meter 10 Ω; the coil’s self-inductance and the force on the magnet are ignored.',
      'Moving the magnet yourself: the speed comes from your drag, so the emf is noisier.',
    ],
    tryThis: [
      'Why does the emf change sign as the magnet passes through the middle of the coil?',
      'Double the speed: what happens to the peak emf and to the time the pulse lasts? What about the area under the emf graph?',
      'Flip the magnet. What changes on the graphs?',
    ],
  };

  const view = new View();
  const inter = new Interaction();
  let ctx: CanvasRenderingContext2D | null = null;
  let t = 0;
  let xm = -0.15;
  let vm = 0;
  let dragX: number | null = null;
  let peakI = 1e-5;
  let lastDragX = 0;
  const sgn = () => (params.flip ? -1 : 1);
  const geo = { cx: 0, cy: 0, sc: 1000 };

  function position(tt: number): [number, number] {
    if (params.motion === 'push') {
      const x = -0.15 + params.v * tt;
      return [x, params.v];
    }
    const w = 2 * Math.PI * params.f;
    return [-0.04 + 0.06 * Math.sin(w * tt), 0.06 * w * Math.cos(w * tt)];
  }
  const emfNow = () => sgn() * emfMagnetCoil(mag, RC, params.N, xm, vm);
  const fluxNow = () => sgn() * params.N * fluxFromMagnet(mag, RC, xm);

  inter.add({
    priority: 10,
    cursor: 'grab',
    hit: (px, py) => {
      if (params.motion !== 'drag') return Infinity;
      const X = geo.cx + xm * geo.sc;
      return Math.abs(py - geo.cy) < 30 && Math.abs(px - X) < (mag.length / 2) * geo.sc + 10 ? 0 : Infinity;
    },
    start: () => {
      if (!ctrl.running) ctrl.play();
    },
    move: (px) => {
      dragX = Math.max(-0.2, Math.min(0.2, (px - geo.cx) / geo.sc));
    },
    end: () => {
      dragX = null;
    },
  });

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const usable = view.height - 76;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, view.height);
    const wArea = W > 760 ? W - 270 : W;
    geo.sc = Math.min((wArea - 60) / 0.45, 1800);
    geo.cx = wArea / 2;
    geo.cy = usable * 0.4;
    const X = (x: number) => geo.cx + x * geo.sc;
    // coil: back halves, magnet, front halves
    const turnsDrawn = Math.min(14, 3 + Math.round(params.N / 80));
    const coilW = 0.012 + 0.03 * Math.min(1, params.N / 1000);
    const rx = 8;
    const ry = RC * geo.sc;
    const emf = emfNow();
    const halfTurn = (front: boolean) => {
      ctx!.strokeStyle = pal.hl;
      ctx!.lineWidth = 2.5;
      for (let i = 0; i < turnsDrawn; i++) {
        const x = X(-coilW / 2 + (coilW * (i + 0.5)) / turnsDrawn);
        ctx!.beginPath();
        ctx!.ellipse(x, geo.cy, rx, ry, 0, front ? -Math.PI / 2 : Math.PI / 2, front ? Math.PI / 2 : (3 * Math.PI) / 2);
        ctx!.stroke();
      }
      ctx!.lineWidth = 1;
    };
    halfTurn(false);
    // magnet
    const mx0 = X(xm - mag.length / 2);
    const mw = mag.length * geo.sc;
    const mh = Math.max(14, 2 * mag.a * geo.sc);
    const northRight = !params.flip;
    ctx.fillStyle = northRight ? pal.series[0] : pal.series[3];
    ctx.fillRect(mx0, geo.cy - mh / 2, mw / 2, mh);
    ctx.fillStyle = northRight ? pal.series[3] : pal.series[0];
    ctx.fillRect(mx0 + mw / 2, geo.cy - mh / 2, mw / 2, mh);
    ctx.fillStyle = pal.surface;
    ctx.font = '700 12px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(northRight ? 'S' : 'N', mx0 + mw / 4, geo.cy);
    ctx.fillText(northRight ? 'N' : 'S', mx0 + (3 * mw) / 4, geo.cy);
    halfTurn(true);
    // Lenz: polarity of the coil's ends from the direction of its own field
    const dPhi = -emf; // sign of dΦ/dt (with N > 0)
    if (Math.abs(emf) > 1e-5) {
      const coilFieldRight = dPhi < 0; // induced field opposes the change
      drawTag(ctx, X(-coilW / 2) - 18, geo.cy - ry - 16, coilFieldRight ? 'S' : 'N', coilFieldRight ? pal.series[0] : pal.series[3], pal.surface);
      drawTag(ctx, X(coilW / 2) + 18, geo.cy - ry - 16, coilFieldRight ? 'N' : 'S', coilFieldRight ? pal.series[3] : pal.series[0], pal.surface);
    }
    // galvanometer
    const gx = geo.cx;
    const gy = geo.cy + ry + 100;
    const I = emf / RES;
    peakI = Math.max(peakI * 0.995, Math.abs(I), 1e-5);
    const full = 1.2 * peakI; // auto-ranging meter
    const ang = Math.max(-1, Math.min(1, I / full)) * (Math.PI / 3);
    ctx.strokeStyle = pal.text2;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(gx, gy, 46, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    ctx.strokeStyle = pal.series[3];
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx + Math.sin(ang) * 44, gy - Math.cos(ang) * 44);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = pal.text2;
    ctx.beginPath();
    ctx.arc(gx, gy, 4, 0, Math.PI * 2);
    ctx.fill();
    drawTag(ctx, gx, gy + 18, `I = ${fmt(I * 1000, 3)} mA`, pal.ink, pal.surface);
    // leads from the coil to the meter
    ctx.strokeStyle = pal.text3;
    ctx.beginPath();
    ctx.moveTo(X(-coilW / 2), geo.cy + ry);
    ctx.lineTo(gx - 40, gy - 20);
    ctx.moveTo(X(coilW / 2), geo.cy + ry);
    ctx.lineTo(gx + 40, gy - 20);
    ctx.stroke();
  }

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        t += dt;
        if (params.motion === 'drag') {
          const target = dragX ?? xm;
          vm = dragX === null ? 0 : (target - lastDragX) / dt;
          // smooth the velocity a little (finger and mouse positions are noisy)
          xm = target;
          lastDragX = target;
        } else {
          [xm, vm] = position(t);
          if (params.motion === 'push' && xm > 0.17) ctrl.pause();
        }
      },
      render: draw,
      sample: (_t, out) => {
        out[0] = t;
        out[1] = fluxNow() * 1e3;
        out[2] = emfNow() * 1e3;
      },
      reset: () => {
        t = 0;
        [xm, vm] = params.motion === 'drag' ? [-0.12, 0] : position(0);
        lastDragX = xm;
      },
    },
    { dt: 1 / 240, channels, sampleInterval: 1 / 60, autoplay: true },
  );
  const palette = usePalette(() => ctrl);
  resetOn(ctrl, () => [params.motion, params.N, params.v, params.f, params.flip]);
  $effect(() => {
    void [params.motion, params.N, params.v, params.f, params.flip];
    if (ctx) ctrl.play();
  });
  inter.onChange = () => ctrl.invalidate();

  const rows = $derived.by(() => {
    void ctrl.renderCount;
    return [
      { label: 'flux linkage NΦ', value: fmt(fluxNow() * 1e3, 3), unit: 'mWb', color: '--series-1' },
      { label: 'induced emf ε', value: fmt(emfNow() * 1e3, 3), unit: 'mV', color: '--series-4', strong: true },
      { label: 'magnet speed', value: fmt(vm, 3), unit: 'm s⁻¹' },
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
  initialGraphs={['phi', 'emf']}
  {presets}
  onpreset={(id) => Object.assign(params, presets.find((q) => q.id === id)?.values ?? {})}
  shortcuts={false}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      interaction={inter}
      label="Bar magnet moving through a coil connected to a meter"
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
      <Segmented
        label="Motion"
        bind:value={params.motion}
        options={[
          { value: 'push', label: 'Push through' },
          { value: 'osc', label: 'Oscillate' },
          { value: 'drag', label: 'Drag' },
        ]}
      />
      <Slider def={sl('N')} bind:value={params.N} />
      {#if params.motion === 'push'}<Slider def={sl('v')} bind:value={params.v} />{/if}
      {#if params.motion === 'osc'}<Slider def={sl('f')} bind:value={params.f} />{/if}
      <Toggle label="Flip the magnet" bind:checked={params.flip} />
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

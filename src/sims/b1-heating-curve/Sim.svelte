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
  import { WATER, heatingState, stageEnergies, energyToReach, type HeatingState } from '../../physics/heating';
  import { alpha } from '../../sim/palette';
  import { drawTag } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [
    { key: 'm', label: 'Mass of ice', symbol: 'm', unit: 'kg', min: 0.1, max: 2, step: 0.05 },
    { key: 'P', label: 'Heater power', symbol: 'P', unit: 'W', min: 100, max: 3000, step: 50 },
    { key: 'T0', label: 'Starting temperature', symbol: 'T_0', unit: '°C', min: -50, max: -1, step: 1 },
  ];
  const { params, sl } = useParams({ m: 0.5, P: 1000, T0: -20 }, sliders);
  const presets = [
    { id: 'kettle', label: '0.5 kg of ice, 1 kW heater', values: { m: 0.5, P: 1000, T0: -20 } },
    { id: 'weak', label: 'Weak heater: 300 W', values: { m: 0.5, P: 300, T0: -20 } },
    { id: 'big', label: 'Twice the mass: 1 kg', values: { m: 1, P: 1000, T0: -20 } },
  ];
  const T_END = 130; // °C, the run stops here
  const channels: ChannelDef[] = [
    { key: 't', label: 't', unit: 's' },
    { key: 'T', label: 'temperature T', unit: '°C', color: '--series-4' },
    { key: 'ms', label: 'ice', unit: 'kg', color: '--series-3' },
    { key: 'ml', label: 'water', unit: 'kg', color: '--series-1' },
    { key: 'mg', label: 'steam', unit: 'kg', color: '--series-5' },
    { key: 'Q', label: 'energy supplied Q', unit: 'kJ', color: '--series-2' },
  ];
  const graphs: GraphDef[] = [
    { id: 'T', title: 'Temperature against time', series: ['T'] },
    { id: 'm', title: 'Mass in each phase', series: ['ms', 'ml', 'mg'] },
    { id: 'Q', title: 'Energy supplied', series: ['Q'] },
  ];
  const info: SimInfo = {
    about: [
      'A heater with constant power P warms a block of ice. The energy supplied grows steadily, Q = Pt, but the temperature does not.',
      'While the ice, the water or the steam warms up, the energy increases the random kinetic energy of the particles, so the temperature rises: Q = mcΔT. The slope of the graph is P/(mc), so a substance with a larger specific heat capacity c warms more slowly.',
      'During melting and boiling the temperature stays constant. The energy now increases the potential energy of the particles as the bonds between them are broken: Q = mL. The flat parts last mL/P. Boiling takes much longer than melting because L for vaporization is almost seven times larger.',
    ],
    formulas: [
      { label: 'Specific heat capacity', tex: 'Q = mc\\,\\Delta T' },
      { label: 'Specific latent heat', tex: 'Q = mL' },
      { label: 'Power of the heater', tex: 'P = \\dfrac{Q}{t}' },
      { label: 'Slope while one phase warms', tex: '\\dfrac{\\Delta T}{\\Delta t} = \\dfrac{P}{mc}', beyond: true },
      { label: 'Length of a plateau', tex: '\\Delta t = \\dfrac{mL}{P}', beyond: true },
    ],
    assumptions: [
      'All the energy from the heater goes into the water: no heat losses to the surroundings, and the container’s heat capacity is ignored.',
      'The temperature is the same everywhere in the sample at each moment.',
      'Normal atmospheric pressure: melting at 0 °C and boiling at 100 °C. The steam is kept and heated further (as in a closed, expanding container).',
      'Material data (typical textbook values, CRC Handbook): c(ice) = 2100, c(water) = 4180, c(steam) = 2000 J kg⁻¹ K⁻¹; L_f = 3.34 × 10⁵ J kg⁻¹, L_v = 2.26 × 10⁶ J kg⁻¹. Specific heat capacities are taken as constant.',
      'Time is sped up in the animation; the graph and readouts show the real time.',
    ],
    tryThis: [
      'Measure the length of the melting plateau on the graph and use it to find L_f. Compare with the value in the assumptions.',
      'Why is the slope steeper for ice than for liquid water?',
      'Double the mass. Which parts of the graph change, and by how much?',
    ],
  };

  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;
  let ta = 0; // animation time [s]
  const st: HeatingState = { T: -20, solid: 0.5, liquid: 0, gas: 0, stage: 'solid' };
  // the whole run takes about 24 s of animation at 1×
  const tTotal = $derived(energyToReach(T_END, params.m, params.T0) / params.P);
  const speedUp = $derived(tTotal / 24);
  const tReal = () => ta * speedUp;
  const update = () => heatingState(params.P * tReal(), params.m, params.T0, WATER, st);

  const stageText: Record<HeatingState['stage'], string> = {
    solid: 'Ice warms up: Q = mcΔT',
    melting: 'Ice melts at 0 °C: Q = mL',
    liquid: 'Water warms up: Q = mcΔT',
    boiling: 'Water boils at 100 °C: Q = mL',
    gas: 'Steam warms up: Q = mcΔT',
  };

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const usable = view.height - 76;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, view.height);
    update();
    const m = params.m;
    // beaker
    const bw = Math.min(200, W * 0.36);
    const bh = Math.min(220, usable * 0.6);
    const bx = W * (W > 700 ? 0.3 : 0.42) - bw / 2;
    const by = usable - bh - 40;
    const water = pal.series[0].startsWith('#') ? pal.series[0] : '#3b82f6';
    // contents: height proportional to mass of liquid (ice drawn as cubes)
    const fillH = (bh - 30) * Math.min(1, m / 2.2) + 20;
    const liquidH = fillH * (st.liquid / m);
    if (liquidH > 0.5) {
      ctx.fillStyle = alpha(water, 0.35);
      ctx.fillRect(bx, by + bh - liquidH, bw, liquidH);
    }
    // ice cubes: number proportional to the solid mass
    const nCubes = Math.round(12 * (st.solid / m));
    const cs = Math.min(30, bw / 5);
    for (let i = 0; i < nCubes; i++) {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const cx = bx + 12 + col * (cs + 10) + (row % 2) * 8;
      const cy = by + bh - (row + 1) * (cs + 4) - (liquidH > 0 ? Math.max(0, liquidH - (row + 1) * (cs + 4)) * 0.3 : 0);
      ctx.fillStyle = alpha(water, 0.18);
      ctx.strokeStyle = alpha(water, 0.8);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(cx, cy, cs, cs, 4);
      ctx.fill();
      ctx.stroke();
    }
    // bubbles while boiling, steam cloud above
    if (st.stage === 'boiling') {
      ctx.strokeStyle = alpha(water, 0.7);
      for (let i = 0; i < 14; i++) {
        const ph = (ta * 1.7 + i * 0.37) % 1;
        const x = bx + 15 + ((i * 53) % (bw - 30));
        const y = by + bh - ph * liquidH;
        ctx.beginPath();
        ctx.arc(x, y, 2 + 3 * ph, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    if (st.gas > 0) {
      const steam = pal.text3.startsWith('#') ? pal.text3 : '#888888';
      const n = Math.round(30 * (st.gas / m)) + 2;
      for (let i = 0; i < n; i++) {
        const ph = (ta * 0.5 + i * 0.173) % 1;
        const x = bx + bw / 2 + Math.sin(i * 2.1 + ta) * bw * 0.35;
        const y = by + bh - liquidH - 10 - ph * (bh - liquidH);
        ctx.fillStyle = alpha(steam, 0.25 * (1 - ph) + 0.05);
        ctx.beginPath();
        ctx.arc(x, y, 8 + 10 * ph, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // glass
    ctx.strokeStyle = pal.text2;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx, by + bh);
    ctx.lineTo(bx + bw, by + bh);
    ctx.lineTo(bx + bw, by);
    ctx.stroke();
    // heater
    const glow = pal.series[3];
    ctx.fillStyle = pal.text2;
    ctx.fillRect(bx - 20, by + bh + 4, bw + 40, 16);
    ctx.fillStyle = alpha(glow.startsWith('#') ? glow : '#e11d48', 0.3 + 0.5 * Math.min(1, params.P / 3000));
    ctx.fillRect(bx - 12, by + bh + 8, bw + 24, 6);
    ctx.fillStyle = pal.text2;
    ctx.font = '600 11px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`heater ${fmt(params.P, 3)} W`, bx + bw / 2, by + bh + 24);
    // thermometer
    const tx = bx + bw + 46;
    const t0y = by + bh - 10;
    const t1y = by - 10;
    const Ty = (T: number) => t0y - ((T + 50) / (T_END + 50)) * (t0y - t1y);
    ctx.strokeStyle = pal.text2;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(tx - 7, t1y - 8, 14, t0y - t1y + 16, 7);
    ctx.stroke();
    ctx.fillStyle = pal.series[3];
    ctx.fillRect(tx - 3, Ty(st.T), 6, t0y + 4 - Ty(st.T));
    ctx.beginPath();
    ctx.arc(tx, t0y + 12, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.text3;
    ctx.font = '500 10px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (const T of [-40, 0, 50, 100]) {
      ctx.fillRect(tx + 8, Ty(T), 5, 1);
      ctx.fillText(`${T} °C`, tx + 16, Ty(T));
    }
    drawTag(ctx, tx, t1y - 26, `${st.T.toFixed(1)} °C`, pal.series[3], pal.surface);
    // stage caption
    ctx.textAlign = 'center';
    drawTag(ctx, bx + bw / 2, by - 30, stageText[st.stage], pal.ink, pal.surface);
  }

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        ta += dt;
        if (tReal() >= tTotal) {
          ta = tTotal / speedUp;
          ctrl.pause();
        }
      },
      render: draw,
      sample: (tt, out) => {
        const t = Math.min(tt * speedUp, tTotal);
        const s = heatingState(params.P * t, params.m, params.T0);
        out[0] = t;
        out[1] = s.T;
        out[2] = s.solid;
        out[3] = s.liquid;
        out[4] = s.gas;
        out[5] = (params.P * t) / 1000;
        return tt * speedUp <= tTotal * 1.001;
      },
      reset: () => {
        ta = 0;
      },
    },
    { dt: 1 / 240, channels, sampleInterval: 1 / 30, autoplay: true },
  );
  const palette = usePalette(() => ctrl);
  resetOn(ctrl, () => [params.m, params.P, params.T0]);
  $effect(() => {
    void [params.m, params.P, params.T0];
    if (ctx) ctrl.play();
  });

  const rows = $derived.by(() => {
    void ctrl.renderCount;
    const s = heatingState(params.P * tReal(), params.m, params.T0);
    const [q1, q2, q3, q4] = stageEnergies(params.m, params.T0);
    const P = params.P;
    return [
      { label: 'real time t', value: fmt(tReal(), 3), unit: 's' },
      { label: 'temperature', value: s.T.toFixed(1), unit: '°C', color: '--series-4', strong: true },
      { label: 'energy Q = Pt', value: fmt((P * tReal()) / 1000, 3), unit: 'kJ' },
      { label: 'ice / water / steam', value: `${s.solid.toFixed(3)} / ${s.liquid.toFixed(3)} / ${s.gas.toFixed(3)}`, unit: 'kg' },
      { label: 'melting plateau mL/P', value: fmt((q2 - q1) / P, 3), unit: 's' },
      { label: 'boiling plateau mL/P', value: fmt((q4 - q3) / P, 3), unit: 's' },
      { label: 'animation speed-up', value: `×${fmt(speedUp, 2)}` },
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
  initialGraphs={['T', 'm']}
  stopwatch={false}
  {presets}
  onpreset={(id) => Object.assign(params, presets.find((p) => p.id === id)?.values ?? {})}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      label="Heating curve: ice on a heater turning into water and steam"
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
      <Slider def={sl('m')} bind:value={params.m} />
      <Slider def={sl('P')} bind:value={params.P} />
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

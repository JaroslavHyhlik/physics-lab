<script lang="ts">
  import { onMount } from 'svelte';
  import SimShell from '../../sim/SimShell.svelte';
  import SimCanvas from '../../sim/SimCanvas.svelte';
  import Readouts from '../../sim/Readouts.svelte';
  import Slider from '../../ui/Slider.svelte';
  import Toggle from '../../ui/Toggle.svelte';
  import { SimController } from '../../sim/controller.svelte';
  import { useParams, usePalette, resetOn } from '../../sim/setup.svelte';
  import { View } from '../../sim/view';
  import type { SimEntry } from '../../app/registry';
  import type { NumberParamDef } from '../../sim/params.svelte';
  import type { SimInfo, GraphDef } from '../../sim/types';
  import type { ChannelDef } from '../../core/recorder';
  import { Calorimeter, MATERIALS, cFromMixture, type Material } from '../../physics/calorimetry';
  import { alpha } from '../../sim/palette';
  import { drawArrow, drawTag } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [
    { key: 'm1', label: 'Mass of the hot object', symbol: 'm_1', unit: 'kg', min: 0.05, max: 1, step: 0.01 },
    { key: 'T1', label: 'Its starting temperature', symbol: 'T_1', unit: '°C', min: 30, max: 100, step: 1 },
    { key: 'm2', label: 'Mass of cold water', symbol: 'm_2', unit: 'kg', min: 0.05, max: 1, step: 0.01 },
    { key: 'T2', label: 'Water starting temperature', symbol: 'T_2', unit: '°C', min: 5, max: 40, step: 1 },
  ];
  const defaults = { mat: 'copper' as Material, m1: 0.2, T1: 95, m2: 0.25, T2: 20, cup: false, loss: false };
  const { params, sl } = useParams(defaults, sliders);
  const presets = [
    { id: 'cu', label: 'Hot copper block in water', values: { mat: 'copper', m1: 0.2, T1: 95, m2: 0.25, T2: 20, cup: false, loss: false } },
    { id: 'pb', label: 'Lead: small c, small temperature rise', values: { mat: 'lead', m1: 0.2, T1: 95, m2: 0.25, T2: 20, cup: false, loss: false } },
    { id: 'mix', label: 'Mixing hot and cold water', values: { mat: 'water', m1: 0.1, T1: 80, m2: 0.2, T2: 20, cup: false, loss: false } },
    { id: 'real', label: 'Real experiment: cup and heat loss', values: { mat: 'aluminium', m1: 0.2, T1: 95, m2: 0.25, T2: 20, cup: true, loss: true } },
  ];
  const matNames: Record<Material, string> = { copper: 'Copper', aluminium: 'Aluminium', iron: 'Iron', lead: 'Lead', water: 'Hot water' };
  const CUP = 0.1 * MATERIALS.aluminium; // aluminium cup of 100 g [J K⁻¹]
  const H_LOSS = 0.8; // W K⁻¹, heat loss of an open, uninsulated cup (order of magnitude)
  const T_ROOM = 20;
  const channels: ChannelDef[] = [
    { key: 't', label: 't', unit: 's' },
    { key: 'T1', label: 'hot object T₁', unit: '°C', color: '--series-4' },
    { key: 'T2', label: 'water T₂', unit: '°C', color: '--series-1' },
    { key: 'Qo', label: 'energy given out by the object', unit: 'J', color: '--series-4' },
    { key: 'Qi', label: 'energy taken in by the water', unit: 'J', color: '--series-1', dash: [6, 4] },
    { key: 'Ql', label: 'energy lost to the room', unit: 'J', color: '--series-5' },
  ];
  const graphs: GraphDef[] = [
    { id: 'T', title: 'Temperatures', series: ['T1', 'T2'] },
    { id: 'Q', title: 'Energy transferred', series: ['Qo', 'Qi', 'Ql'] },
  ];
  const info: SimInfo = {
    about: [
      'A hot object is put into cold water in an insulated cup (a calorimeter). Energy flows from the hotter object to the colder water until they reach the same temperature: thermal equilibrium.',
      'If no energy is lost, the energy given out by the object equals the energy taken in by the water: m₁c₁(T₁ − T_f) = m₂c₂(T_f − T₂). This is the method of mixtures. Measuring T_f lets you find an unknown specific heat capacity.',
      'A metal with a small c (such as lead) hardly warms the water, even though it starts hot. Water, with its large c, can store a lot of energy for each kelvin.',
      'In a real experiment some energy also warms the cup and escapes to the room. Switch these on to see why the measured value of c usually comes out too small.',
    ],
    formulas: [
      { label: 'Specific heat capacity', tex: 'Q = mc\\,\\Delta T' },
      { label: 'Energy balance (no losses)', tex: 'm_1c_1(T_1 - T_f) = m_2c_2(T_f - T_2)', beyond: true },
      { label: 'Final temperature', tex: 'T_f = \\dfrac{m_1c_1T_1 + m_2c_2T_2}{m_1c_1 + m_2c_2}', beyond: true },
    ],
    assumptions: [
      'The water is stirred, so it has one temperature; so does the object.',
      'The rate of heat flow between object and water is proportional to their temperature difference (5 W K⁻¹ for a metal block, much faster for mixing water). This only changes how quickly equilibrium is reached, not the final temperature.',
      'Specific heat capacities (typical values, CRC Handbook): copper 385, aluminium 900, iron 450, lead 130, water 4180 J kg⁻¹ K⁻¹.',
      'Cup: 100 g of aluminium (heat capacity 90 J K⁻¹), always at the water temperature. Heat loss (beyond syllabus): 0.8 W K⁻¹ to a room at 20 °C.',
      'No water evaporates; the hot object is moved into the water instantly.',
    ],
    tryThis: [
      'Predict T_f for the copper preset by hand, then check it.',
      'Switch on the cup and heat loss. Use the highest water temperature to calculate c of aluminium: is it too big or too small?',
      'Mix 0.1 kg of water at 80 °C with 0.2 kg at 20 °C. Why is the result exactly 40 °C?',
    ],
  };

  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;
  const build = () => {
    const C1 = params.m1 * MATERIALS[params.mat];
    const C2 = params.m2 * MATERIALS.water + (params.cup ? CUP : 0);
    return new Calorimeter(C1, C2, params.T1, params.T2, params.mat === 'water' ? 60 : 5, params.loss ? H_LOSS : 0, T_ROOM);
  };
  let cal = build();
  let maxT2 = params.T2;
  const tau = () => 1 / (cal.K * (1 / cal.C1 + 1 / cal.C2));
  const tEnd = () => Math.min(600, Math.max(30, 7 * tau()) + (params.loss ? 60 : 0));

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const usable = view.height - 76;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, view.height);
    const T1 = cal.y[0];
    const T2 = cal.y[1];
    const cw = Math.min(240, W * 0.42);
    const ch = Math.min(220, usable * 0.62);
    const cx = (W > 700 ? W * 0.32 : W * 0.4) - cw / 2;
    const cy = usable - ch - 10;
    const waterCol = pal.series[0].startsWith('#') ? pal.series[0] : '#3b82f6';
    const hotCol = pal.series[3].startsWith('#') ? pal.series[3] : '#e11d48';
    const span = Math.max(1, params.T1 - params.T2);
    // insulation jacket
    ctx.fillStyle = alpha(pal.text3.startsWith('#') ? pal.text3 : '#888888', 0.15);
    ctx.fillRect(cx - 18, cy - 4, cw + 36, ch + 22);
    // water (tinted when warmer)
    const fillH = ch * Math.min(0.92, 0.35 + 0.5 * ((params.m2 + (params.mat === 'water' ? params.m1 : 0)) / 1.2));
    ctx.fillStyle = alpha(waterCol, 0.3);
    ctx.fillRect(cx, cy + ch - fillH, cw, fillH);
    ctx.fillStyle = alpha(hotCol, 0.35 * Math.max(0, (T2 - params.T2) / span));
    ctx.fillRect(cx, cy + ch - fillH, cw, fillH);
    if (params.mat === 'water') {
      // hot water poured on top, mixing in
      const left = Math.max(0, (T1 - T2) / span);
      ctx.fillStyle = alpha(hotCol, 0.45 * left);
      ctx.fillRect(cx, cy + ch - fillH, cw, fillH * 0.35);
    } else {
      // metal block
      const bs = Math.min(70, cw * 0.32) * Math.cbrt(params.m1 / 0.2);
      const bx = cx + cw / 2 - bs / 2;
      const by = cy + ch - bs - 6;
      ctx.fillStyle = pal.text2;
      ctx.beginPath();
      ctx.roundRect(bx, by, bs, bs, 4);
      ctx.fill();
      ctx.fillStyle = alpha(hotCol, 0.85 * Math.max(0, (T1 - params.T2) / span));
      ctx.beginPath();
      ctx.roundRect(bx, by, bs, bs, 4);
      ctx.fill();
      // heat flow arrows, length ∝ power
      const P = cal.K * (T1 - T2);
      const len = Math.min(60, 4 * Math.sqrt(Math.max(0, P)));
      if (len > 4) {
        for (const dir of [-1, 1]) drawArrow(ctx, bx + bs / 2 + (dir * bs) / 2, by + bs / 2, bx + bs / 2 + dir * (bs / 2 + len), by + bs / 2, hotCol, undefined, 2);
        drawArrow(ctx, bx + bs / 2, by, bx + bs / 2, by - len, hotCol, undefined, 2);
      }
      ctx.fillStyle = pal.text3;
      ctx.font = '600 11px Inter Variable, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(matNames[params.mat].toLowerCase(), bx + bs / 2, by + bs + 2);
    }
    // cup walls
    ctx.strokeStyle = params.cup ? pal.text2 : alpha(pal.text2.startsWith('#') ? pal.text2 : '#555555', 0.6);
    ctx.lineWidth = params.cup ? 4 : 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy + ch);
    ctx.lineTo(cx + cw, cy + ch);
    ctx.lineTo(cx + cw, cy);
    ctx.stroke();
    ctx.lineWidth = 1;
    // losses to the room
    if (params.loss && T2 > T_ROOM + 0.05) {
      const Pl = H_LOSS * (T2 - T_ROOM);
      const len = Math.min(40, 6 * Math.sqrt(Pl));
      for (const y of [cy + ch * 0.4, cy + ch * 0.75]) {
        drawArrow(ctx, cx - 22, y, cx - 22 - len, y, pal.series[4], undefined, 2);
        drawArrow(ctx, cx + cw + 22, y, cx + cw + 22 + len, y, pal.series[4], undefined, 2);
      }
      drawArrow(ctx, cx + cw / 2, cy - 8, cx + cw / 2, cy - 8 - len, pal.series[4], undefined, 2);
    }
    // temperatures
    const tagX = cx + cw + 70;
    if (params.mat !== 'water') drawTag(ctx, Math.min(tagX, W - 70), cy + ch - 40, `${matNames[params.mat].toLowerCase()} ${T1.toFixed(1)} °C`, pal.series[3], pal.surface);
    drawTag(ctx, Math.min(tagX, W - 70), cy + ch - fillH + 14, `water ${T2.toFixed(1)} °C`, pal.series[0], pal.surface);
    ctx.fillStyle = pal.text3;
    ctx.font = '500 11px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`room ${T_ROOM} °C`, 12, usable - 14);
  }

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        cal.step(dt);
        if (cal.y[1] > maxT2) maxT2 = cal.y[1];
        if (cal.t >= tEnd()) ctrl.pause();
      },
      render: draw,
      sample: (tt, out) => {
        out[0] = cal.t;
        out[1] = cal.y[0];
        out[2] = cal.y[1];
        out[3] = cal.Qout;
        out[4] = cal.Qin;
        out[5] = cal.y[2];
      },
      reset: () => {
        cal = build();
        maxT2 = params.T2;
      },
    },
    { dt: 0.01, channels, sampleInterval: 0.1, autoplay: true },
  );
  const palette = usePalette(() => ctrl);
  resetOn(ctrl, () => [params.mat, params.m1, params.T1, params.m2, params.T2, params.cup, params.loss]);
  $effect(() => {
    void [params.mat, params.m1, params.T1, params.m2, params.T2, params.cup, params.loss];
    if (ctx) ctrl.play();
  });

  const rows = $derived.by(() => {
    void ctrl.renderCount;
    const r: { label: string; value: string; unit?: string; color?: string; strong?: boolean }[] = [
      { label: 'object T₁', value: cal.y[0].toFixed(2), unit: '°C', color: '--series-4' },
      { label: 'water T₂', value: cal.y[1].toFixed(2), unit: '°C', color: '--series-1' },
      { label: 'final T predicted (no losses)', value: cal.equilibrium().toFixed(2), unit: '°C', strong: true },
      { label: 'given out by object', value: fmt(cal.Qout, 3), unit: 'J' },
      { label: 'taken in by water' + (params.cup ? ' + cup' : ''), value: fmt(cal.Qin, 3), unit: 'J' },
    ];
    if (params.loss) r.push({ label: 'lost to the room', value: fmt(cal.y[2], 3), unit: 'J', color: '--series-5' });
    if (params.mat !== 'water') {
      const c = cFromMixture(params.m1, params.T1, params.m2, MATERIALS.water, params.T2, maxT2);
      const settled = Math.abs(cal.y[0] - cal.y[1]) < 0.1;
      r.push(
        settled
          ? { label: 'c from highest T₂ (ignoring cup and losses)', value: fmt(c, 3), unit: 'J kg⁻¹ K⁻¹', strong: true }
          : { label: 'c from the experiment', value: 'wait until T₁ ≈ T₂' },
      );
      r.push({ label: `true c of ${params.mat}`, value: `${MATERIALS[params.mat]}`, unit: 'J kg⁻¹ K⁻¹' });
    }
    return r;
  });

  onMount(() => {
    ctrl.mount();
    ctrl.speed = 5;
    return () => ctrl.destroy();
  });
</script>

<SimShell
  {entry}
  {ctrl}
  {info}
  {graphs}
  initialGraphs={['T', 'Q']}
  {presets}
  onpreset={(id) => Object.assign(params, presets.find((p) => p.id === id)?.values ?? {})}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      label="Calorimeter: a hot object cooling in water"
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
      <label class="sel">
        <span>Hot object</span>
        <select bind:value={params.mat}>
          {#each Object.keys(matNames) as k (k)}
            <option value={k}>{matNames[k as Material]} (c = {MATERIALS[k as Material]} J kg⁻¹ K⁻¹)</option>
          {/each}
        </select>
      </label>
      <Slider def={sl('m1')} bind:value={params.m1} />
      <Slider def={sl('T1')} bind:value={params.T1} />
      <Slider def={sl('m2')} bind:value={params.m2} />
      <Slider def={sl('T2')} bind:value={params.T2} />
      <Toggle label="Aluminium cup (100 g)" bind:checked={params.cup} />
      <Toggle label="Heat loss to the room" hint="Beyond syllabus" bind:checked={params.loss} />
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
    gap: var(--space-1);
    font-size: var(--text-sm);
    color: var(--text-2);
  }
  select {
    min-height: 44px;
    padding: 0 var(--space-3);
    border-radius: var(--radius-s);
    border: 1px solid var(--border-strong);
    background: var(--surface);
    color: var(--text);
    font: inherit;
  }
</style>

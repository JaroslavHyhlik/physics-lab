<script lang="ts">
  import { onMount } from 'svelte';
  import SimShell from '../../sim/SimShell.svelte';
  import SimCanvas from '../../sim/SimCanvas.svelte';
  import Readouts from '../../sim/Readouts.svelte';
  import Slider from '../../ui/Slider.svelte';
  import Segmented from '../../ui/Segmented.svelte';
  import { SimController } from '../../sim/controller.svelte';
  import { useParams, usePalette, resetOn } from '../../sim/setup.svelte';
  import { View } from '../../sim/view';
  import type { SimEntry } from '../../app/registry';
  import type { NumberParamDef } from '../../sim/params.svelte';
  import type { SimInfo, GraphDef } from '../../sim/types';
  import type { ChannelDef } from '../../core/recorder';
  import { Expansion, lnChoose, heatExchange } from '../../physics/entropy';
  import { k_B } from '../../core/constants';
  import { alpha } from '../../sim/palette';
  import { drawArrow, drawTag } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [
    { key: 'N', label: 'Number of particles', symbol: 'N', unit: '', min: 4, max: 400, step: 1, log: true },
    { key: 'Th', label: 'Hot block', symbol: 'T_h', unit: 'K', min: 300, max: 800, step: 5 },
    { key: 'Tc', label: 'Cold block', symbol: 'T_c', unit: 'K', min: 200, max: 500, step: 5 },
  ];
  const { params, sl } = useParams({ mode: 'expand', N: 40, Th: 400, Tc: 300 }, sliders);
  const presets = [
    { id: 'few', label: 'Free expansion with 6 particles', values: { mode: 'expand', N: 6 } },
    { id: 'many', label: 'Free expansion with 400 particles', values: { mode: 'expand', N: 400 } },
    { id: 'heat', label: 'Heat flows from hot to cold', values: { mode: 'heat', Th: 400, Tc: 300 } },
  ];
  const channels: ChannelDef[] = [
    { key: 't', label: 't', unit: 's' },
    { key: 'f', label: 'fraction in the left half', unit: '', color: '--series-1' },
    { key: 'S', label: 'entropy S/k_B = ln Ω', unit: '', color: '--series-4' },
    { key: 'T1', label: 'hot block', unit: 'K', color: '--series-4' },
    { key: 'T2', label: 'cold block', unit: 'K', color: '--series-1' },
    { key: 'dS', label: 'total entropy change ΔS', unit: 'J K⁻¹', color: '--series-3' },
  ];
  const graphs: GraphDef[] = $derived(
    params.mode === 'expand'
      ? [
          { id: 'f', title: 'Fraction in the left half', series: ['f'] },
          { id: 'S', title: 'Entropy S/k_B of the macrostate', series: ['S'] },
        ]
      : [
          { id: 'T', title: 'Temperatures', series: ['T1', 'T2'] },
          { id: 'dS', title: 'Total entropy change', series: ['dS'] },
        ],
  );
  const info: SimInfo = {
    about: [
      'Entropy measures how many ways (microstates Ω) there are to arrange the particles so that the system looks the same from outside (the same macrostate): S = k_B ln Ω.',
      'Remove the partition and the particles spread through the whole box. There is only one way to have all N particles on the left, but very many ways to have about half on each side, so the spread-out state is overwhelmingly more likely. With a few particles you may see them all return to the left; with 400 the chance is 2⁻⁴⁰⁰ — it never happens. This is why entropy increases: the second law of thermodynamics is a law of probability.',
      'When heat Q flows from a hot body to a cold one, the hot body loses entropy Q/T_h and the cold one gains Q/T_c. Since T_c < T_h the total entropy increases. Heat never flows the other way by itself.',
    ],
    formulas: [
      { label: 'Entropy from microstates', tex: 'S = k_B \\ln\\Omega', hl: true },
      { label: 'Entropy change for heat at temperature T', tex: '\\Delta S = \\dfrac{\\Delta Q}{T}', hl: true },
      { label: 'Number of ways to have n of N on the left', tex: '\\Omega = \\binom{N}{n} = \\dfrac{N!}{n!\\,(N-n)!}', beyond: true },
      { label: 'Free expansion to twice the volume', tex: '\\Delta S = Nk_B\\ln 2 = nR\\ln 2', beyond: true },
    ],
    assumptions: [
      'Expansion: point particles moving freely in a 2D box with reflecting walls (no collisions between them). The macrostate counts only which half each particle is in; Ω is calculated exactly.',
      'Heat flow: two blocks with heat capacities 500 J K⁻¹ and 800 J K⁻¹, connected by a conductor of 10 W K⁻¹, insulated from everything else.',
      'Speeds and times in the expansion are not to scale.',
    ],
    tryThis: [
      'With 6 particles, how often do they all come back to the left half? Compare with 2⁻⁶ ≈ 1.6 %.',
      'What is the largest value of ln Ω for 40 particles, and at which n does it occur?',
      'Heat flow: when does the total entropy stop increasing?',
    ],
  };

  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;
  let ex = new Expansion(Math.round(params.N), 1);
  let t = 0;
  const removedAt = 1;

  function drawExpand(pal: typeof palette.pal, W: number, usable: number) {
    const bh = Math.min((W > 760 ? W - 330 : W - 40) / 2, usable * 0.5);
    const bw = 2 * bh;
    const bx = 20;
    const by = 20;
    ctx!.fillStyle = alpha(pal.text3.startsWith('#') ? pal.text3 : '#888888', 0.06);
    ctx!.fillRect(bx, by, bw, bh);
    ctx!.strokeStyle = pal.text2;
    ctx!.lineWidth = 3;
    ctx!.strokeRect(bx, by, bw, bh);
    if (ex.partition) {
      ctx!.beginPath();
      ctx!.moveTo(bx + bw / 2, by);
      ctx!.lineTo(bx + bw / 2, by + bh);
      ctx!.stroke();
    } else {
      ctx!.setLineDash([4, 6]);
      ctx!.lineWidth = 1;
      ctx!.beginPath();
      ctx!.moveTo(bx + bw / 2, by);
      ctx!.lineTo(bx + bw / 2, by + bh);
      ctx!.stroke();
      ctx!.setLineDash([]);
    }
    ctx!.lineWidth = 1;
    const r = Math.max(2.5, Math.min(7, 60 / Math.sqrt(ex.N)));
    for (let i = 0; i < ex.N; i++) {
      ctx!.fillStyle = ex.x[i] < 0.5 ? pal.series[0] : pal.series[1];
      ctx!.beginPath();
      ctx!.arc(bx + ex.x[i] * bw, by + bh - ex.y[i] * 2 * bh, r, 0, Math.PI * 2);
      ctx!.fill();
    }
    // Ω(n) bar chart for all macrostates, current one highlighted
    const N = ex.N;
    const n = ex.nLeft;
    const cx0 = bx;
    const cx1 = bx + bw;
    const cy1 = usable - 18;
    const cy0 = by + bh + 40;
    if (cy1 - cy0 < 40) return;
    const maxLn = lnChoose(N, Math.floor(N / 2));
    const wBar = (cx1 - cx0) / (N + 1);
    for (let k = 0; k <= N; k++) {
      // bar height ∝ Ω(k)/Ω_max (probability of the macrostate)
      const h = Math.exp(lnChoose(N, k) - maxLn) * (cy1 - cy0);
      ctx!.fillStyle = k === n ? pal.series[3] : alpha(pal.series[0].startsWith('#') ? pal.series[0] : '#3b82f6', 0.35);
      ctx!.fillRect(cx0 + k * wBar, cy1 - Math.max(h, k === n ? 2 : 0), Math.max(1, wBar - 1), Math.max(h, k === n ? 2 : 0));
    }
    ctx!.fillStyle = pal.text3;
    ctx!.font = '500 10px Inter Variable, system-ui, sans-serif';
    ctx!.textAlign = 'left';
    ctx!.textBaseline = 'bottom';
    ctx!.fillText('Ω for each macrostate (n particles on the left), relative to the largest', cx0, cy0 - 6);
    ctx!.textBaseline = 'top';
    ctx!.fillText('n = 0', cx0, cy1 + 3);
    ctx!.textAlign = 'right';
    ctx!.fillText(`n = ${N}`, cx1, cy1 + 3);
    drawTag(ctx!, cx0 + (n + 0.5) * wBar, cy0 + 10, `now: n = ${n}`, pal.series[3], pal.surface);
  }

  function drawHeat(pal: typeof palette.pal, W: number, usable: number) {
    const s = heatExchange(500, 800, params.Th, params.Tc, 10, t);
    const bw = Math.min(180, (W - 120) / 3);
    const y = usable / 2 - 60;
    const hot = pal.series[3].startsWith('#') ? pal.series[3] : '#e11d48';
    const cold = pal.series[0].startsWith('#') ? pal.series[0] : '#3b82f6';
    const lo = Math.min(params.Tc, params.Th);
    const span = Math.max(1, Math.abs(params.Th - params.Tc));
    const block = (x: number, T: number, label: string) => {
      ctx!.fillStyle = cold;
      ctx!.fillRect(x, y, bw, 120);
      ctx!.fillStyle = alpha(hot, (T - lo) / span);
      ctx!.fillRect(x, y, bw, 120);
      drawTag(ctx!, x + bw / 2, y + 60, `${T.toFixed(1)} K`, pal.ink, pal.surface);
      ctx!.fillStyle = pal.text2;
      ctx!.font = '600 11px Inter Variable, system-ui, sans-serif';
      ctx!.textAlign = 'center';
      ctx!.textBaseline = 'top';
      ctx!.fillText(label, x + bw / 2, y + 128);
    };
    const x1 = 40;
    const x2 = x1 + bw + 120;
    block(x1, s.T1, 'C = 500 J K⁻¹');
    block(x2, s.T2, 'C = 800 J K⁻¹');
    ctx!.fillStyle = pal.text2;
    ctx!.fillRect(x1 + bw, y + 50, 120, 20);
    const P = 10 * (s.T1 - s.T2);
    if (Math.abs(P) > 0.05) drawArrow(ctx!, x1 + bw + 20, y + 30, x1 + bw + 100, y + 30, hot, `${fmt(P, 2)} W`, 2);
  }

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const usable = view.height - 76;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, view.height);
    if (params.mode === 'expand') drawExpand(pal, W, usable);
    else drawHeat(pal, W, usable);
  }

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        t += dt;
        if (params.mode === 'expand') {
          if (ex.partition && t >= removedAt) ex.partition = false;
          ex.step(dt);
        }
      },
      render: draw,
      sample: (tt, out) => {
        out[0] = tt;
        if (params.mode === 'expand') {
          out[1] = ex.nLeft / ex.N;
          out[2] = lnChoose(ex.N, ex.nLeft);
          out[3] = out[4] = out[5] = NaN;
        } else {
          const s = heatExchange(500, 800, params.Th, params.Tc, 10, tt);
          out[1] = out[2] = NaN;
          out[3] = s.T1;
          out[4] = s.T2;
          out[5] = s.dS;
        }
      },
      reset: () => {
        t = 0;
        ex = new Expansion(Math.round(params.N), 1);
      },
    },
    { dt: 1 / 120, channels, sampleInterval: 1 / 15, autoplay: true },
  );
  const palette = usePalette(() => ctrl);
  resetOn(ctrl, () => [params.mode, params.N, params.Th, params.Tc]);
  $effect(() => {
    void [params.mode, params.N, params.Th, params.Tc];
    if (ctx) ctrl.play();
  });

  const rows = $derived.by(() => {
    void ctrl.renderCount;
    if (params.mode === 'expand') {
      const n = ex.nLeft;
      const lnO = lnChoose(ex.N, n);
      const O = lnO / Math.LN10 < 15 ? fmt(Math.exp(lnO), 4) : `10^${(lnO / Math.LN10).toFixed(1)}`;
      return [
        { label: 'on the left n / N', value: `${n} / ${ex.N}`, color: '--series-1' },
        { label: 'microstates Ω = C(N, n)', value: O },
        { label: 'S/k_B = ln Ω', value: lnO.toFixed(2), color: '--series-4', strong: true },
        { label: 'S = k_B ln Ω', value: fmt(k_B * lnO, 3), unit: 'J K⁻¹' },
        { label: 'chance all on the left 2⁻ᴺ', value: ex.N < 50 ? fmt(2 ** -ex.N, 3) : `10^${(-ex.N * Math.log10(2)).toFixed(0)}` },
      ];
    }
    const s = heatExchange(500, 800, params.Th, params.Tc, 10, t);
    return [
      { label: 'heat transferred Q', value: fmt(s.Q, 4), unit: 'J' },
      { label: 'hot block ΔS = −∫dQ/T', value: fmt(500 * Math.log(s.T1 / params.Th), 4), unit: 'J K⁻¹' },
      { label: 'cold block ΔS = +∫dQ/T', value: fmt(800 * Math.log(s.T2 / params.Tc), 4), unit: 'J K⁻¹' },
      { label: 'total ΔS', value: fmt(s.dS, 4), unit: 'J K⁻¹', color: '--series-3', strong: true },
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
  {presets}
  onpreset={(id) => Object.assign(params, presets.find((q) => q.id === id)?.values ?? {})}
  stopwatch={false}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      label="Entropy: particles spreading through a box, or heat flowing between two blocks"
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
        label="Experiment"
        bind:value={params.mode}
        options={[
          { value: 'expand', label: 'Free expansion' },
          { value: 'heat', label: 'Heat flow' },
        ]}
      />
      {#if params.mode === 'expand'}
        <Slider def={sl('N')} bind:value={params.N} />
        <p class="tip">The partition is removed after 1 s. Press reset to start again.</p>
      {:else}
        <Slider def={sl('Th')} bind:value={params.Th} />
        <Slider def={sl('Tc')} bind:value={params.Tc} />
      {/if}
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
</style>

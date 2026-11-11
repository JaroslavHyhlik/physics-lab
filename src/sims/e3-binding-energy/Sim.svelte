<script lang="ts">
  import { onMount } from 'svelte';
  import SimShell from '../../sim/SimShell.svelte';
  import SimCanvas from '../../sim/SimCanvas.svelte';
  import Readouts from '../../sim/Readouts.svelte';
  import Slider from '../../ui/Slider.svelte';
  import Segmented from '../../ui/Segmented.svelte';
  import Toggle from '../../ui/Toggle.svelte';
  import { SimController } from '../../sim/controller.svelte';
  import { useParams, usePalette, redrawOn } from '../../sim/setup.svelte';
  import { View } from '../../sim/view';
  import { Interaction } from '../../sim/interaction';
  import type { SimEntry } from '../../app/registry';
  import type { NumberParamDef } from '../../sim/params.svelte';
  import type { SimInfo } from '../../sim/types';
  import { NUCLIDES, atomicMass, find, liquidDrop, massDefect, qValue, symbol, valleyZ } from '../../physics/binding';
  import { u_MeV } from '../../core/constants';
  import { drawXYPlot } from '../../sim/xyPlot';
  import { alpha } from '../../sim/palette';
  import { drawArrow, drawTag } from '../../sim/draw';
  import { fmt, superscript } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [
    { key: 'Z', label: 'Proton number', symbol: 'Z', unit: '', min: 1, max: 110, step: 1 },
    { key: 'A', label: 'Nucleon number', symbol: 'A', unit: '', min: 1, max: 270, step: 1 },
  ];
  const { params, sl } = useParams({ Z: 26, A: 56, reaction: 'none', drop: false }, sliders);
  const presets = [
    { id: 'fe', label: 'Iron-56: near the top of the curve', values: { Z: 26, A: 56, reaction: 'none' } },
    { id: 'he', label: 'Helium-4: unusually tightly bound', values: { Z: 2, A: 4, reaction: 'none' } },
    { id: 'u', label: 'Uranium-235', values: { Z: 92, A: 235, reaction: 'none' } },
    { id: 'fission', label: 'Fission of U-235: energy released', values: { Z: 92, A: 235, reaction: 'fission' } },
    { id: 'fusion', label: 'Fusion D + T → He-4 + n', values: { Z: 2, A: 4, reaction: 'fusion' } },
    { id: 'drop', label: 'Compare with the liquid-drop model', values: { Z: 50, A: 120, drop: true } },
  ];
  const info: SimInfo = {
    about: [
      'The mass of a nucleus is less than the total mass of its separate protons and neutrons. This mass defect Δm corresponds to the binding energy, E = Δm c²: the energy needed to pull the nucleus completely apart (or released when it forms).',
      'Dividing by the number of nucleons gives the binding energy per nucleon, a measure of how tightly each nucleon is held. It rises steeply for light nuclei, peaks at about 8.8 MeV around iron and nickel (A ≈ 56–62), then falls slowly for heavy nuclei.',
      'Any reaction that moves nuclei up the curve releases energy. Light nuclei release energy when they fuse; heavy nuclei release energy when they split (fission). The points shown are measured masses from the AME2020 evaluation; tap a point to choose it.',
    ],
    formulas: [
      { label: 'Mass–energy', tex: 'E = mc^{2}' },
      { label: 'Mass defect', tex: '\\Delta m = Zm_p + (A - Z)m_n - m_\\text{nucleus}' },
      { label: 'Unified atomic mass unit', tex: '1\\ \\text{u} = 931.5\\ \\text{MeV}\\,c^{-2}' },
      { label: 'Liquid-drop model', tex: 'E_b = a_vA - a_sA^{2/3} - a_c\\dfrac{Z(Z-1)}{A^{1/3}} - a_a\\dfrac{(A-2Z)^{2}}{A} \\pm \\delta', beyond: true },
    ],
    assumptions: [
      'Masses from AME2020 (measured nuclides only, 2550 of them). The mass defect is calculated with atomic masses (Z hydrogen atoms + N neutrons − the atom), so the electron masses cancel; electron binding energies (keV) are neglected.',
      'The line joins the most tightly bound nuclide for each A. Liquid-drop coefficients from a common textbook fit (15.5, 16.8, 0.72, 23 and 34 MeV); it is a smooth average and misses shell effects such as the high values for ⁴He, ¹²C and ¹⁶O.',
      'Reaction energies are calculated from the same masses. In fission the products shown (Ba-141, Kr-92) are one typical pair; the energy given is released promptly, before the products decay.',
    ],
    tryThis: [
      'Find the most tightly bound nuclide. Is it iron-56?',
      'Why does fusing four hydrogen nuclei into helium release so much energy? Compare their binding energies per nucleon.',
      'Estimate the fission energy from the curve: about 235 × (8.5 − 7.6) MeV. Compare with the exact value.',
    ],
  };

  const sel = $derived(find(params.Z, params.A - params.Z));
  const Q_FISSION = qValue([[92, 143], [0, 1]], [[56, 85], [36, 56], [0, 1], [0, 1], [0, 1]]);
  const Q_FUSION = qValue([[1, 1], [1, 2]], [[2, 2], [0, 1]]);
  // most tightly bound nuclide for each A
  const best = new Map<number, number>();
  for (const n of NUCLIDES) best.set(n.A, Math.max(best.get(n.A) ?? 0, n.bea));
  const bestA = [...best.keys()].sort((a, b) => a - b);

  const view = new View();
  const inter = new Interaction();
  let ctx: CanvasRenderingContext2D | null = null;
  let map = { X: (a: number) => a, Y: (b: number) => b, x0: 0, x1: 1, y0: 0, y1: 1 };
  inter.add({
    priority: 10,
    cursor: 'pointer',
    hit: (px, py) => (px >= map.x0 && px <= map.x1 && py >= map.y0 && py <= map.y1 ? 0 : Infinity),
    start: (px, py) => {
      let bd = Infinity;
      let pick = null as (typeof NUCLIDES)[number] | null;
      for (const n of NUCLIDES) {
        const d = Math.hypot(map.X(n.A) - px, map.Y(n.bea) - py);
        if (d < bd) {
          bd = d;
          pick = n;
        }
      }
      if (pick && bd < 30) {
        params.Z = pick.Z;
        params.A = pick.A;
      }
    },
    move: () => {},
  });

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const H = view.height;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    const wide = W > 760;
    const x0 = 60;
    const x1 = wide ? W - 30 : W - 16;
    const y0 = wide ? 200 : 40;
    const y1 = H - 46;
    const ld = (A: number) => liquidDrop(valleyZ(A), A) / A;
    const { X, Y } = drawXYPlot(ctx, pal, {
      x0,
      y0,
      x1,
      y1,
      xmin: 0,
      xmax: 270,
      ymin: 0,
      ymax: 9.5,
      xLabel: 'nucleon number A',
      yLabel: 'binding energy per nucleon / MeV',
      curves: params.drop ? [{ fn: (A) => (A >= 4 ? ld(Math.round(A)) : NaN), color: pal.series[2], dash: [6, 4], width: 1.5, samples: 270 }] : [],
    });
    map = { X, Y, x0, x1, y0, y1 };
    // regions
    ctx.fillStyle = alpha(pal.series[0].startsWith('#') ? pal.series[0] : '#3b82f6', 0.06);
    ctx.fillRect(X(0), y0, X(56) - X(0), y1 - y0);
    ctx.fillStyle = alpha(pal.series[3].startsWith('#') ? pal.series[3] : '#e11d48', 0.06);
    ctx.fillRect(X(56), y0, X(270) - X(56), y1 - y0);
    ctx.fillStyle = pal.text3;
    ctx.font = '600 11px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('fusion releases energy →', X(28), Y(2.2));
    ctx.fillText('← fission releases energy', X(160), Y(2.2));
    // all measured nuclides
    ctx.fillStyle = alpha(pal.text3.startsWith('#') ? pal.text3 : '#888888', 0.55);
    for (const n of NUCLIDES) if (n.bea > 0) ctx.fillRect(X(n.A) - 1, Y(n.bea) - 1, 2, 2);
    // line through the most tightly bound nuclide of each A
    ctx.strokeStyle = pal.series[0];
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    bestA.forEach((A, i) => (i ? ctx!.lineTo(X(A), Y(best.get(A)!)) : ctx!.moveTo(X(A), Y(best.get(A)!))));
    ctx.stroke();
    ctx.lineWidth = 1;
    for (const [z, a] of [
      [2, 4],
      [6, 12],
      [8, 16],
      [26, 56],
      [92, 238],
    ]) {
      const n = find(z, a - z);
      if (n) drawTag(ctx, X(a), Y(n.bea) - 14, `${superscript(a)}${symbol(z)}`, pal.text2, pal.surface, '600 10px Inter Variable, system-ui, sans-serif');
    }
    // reactions
    if (params.reaction === 'fission') {
      const u = find(92, 143)!;
      const ba = find(56, 85)!;
      const kr = find(36, 56)!;
      drawArrow(ctx, X(235), Y(u.bea), X(141), Y(ba.bea), pal.series[3], undefined, 2);
      drawArrow(ctx, X(235), Y(u.bea), X(92), Y(kr.bea), pal.series[3], undefined, 2);
      drawTag(ctx, X(190), Y(u.bea) + 26, `²³⁵U + n → ¹⁴¹Ba + ⁹²Kr + 3n: Q = ${Q_FISSION.toFixed(0)} MeV`, pal.series[3], pal.surface);
    } else if (params.reaction === 'fusion') {
      const d = find(1, 1)!;
      const t = find(1, 2)!;
      const he = find(2, 2)!;
      drawArrow(ctx, X(2), Y(d.bea), X(4), Y(he.bea), pal.series[0], undefined, 2);
      drawArrow(ctx, X(3), Y(t.bea), X(4), Y(he.bea), pal.series[0], undefined, 2);
      drawTag(ctx, X(60), Y(he.bea) - 30, `²H + ³H → ⁴He + n: Q = ${Q_FUSION.toFixed(1)} MeV`, pal.series[0], pal.surface);
    }
    // selected
    if (sel) {
      ctx.strokeStyle = pal.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(X(sel.A), Y(sel.bea), 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
    }
  }

  const ctrl = new SimController({ step: () => {}, render: draw, reset: () => {} }, { dt: 1, autoplay: false });
  const palette = usePalette(() => ctrl);
  redrawOn(ctrl, () => [params.Z, params.A, params.reaction, params.drop]);
  inter.onChange = () => ctrl.invalidate();

  const rows = $derived.by(() => {
    const name = `${superscript(params.A)}${symbol(params.Z)} (Z = ${params.Z}, N = ${params.A - params.Z})`;
    if (!sel) return [{ label: 'nuclide', value: name }, { label: 'mass', value: 'not measured (not in AME2020)' }];
    const dm = massDefect(sel);
    const r: { label: string; value: string; unit?: string; color?: string; strong?: boolean }[] = [
      { label: 'nuclide', value: name },
      { label: 'atomic mass', value: atomicMass(sel).toFixed(6), unit: 'u' },
      { label: 'mass defect Δm', value: dm.toFixed(6), unit: 'u' },
      { label: 'binding energy Δm × 931.5 MeV u⁻¹', value: fmt(dm * u_MeV, 5), unit: 'MeV' },
      { label: 'binding energy per nucleon', value: sel.bea.toFixed(3), unit: 'MeV', strong: true },
    ];
    if (params.drop) r.push({ label: 'liquid-drop model', value: (liquidDrop(sel.Z, sel.A) / sel.A).toFixed(3), unit: 'MeV', color: '--series-3' });
    if (params.reaction === 'fission') r.push({ label: 'fission Q (from masses)', value: Q_FISSION.toFixed(1), unit: 'MeV', color: '--series-4' });
    if (params.reaction === 'fusion') r.push({ label: 'fusion Q (from masses)', value: Q_FUSION.toFixed(2), unit: 'MeV', color: '--series-1' });
    return r;
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
  transport={false}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      interaction={inter}
      label="Binding energy per nucleon against nucleon number for all measured nuclides; tap a point to select it"
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
      <Slider def={sl('Z')} bind:value={params.Z} />
      <Slider def={sl('A')} bind:value={params.A} />
      <Segmented
        label="Show a reaction"
        bind:value={params.reaction}
        options={[
          { value: 'none', label: 'None' },
          { value: 'fission', label: 'Fission' },
          { value: 'fusion', label: 'Fusion' },
        ]}
      />
      <Toggle label="Liquid-drop model" hint="beyond the syllabus" bind:checked={params.drop} />
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

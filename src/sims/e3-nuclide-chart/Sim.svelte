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
  import { ALL, MODE_NAME, chain, daughter, formatHalfLife, get, isStable, type NuclideInfo } from '../../physics/nuclides';
  import { symbol } from '../../physics/binding';
  import { superscript } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [
    { key: 'Z', label: 'Proton number', symbol: 'Z', unit: '', min: 0, max: 118, step: 1 },
    { key: 'N', label: 'Neutron number', symbol: 'N', unit: '', min: 0, max: 177, step: 1 },
  ];
  const { params, sl } = useParams({ Z: 92, N: 146, view: 'zoom', series: true }, sliders);
  const presets = [
    { id: 'u238', label: 'Uranium-238 decay series', values: { Z: 92, N: 146, view: 'full', series: true } },
    { id: 'c14', label: 'Carbon-14: β⁻ decay', values: { Z: 6, N: 8, view: 'zoom', series: true } },
    { id: 'f18', label: 'Fluorine-18 (PET scans): β⁺ decay', values: { Z: 9, N: 9, view: 'zoom', series: true } },
    { id: 'am', label: 'Americium-241 (smoke detectors): α decay', values: { Z: 95, N: 146, view: 'zoom', series: true } },
    { id: 'co', label: 'Cobalt-60: β⁻ then γ', values: { Z: 27, N: 33, view: 'zoom', series: true } },
    { id: 'th', label: 'Thorium-232 decay series', values: { Z: 90, N: 142, view: 'full', series: true } },
  ];
  const info: SimInfo = {
    about: [
      'Every known nuclide has a place on this chart: its number of neutrons N across and its number of protons Z up. Isotopes of one element lie on a horizontal row. Stable nuclides (black) form a narrow valley. Light ones have N ≈ Z; heavier ones need extra neutrons to dilute the electric repulsion of the protons.',
      'Nuclides off the valley are unstable and decay towards it. Too many neutrons (below the valley): β⁻ decay turns a neutron into a proton (one step up and left). Too many protons (above it): β⁺ decay or electron capture turns a proton into a neutron (one step down and right). Heavy nuclides often emit an α particle (two steps down and two left).',
      'Gamma emission does not change Z or N: the nucleus only drops from an excited state to a lower one, usually just after an α or β decay. In every decay the nucleon number and the charge are conserved.',
    ],
    formulas: [
      { label: 'α decay', tex: '{}^{A}_{Z}X \\rightarrow {}^{A-4}_{Z-2}Y + {}^{4}_{2}\\alpha' },
      { label: 'β⁻ decay', tex: '{}^{A}_{Z}X \\rightarrow {}^{A}_{Z+1}Y + {}^{0}_{-1}e + \\bar{\\nu}_e' },
      { label: 'β⁺ decay', tex: '{}^{A}_{Z}X \\rightarrow {}^{A}_{Z-1}Y + {}^{0}_{+1}e + \\nu_e' },
      { label: 'γ emission', tex: '{}^{A}_{Z}X^{*} \\rightarrow {}^{A}_{Z}X + \\gamma' },
    ],
    assumptions: [
      'Ground states from NUBASE2020 (3558 nuclides, including those whose half-lives come from systematics). Isomers and excited states are not shown.',
      'Each nuclide is coloured by its main decay mode (the first one listed); many have several. Decay series follow the main mode at each step.',
      'Nuclides that decay by spontaneous fission end a series here, because the fragments vary.',
    ],
    tryThis: [
      'Follow the uranium-238 series to the end. Count the α and β⁻ decays and check that A and Z add up.',
      'Pick an isotope of iodine with too many neutrons. Which way does it decay? And one with too few?',
      'Why does the valley of stability bend away from the N = Z line for heavy nuclides?',
    ],
  };

  const sel = $derived(get(params.Z, params.N));
  const ser = $derived(sel ? chain(sel) : []);

  const view = new View();
  const inter = new Interaction();
  let ctx: CanvasRenderingContext2D | null = null;
  let geo = { x0: 0, y1: 0, cell: 1, n0: 0, z0: 0, nCount: 1, zCount: 1 };
  inter.add({
    priority: 10,
    cursor: 'pointer',
    hit: (px, py) => {
      const n = geo.n0 + Math.floor((px - geo.x0) / geo.cell);
      const z = geo.z0 + Math.floor((geo.y1 - py) / geo.cell);
      return n >= geo.n0 && n < geo.n0 + geo.nCount && z >= geo.z0 && z < geo.z0 + geo.zCount ? 0 : Infinity;
    },
    start: (px, py) => {
      const n = geo.n0 + Math.floor((px - geo.x0) / geo.cell);
      const z = geo.z0 + Math.floor((geo.y1 - py) / geo.cell);
      if (get(z, n)) {
        params.Z = z;
        params.N = n;
      }
    },
    move: () => {},
  });

  function colour(n: NuclideInfo, pal: typeof palette.pal): string {
    if (isStable(n)) return pal.ink;
    switch (n.mode) {
      case 'B-':
      case '2B-':
        return pal.series[0];
      case 'B+':
      case 'EC':
        return pal.series[3];
      case 'A':
        return pal.hl;
      case 'SF':
        return pal.series[2];
      default:
        return pal.text3;
    }
  }

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const H = view.height;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    const wide = W > 760;
    const zoom = params.view === 'zoom';
    const x0 = 44;
    const x1 = wide && params.view === 'zoom' ? W - 290 : W - 12;
    const y0 = 20;
    const y1 = H - 60;
    const half = 7;
    const n0 = zoom ? Math.max(0, params.N - half) : 0;
    const z0 = zoom ? Math.max(0, params.Z - half) : 0;
    const nCount = zoom ? 2 * half + 1 : 178;
    const zCount = zoom ? 2 * half + 1 : 119;
    const cell = Math.max(1, Math.min((x1 - x0) / nCount, (y1 - y0) / zCount));
    geo = { x0, y1, cell, n0, z0, nCount, zCount };
    const X = (n: number) => x0 + (n - n0) * cell;
    const Y = (z: number) => y1 - (z - z0 + 1) * cell;
    // N = Z line
    ctx.strokeStyle = pal.gridStrong;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    const lo = Math.max(n0, z0);
    const hi = Math.min(n0 + nCount, z0 + zCount);
    if (hi > lo) {
      ctx.moveTo(X(lo), Y(lo) + cell);
      ctx.lineTo(X(hi), Y(hi) + cell);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    for (const n of ALL) {
      if (n.N < n0 || n.N >= n0 + nCount || n.Z < z0 || n.Z >= z0 + zCount) continue;
      ctx.fillStyle = colour(n, pal);
      const g = cell > 6 ? 1 : 0;
      ctx.fillRect(X(n.N) + g / 2, Y(n.Z) + g / 2, cell - g, cell - g);
      if (zoom && cell > 34) {
        ctx.fillStyle = isStable(n) || n.mode === 'B-' || n.mode === 'B+' || n.mode === 'EC' ? pal.surface : pal.ink;
        ctx.font = `700 ${Math.round(cell * 0.22)}px Inter Variable, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${superscript(n.A)}${symbol(n.Z)}`, X(n.N) + cell / 2, Y(n.Z) + cell * 0.38);
        ctx.font = `500 ${Math.round(cell * 0.16)}px Inter Variable, system-ui, sans-serif`;
        ctx.fillText(formatHalfLife(n.logT).replace('billion years', 'Gy').replace('million years', 'My').replace('years', 'y').replace('minutes', 'min').replace('hours', 'h').replace('days', 'd'), X(n.N) + cell / 2, Y(n.Z) + cell * 0.7);
      }
    }
    // decay series
    if (params.series && ser.length > 1) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x0, y1 - zCount * cell, nCount * cell, zCount * cell);
      ctx.clip();
      ctx.strokeStyle = pal.ink;
      ctx.lineWidth = Math.max(1.5, cell * 0.08);
      ctx.beginPath();
      ser.forEach((n, i) => {
        const cx = X(n.N) + cell / 2;
        const cy = Y(n.Z) + cell / 2;
        if (i === 0) ctx!.moveTo(cx, cy);
        else ctx!.lineTo(cx, cy);
      });
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.restore();
    }
    if (sel) {
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = 3;
      ctx.strokeRect(X(sel.N) - 2, Y(sel.Z) - 2, cell + 4, cell + 4);
      ctx.lineWidth = 1;
    }
    // axes labels
    ctx.fillStyle = pal.text2;
    ctx.font = '500 11px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText('neutron number N →', x0 + nCount * cell, y1 + 6);
    ctx.save();
    ctx.translate(14, y1);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'left';
    ctx.fillText('proton number Z →', 0, 0);
    ctx.restore();
    {
      const st = zoom ? 2 : 20;
      ctx.fillStyle = pal.text3;
      ctx.textAlign = 'center';
      for (let n = Math.ceil(n0 / st) * st; n < n0 + nCount; n += st) ctx.fillText(String(n), X(n) + cell / 2, y1 + 22);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let z = Math.ceil(z0 / st) * st; z < z0 + zCount; z += st) ctx.fillText(String(z), x0 - 4, Y(z) + cell / 2);
    }
    // legend
    const items: [string, string][] = [
      [pal.ink, 'stable'],
      [pal.series[0], 'β⁻'],
      [pal.series[3], 'β⁺ / EC'],
      [pal.hl, 'α'],
      [pal.series[2], 'fission'],
      [pal.text3, 'p, n emission'],
    ];
    let lx = x0;
    ctx.font = '600 11px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (const [col, txt] of items) {
      ctx.fillStyle = col;
      ctx.fillRect(lx, H - 22, 10, 10);
      ctx.fillStyle = pal.text2;
      ctx.fillText(txt, lx + 14, H - 17);
      lx += ctx.measureText(txt).width + 30;
    }
  }

  const ctrl = new SimController({ step: () => {}, render: draw, reset: () => {} }, { dt: 1, autoplay: false });
  const palette = usePalette(() => ctrl);
  redrawOn(ctrl, () => [params.Z, params.N, params.view, params.series]);
  inter.onChange = () => ctrl.invalidate();

  const SUB = '₀₁₂₃₄₅₆₇₈₉';
  const sub = (k: number) => String(k).split('').map((d) => (d === '-' ? '₋' : SUB[+d])).join('');
  const nuc = (z: number, a: number) => `${superscript(a)}${sub(z)}${symbol(z)}`;

  const rows = $derived.by(() => {
    if (!sel) return [{ label: 'nuclide', value: `Z = ${params.Z}, N = ${params.N}: not known` }];
    const d = daughter(sel);
    const emit: Record<string, string> = { A: ' + ⁴₂α', 'B-': ' + ⁰₋₁e + ν̄', 'B+': ' + ⁰₊₁e + ν', EC: ' (electron captured) + ν', n: ' + n', p: ' + p' };
    const r: { label: string; value: string; unit?: string; color?: string; strong?: boolean }[] = [
      { label: 'nuclide', value: `${nuc(sel.Z, sel.A)} (Z = ${sel.Z}, N = ${sel.N})`, strong: true },
      { label: 'half-life', value: formatHalfLife(sel.logT) },
      { label: 'main decay mode', value: MODE_NAME[sel.mode] ?? sel.mode },
    ];
    if (d) r.push({ label: 'decay', value: `${nuc(sel.Z, sel.A)} → ${nuc(d.Z, d.A)}${emit[sel.mode] ?? ''}` });
    if (ser.length > 2) {
      const end = ser[ser.length - 1];
      const m = ser.slice(0, -1).map((n) => n.mode);
      r.push(
        { label: 'series ends at', value: `${nuc(end.Z, end.A)}${isStable(end) ? ' (stable)' : ''}` },
        { label: 'steps in the series', value: `${m.filter((x) => x === 'A').length} α, ${m.filter((x) => x === 'B-').length} β⁻, ${m.filter((x) => x === 'B+' || x === 'EC').length} β⁺/EC` },
      );
    }
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
      label="Chart of nuclides coloured by decay mode; tap a nuclide to select it"
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
        label="View"
        bind:value={params.view}
        options={[
          { value: 'zoom', label: 'Close-up' },
          { value: 'full', label: 'Whole chart' },
        ]}
      />
      <Slider def={sl('Z')} bind:value={params.Z} />
      <Slider def={sl('N')} bind:value={params.N} />
      <Toggle label="Show the decay series" bind:checked={params.series} />
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

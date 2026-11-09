<script lang="ts">
  import { untrack } from 'svelte';
  import { Crosshair, Gauge, Plus, Minus, Trash2, Download } from '@lucide/svelte';
  import SimShell from '../../sim/SimShell.svelte';
  import SimCanvas from '../../sim/SimCanvas.svelte';
  import Readouts from '../../sim/Readouts.svelte';
  import Slider from '../../ui/Slider.svelte';
  import Toggle from '../../ui/Toggle.svelte';
  import IconButton from '../../ui/IconButton.svelte';
  import { SimController } from '../../sim/controller.svelte';
  import { createParams, syncParamsToUrl } from '../../sim/params.svelte';
  import { View } from '../../sim/view';
  import { Interaction } from '../../sim/interaction';
  import { readPalette, type Palette } from '../../sim/palette';
  import { theme } from '../../app/theme.svelte';
  import { router } from '../../app/router.svelte';
  import type { SimEntry } from '../../app/registry';
  import { fieldAt, potentialAt, type Sources } from '../../physics/charges';
  import { computeFieldMaps, type FieldMapRequest, type FieldMapResult } from '../../physics/fieldMaps';
  import { LatestWorker } from '../../workers/latest';
  import { Recorder } from '../../core/recorder';
  import { downloadCsv } from '../../sim/export';
  import { fmt } from '../../core/format';
  import { Ruler } from '../../tools/ruler';
  import { drawCharges, chargeRadiusPx } from './render';
  import * as M from './meta';

  let { entry }: { entry: SimEntry } = $props();

  const nC = 1e-9;
  const query = router.route.name === 'sim' ? router.route.query : new URLSearchParams();
  const params = createParams(M.defaults, query, M.sliders);
  const sl = (k: string) => M.sliders.find((s) => s.key === k)!;

  // world box always kept in view (metres)
  const WORLD = { x0: -2.4, x1: 2.4, y0: -1.5, y1: 1.5 };

  let charges = $state<M.UiCharge[]>(M.parseCharges(params.c));
  let selected = $state(untrack(() => (charges.length ? 0 : -1)));
  const probeE = $state({ on: params.probeE, x: 0, y: 0.6 });
  const probeV = $state({ on: params.probeV, x: 0, y: -0.6 });

  const sources = $derived<Sources>({
    charges: charges.map((c) => ({ x: c.x, y: c.y, q: c.q * nC })),
    plates: params.plates
      ? [
          { cx: 0, cy: params.d / 2, w: params.w, vertical: false, sigma: params.sigma * nC },
          { cx: 0, cy: -params.d / 2, w: params.w, vertical: false, sigma: -params.sigma * nC },
        ]
      : [],
  });

  const view = new View();
  const inter = new Interaction();
  const ruler = new Ruler(-1, -1.2, 1, -1.2);
  let ctx: CanvasRenderingContext2D | null = null;
  let pal: Palette = readPalette();
  let maps: FieldMapResult | null = null;
  let heatCanvas: HTMLCanvasElement | null = null;
  let viewVersion = $state(0);

  function fitView() {
    view.fit(WORLD.x0, WORLD.x1, WORLD.y0, WORLD.y1, 12, 12);
    viewVersion++;
  }

  function draw() {
    if (!ctx) return;
    drawCharges(ctx, view, pal, {
      sources,
      qnC: charges.map((c) => c.q),
      selected,
      maps,
      heatCanvas,
      show: { lines: params.lines, equip: params.equip, heat: params.heat, vectors: params.vectors, grid: params.grid },
      probeE,
      probeV,
    });
    ruler.draw(ctx, view, pal);
  }

  // Static simulation: the controller only handles redraws.
  const ctrl = new SimController({ step: () => {}, render: draw, reset: () => {} }, { dt: 1, autoplay: false });

  // --- expensive maps in a Web Worker ------------------------------------------------
  function rgb(hex: string): [number, number, number] {
    const n = parseInt(hex.replace('#', ''), 16);
    return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [128, 128, 128];
  }
  const worker = new LatestWorker<FieldMapRequest, FieldMapResult>(
    () => new Worker(new URL('../../workers/field.worker.ts', import.meta.url), { type: 'module' }),
    (res) => {
      maps = res;
      if (res.image) {
        heatCanvas ??= document.createElement('canvas');
        heatCanvas.width = res.nx;
        heatCanvas.height = res.ny;
        heatCanvas.getContext('2d')!.putImageData(new ImageData(res.image as ImageDataArray, res.nx, res.ny), 0, 0);
      }
      ctrl.invalidate();
    },
    computeFieldMaps,
  );

  $effect(() => {
    void viewVersion;
    const src = $state.snapshot(sources) as Sources;
    const show = { heat: params.heat, equip: params.equip, lines: params.lines, spacing: params.spacing };
    void theme.version;
    untrack(() => {
      if (view.width < 2) return;
      const b = { x0: view.left, x1: view.right, y0: view.bottom, y1: view.top };
      worker.request({
        sources: src,
        bounds: b,
        nx: Math.min(320, Math.max(40, Math.round(view.width / 4))),
        ny: Math.min(220, Math.max(30, Math.round(view.height / 4))),
        heatmap: show.heat,
        equipotentials: show.equip,
        lines: show.lines,
        spacing: show.spacing,
        stopRadius: 14 / view.scale,
        colors: { pos: rgb(pal.positive), neg: rgb(pal.negative), bg: rgb(pal.bg) },
      });
      ctrl.invalidate();
    });
  });

  // --- state sync ----------------------------------------------------------------------
  $effect(() => {
    params.c = M.formatCharges(charges);
  });
  $effect(() => {
    params.probeE = probeE.on;
    params.probeV = probeV.on;
  });
  $effect(() => syncParamsToUrl($state.snapshot(params), M.defaults));
  $effect(() => {
    void params.grid;
    void params.vectors;
    void selected;
    void probeE.x;
    void probeE.y;
    void probeV.x;
    void probeV.y;
    ctrl.invalidate();
  });
  $effect(() => {
    void theme.version;
    pal = readPalette();
    ctrl.invalidate();
  });

  // --- interaction ---------------------------------------------------------------------
  const clampX = (x: number) => Math.max(WORLD.x0 + 0.05, Math.min(WORLD.x1 - 0.05, x));
  const clampY = (y: number) => Math.max(WORLD.y0 + 0.05, Math.min(WORLD.y1 - 0.05, y));
  let dragIndex = -1;
  inter.add({
    priority: 10,
    cursor: 'grab',
    hit: (px, py) => {
      let best = Infinity;
      dragIndex = -1;
      charges.forEach((c, i) => {
        const d = Math.hypot(view.sx(c.x) - px, view.sy(c.y) - py) - chargeRadiusPx(c.q) + 6;
        if (d < best) {
          best = d;
          dragIndex = i;
        }
      });
      return Math.max(0, best);
    },
    start: () => {
      selected = dragIndex;
    },
    move: (px, py) => {
      if (selected < 0) return;
      charges[selected].x = Math.round(clampX(view.wx(px)) * 100) / 100;
      charges[selected].y = Math.round(clampY(view.wy(py)) * 100) / 100;
    },
  });
  for (const pr of [probeE, probeV]) {
    inter.add({
      priority: 50,
      cursor: 'move',
      hit: (px, py) => (pr.on ? Math.hypot(view.sx(pr.x) - px, view.sy(pr.y) - py) : Infinity),
      move: (px, py) => {
        pr.x = clampX(view.wx(px));
        pr.y = clampY(view.wy(py));
      },
    });
  }
  ruler.attach(view, inter);
  inter.onChange = () => ctrl.invalidate();

  // --- actions ---------------------------------------------------------------------------
  const spots = [
    [0, 0.9],
    [-1.4, 0.8],
    [1.4, -0.8],
    [-1.4, -0.8],
    [1.4, 0.8],
    [0, -0.9],
    [-1.9, 0],
    [1.9, 0],
  ];
  function addCharge(q: number) {
    if (charges.length >= 30) return;
    const free = spots.find(([x, y]) => charges.every((c) => Math.hypot(c.x - x, c.y - y) > 0.3)) ?? [
      ((charges.length * 0.37) % 3) - 1.5,
      ((charges.length * 0.53) % 2) - 1,
    ];
    charges.push({ x: free[0], y: free[1], q });
    selected = charges.length - 1;
  }
  function removeSelected() {
    if (selected < 0) return;
    charges.splice(selected, 1);
    selected = charges.length ? Math.min(selected, charges.length - 1) : -1;
  }
  function applyPreset(id: string) {
    const p = M.presets.find((x) => x.id === id);
    if (!p) return;
    Object.assign(params, p.values);
    charges = M.parseCharges(params.c);
    selected = charges.length ? 0 : -1;
  }

  // --- probe readings -------------------------------------------------------------------
  const readings = new Recorder(M.channels, 5000);
  let readingCount = $state(0);
  function record() {
    const x = probeE.on ? probeE.x : probeV.x;
    const y = probeE.on ? probeE.y : probeV.y;
    const e = [0, 0];
    fieldAt(sources, x, y, e);
    readings.push([readings.length + 1, x, y, Math.hypot(e[0], e[1]), e[0], e[1], potentialAt(sources, x, y)]);
    readingCount = readings.length;
  }

  const rows = $derived.by(() => {
    const out = [];
    if (probeE.on) {
      const e = [0, 0];
      fieldAt(sources, probeE.x, probeE.y, e);
      const mag = Math.hypot(e[0], e[1]);
      out.push(
        { label: '|E|', value: fmt(mag, 3), unit: 'N C⁻¹', strong: true },
        { label: 'direction', value: ((Math.atan2(e[1], e[0]) * 180) / Math.PI).toFixed(1), unit: '°' },
        { label: 'Eₓ', value: fmt(e[0], 3), unit: 'N C⁻¹' },
        { label: 'E_y', value: fmt(e[1], 3), unit: 'N C⁻¹' },
      );
    }
    if (probeV.on) {
      out.push({ label: 'V', value: fmt(potentialAt(sources, probeV.x, probeV.y), 3), unit: 'V', hl: true, strong: true });
      if (probeE.on) {
        const dV = potentialAt(sources, probeV.x, probeV.y) - potentialAt(sources, probeE.x, probeE.y);
        out.push({ label: 'ΔV (V-probe − E-probe)', value: fmt(dV, 3), unit: 'V', hl: true });
      }
    }
    return out;
  });

  $effect(() => {
    ctrl.mount();
    return () => {
      ctrl.destroy();
      worker.terminate();
    };
  });
</script>

<SimShell
  {entry}
  {ctrl}
  info={M.info}
  graphs={[]}
  presets={M.presets}
  onpreset={applyPreset}
  {ruler}
  stopwatch={false}
  transport={false}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      interaction={inter}
      label="Electric charges and fields"
      onready={(c) => {
        ctx = c;
        fitView();
        ctrl.invalidate();
      }}
      onresize={() => {
        fitView();
        ctrl.invalidate();
      }}
    />
  {/snippet}
  {#snippet toolbar()}
    <IconButton icon={Crosshair} label="Electric field probe" active={probeE.on} size={38} onclick={() => (probeE.on = !probeE.on)} />
    <IconButton icon={Gauge} label="Voltage probe (HL)" active={probeV.on} size={38} onclick={() => (probeV.on = !probeV.on)} />
  {/snippet}
  {#snippet readouts()}
    {#if rows.length}<Readouts {rows} />{/if}
  {/snippet}
  {#snippet controls()}
    <div class="controls">
      <section>
        <h3>Charges</h3>
        <div class="btns">
          <button type="button" class="add pos" onclick={() => addCharge(1)}><Plus size={15} /> Add +1 nC</button>
          <button type="button" class="add neg" onclick={() => addCharge(-1)}><Minus size={15} /> Add −1 nC</button>
        </div>
        {#if selected >= 0 && charges[selected]}
          <Slider def={sl('q')} bind:value={charges[selected].q} />
          <div class="btns">
            <button type="button" class="plain" onclick={removeSelected}><Trash2 size={15} /> Remove selected</button>
            <button
              type="button"
              class="plain"
              onclick={() => {
                charges = [];
                selected = -1;
              }}>Clear all</button
            >
          </div>
        {:else}
          <p class="hint">Drag a charge to move it; tap it to select and change its size.</p>
        {/if}
      </section>
      <section>
        <Toggle label="Parallel plates (capacitor)" bind:checked={params.plates} />
        {#if params.plates}
          <Slider def={sl('sigma')} bind:value={params.sigma} />
          <Slider def={sl('d')} bind:value={params.d} />
          <Slider def={sl('w')} bind:value={params.w} />
        {/if}
      </section>
      <section>
        <h3>Show</h3>
        <Toggle label="Field lines" bind:checked={params.lines} />
        <Toggle label="Equipotentials" hl hint="Dashed line: V = 0" bind:checked={params.equip} />
        {#if params.equip}<Slider def={sl('spacing')} bind:value={params.spacing} />{/if}
        <Toggle label="Potential colour map" hl hint="Red = positive, blue = negative (non-linear scale)" bind:checked={params.heat} />
        <Toggle label="Field vectors" hint="Brightness ∝ log |E|" bind:checked={params.vectors} />
        <Toggle label="Grid" bind:checked={params.grid} />
      </section>
      <section>
        <h3>Measurements</h3>
        <Toggle label="Electric field probe" bind:checked={probeE.on} />
        <Toggle label="Voltage probe" hl bind:checked={probeV.on} />
        <div class="btns">
          <button type="button" class="plain" disabled={!probeE.on && !probeV.on} onclick={record}
            >Record reading</button
          >
          <span class="count num">{readingCount} recorded</span>
        </div>
        {#if readingCount > 0}
          <div class="btns">
            <button type="button" class="plain" onclick={() => downloadCsv(readings, entry.id, 'en')}
              ><Download size={15} /> CSV</button
            >
            <button type="button" class="plain" onclick={() => downloadCsv(readings, entry.id, 'cz')}
              ><Download size={15} /> CSV (CZ Excel)</button
            >
            <button
              type="button"
              class="plain"
              onclick={() => {
                readings.clear();
                readingCount = 0;
              }}>Clear</button
            >
          </div>
        {/if}
      </section>
    </div>
  {/snippet}
</SimShell>

<style>
  .controls {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }
  section {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  section + section {
    padding-top: var(--space-4);
    border-top: 1px solid var(--border);
  }
  h3 {
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-3);
  }
  .btns {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
  }
  button.add,
  button.plain {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border-radius: var(--radius-s);
    padding: 8px 12px;
    font-size: var(--text-sm);
    font-weight: 600;
    min-height: 40px;
    border: 1px solid var(--border-strong);
    background: var(--surface);
  }
  button.add.pos {
    color: var(--positive);
  }
  button.add.neg {
    color: var(--negative);
  }
  button:disabled {
    opacity: 0.45;
  }
  .hint {
    font-size: var(--text-xs);
    color: var(--text-3);
  }
  .count {
    font-size: var(--text-xs);
    color: var(--text-3);
  }
</style>

<script lang="ts">
  import { onMount } from 'svelte';
  import SimShell from '../../sim/SimShell.svelte';
  import SimCanvas from '../../sim/SimCanvas.svelte';
  import Readouts from '../../sim/Readouts.svelte';
  import Slider from '../../ui/Slider.svelte';
  import Toggle from '../../ui/Toggle.svelte';
  import Segmented from '../../ui/Segmented.svelte';
  import { SimController } from '../../sim/controller.svelte';
  import { useParams, usePalette } from '../../sim/setup.svelte';
  import { View } from '../../sim/view';
  import { Interaction } from '../../sim/interaction';
  import type { SimEntry } from '../../app/registry';
  import type { NumberParamDef } from '../../sim/params.svelte';
  import type { SimInfo } from '../../sim/types';
  import { solveCircuit, type El, type ElKind } from '../../physics/circuit';
  import { lampT } from '../../physics/components';
  import { alpha } from '../../sim/palette';
  import { drawTag } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const envSliders: NumberParamDef[] = [
    { key: 'lux', label: 'Light on the LDR', symbol: 'E', unit: 'lx', min: 1, max: 10000, step: 1, log: true },
    { key: 'temp', label: 'Temperature of the thermistor', symbol: 'θ', unit: '°C', min: -20, max: 100, step: 1 },
  ];
  const { params, sl } = useParams({ lux: 100, temp: 25, real: false, flow: 'conv' }, envSliders);

  const COLS = 9;
  const ROWS = 6;
  const P = (i: number, j: number) => j * COLS + i;

  // ---- layouts: "kind i1 j1 i2 j2 key=value…" ----
  const LAYOUTS: Record<string, string[]> = {
    series: ['cell 1 3 1 2 emf=6 r=0.5', 'wire 1 2 1 1', 'ammeter 1 1 2 1', 'resistor 2 1 3 1 R=10', 'wire 3 1 4 1', 'lamp 4 1 5 1', 'wire 5 1 6 1', 'wire 6 1 6 2', 'wire 6 2 6 3', 'switch 6 3 5 3 closed=1', 'wire 5 3 4 3', 'wire 4 3 3 3', 'wire 3 3 2 3', 'wire 2 3 1 3', 'voltmeter 4 2 5 2', 'wire 4 1 4 2', 'wire 5 2 5 1'],
    parallel: ['cell 1 4 1 3 emf=6 r=0.2', 'wire 1 3 1 2', 'wire 1 2 1 1', 'ammeter 1 1 2 1', 'wire 2 1 3 1', 'wire 3 1 3 2', 'resistor 3 2 4 2 R=10', 'wire 4 2 5 2', 'lamp 3 1 4 1', 'wire 4 1 5 1', 'wire 5 1 5 2', 'wire 3 2 3 3', 'resistor 3 3 4 3 R=20', 'wire 4 3 5 3', 'wire 5 2 5 3', 'wire 5 3 5 4', 'ammeter 5 4 4 4', 'wire 4 4 3 4', 'wire 3 4 2 4', 'wire 2 4 1 4'],
    divider: ['cell 1 4 1 3 emf=9 r=0', 'wire 1 3 1 2', 'wire 1 2 1 1', 'wire 1 1 2 1', 'wire 2 1 3 1', 'resistor 3 1 3 2 R=1000', 'ldr 3 2 3 3', 'wire 3 3 3 4', 'wire 3 4 2 4', 'wire 2 4 1 4', 'wire 3 2 4 2', 'voltmeter 4 2 4 3', 'wire 4 3 4 4', 'wire 4 4 3 4'],
    bridge: ['wire 2 2 1 2', 'cell 1 3 1 2 emf=6 r=0.5', 'wire 1 3 1 4', 'wire 1 4 2 4', 'wire 2 4 3 4', 'wire 3 4 4 4', 'wire 4 4 5 4', 'wire 5 4 5 3', 'wire 5 3 5 2', 'wire 5 2 4 2', 'wire 2 2 2 1', 'resistor 2 1 3 1 R=100', 'resistor 3 1 4 1 R=200', 'wire 4 1 4 2', 'wire 2 2 2 3', 'resistor 2 3 3 3 R=50', 'resistor 3 3 4 3 R=120', 'wire 4 3 4 2', 'ammeter 3 1 3 2', 'wire 3 2 3 3'],
    thermistor: ['cell 1 4 1 3 emf=5 r=0', 'wire 1 3 1 2', 'wire 1 2 1 1', 'wire 1 1 2 1', 'resistor 2 1 3 1 R=10000', 'wire 3 1 4 1', 'thermistor 4 1 4 2', 'wire 4 2 4 3', 'wire 4 3 4 4', 'wire 4 4 3 4', 'wire 3 4 2 4', 'wire 2 4 1 4', 'wire 4 1 5 1', 'voltmeter 5 1 5 2', 'wire 5 2 4 2'],
  };
  const presets = [
    { id: 'series', label: 'Series: cell, ammeter, resistor, lamp, switch', values: { layout: 'series' } },
    { id: 'parallel', label: 'Parallel branches with ammeters', values: { layout: 'parallel' } },
    { id: 'divider', label: 'Potential divider with an LDR', values: { layout: 'divider' } },
    { id: 'bridge', label: 'Wheatstone bridge (unbalanced)', values: { layout: 'bridge' } },
    { id: 'thermistor', label: 'Thermistor sensor circuit', values: { layout: 'thermistor' } },
  ];
  let nextId = 1;
  function parseLayout(lines: string[]): El[] {
    return lines.map((l) => {
      const [kind, i1, j1, i2, j2, ...kv] = l.split(' ');
      const e: El = { id: nextId++, kind: kind as ElKind, a: P(+i1, +j1), b: P(+i2, +j2) };
      for (const p of kv) {
        const [k, v] = p.split('=');
        if (k === 'closed') e.closed = v === '1';
        else (e as unknown as Record<string, number>)[k] = +v;
      }
      return defaults(e);
    });
  }
  function defaults(e: El): El {
    if (e.kind === 'resistor') e.R ??= 10;
    if (e.kind === 'cell') {
      e.emf ??= 1.5;
      e.r ??= 0.5;
    }
    if (e.kind === 'switch') e.closed ??= true;
    return e;
  }

  let elements: El[] = $state(parseLayout(LAYOUTS.series));
  let selected: number | null = $state(null);
  let tool: ElKind | 'select' | 'erase' = $state('select');
  const TOOLS: { k: ElKind | 'select' | 'erase'; label: string }[] = [
    { k: 'select', label: 'Select' },
    { k: 'wire', label: 'Wire' },
    { k: 'cell', label: 'Cell' },
    { k: 'resistor', label: 'Resistor' },
    { k: 'lamp', label: 'Lamp' },
    { k: 'switch', label: 'Switch' },
    { k: 'ammeter', label: 'Ammeter' },
    { k: 'voltmeter', label: 'Voltmeter' },
    { k: 'ldr', label: 'LDR' },
    { k: 'thermistor', label: 'Thermistor' },
    { k: 'erase', label: 'Erase' },
  ];
  const NAMES: Record<ElKind, string> = { wire: 'Wire', cell: 'Cell', resistor: 'Resistor', lamp: 'Filament lamp (12 V, 24 W)', switch: 'Switch', ammeter: 'Ammeter', voltmeter: 'Voltmeter', ldr: 'LDR', thermistor: 'Thermistor (NTC)' };

  const sol = $derived(solveCircuit(COLS * ROWS, $state.snapshot(elements) as El[], { lux: params.lux, tempC: params.temp, realMeters: params.real }));
  const sel = $derived(elements.find((e) => e.id === selected) ?? null);

  const info: SimInfo = {
    about: [
      'Build DC circuits on the grid: choose a tool, then tap the gap between two dots to place it. Tap with “Select” to change a component’s value, flip a cell or open a switch.',
      'Current is the rate of flow of charge, I = Δq/Δt. In a series circuit the same current passes through everything; in parallel branches the currents add up to the total (Kirchhoff’s first law: charge is conserved at a junction).',
      'Around any closed loop the sum of the emfs equals the sum of the potential differences (Kirchhoff’s second law: energy is conserved). A potential divider shares the supply voltage in the ratio of the resistances; an LDR or thermistor in a divider makes a light or temperature sensor.',
      'Ideal meters do not disturb the circuit: the ammeter has no resistance, the voltmeter takes no current. Switch to real meters to see the small effect they have.',
    ],
    formulas: [
      { label: 'Current', tex: 'I = \\dfrac{\\Delta q}{\\Delta t}' },
      { label: 'Potential difference', tex: 'V = \\dfrac{W}{q}' },
      { label: 'Resistance', tex: 'R = \\dfrac{V}{I}' },
      { label: 'Power', tex: 'P = VI = I^{2}R = \\dfrac{V^{2}}{R}' },
      { label: 'Series and parallel', tex: 'R_s = R_1 + R_2 + \\dots, \\qquad \\dfrac{1}{R_p} = \\dfrac{1}{R_1} + \\dfrac{1}{R_2} + \\dots' },
      { label: 'Cell', tex: '\\varepsilon = I(R + r)' },
    ],
    assumptions: [
      'Wires and closed switches have no resistance. Ideal meters: ammeter 0 Ω, voltmeter infinite resistance; real meters: ammeter 0.1 Ω, voltmeter 10 MΩ.',
      'Lamp: tungsten filament (12 V, 24 W), resistance found from its temperature, which settles where electrical power = radiated power.',
      'LDR: R = 10 kΩ at 10 lx, R ∝ E^−0.7. Thermistor (NTC): 10 kΩ at 25 °C, B = 3950 K. Typical datasheet values.',
      'Steady currents only (the circuit settles instantly). The moving dots show the direction and relative size of the current; their speed is not to scale (real drift speeds are below 1 mm s⁻¹).',
    ],
    tryThis: [
      'Series preset: open the switch. Why do all the readings drop to zero?',
      'Add a second lamp in parallel with the first. What happens to the current from the cell?',
      'Potential divider: cover the LDR (lower the light). What happens to the voltmeter reading?',
      'Bridge: change one resistor until the middle ammeter reads zero. What is the ratio of the resistances then?',
    ],
  };

  // ---- geometry ----
  const view = new View();
  const inter = new Interaction();
  let ctx: CanvasRenderingContext2D | null = null;
  const geo = { ox: 0, oy: 0, s: 60 };
  const pt = (p: number) => ({ x: geo.ox + (p % COLS) * geo.s, y: geo.oy + Math.floor(p / COLS) * geo.s });
  function nearestEdge(px: number, py: number): [number, number] | null {
    const gx = (px - geo.ox) / geo.s;
    const gy = (py - geo.oy) / geo.s;
    let best: [number, number] | null = null;
    let bd = 0.35;
    for (let j = 0; j < ROWS; j++)
      for (let i = 0; i < COLS; i++) {
        if (i + 1 < COLS) {
          const d = Math.hypot(gx - (i + 0.5), gy - j);
          if (d < bd) {
            bd = d;
            best = [P(i, j), P(i + 1, j)];
          }
        }
        if (j + 1 < ROWS) {
          const d = Math.hypot(gx - i, gy - (j + 0.5));
          if (d < bd) {
            bd = d;
            best = [P(i, j), P(i, j + 1)];
          }
        }
      }
    return best;
  }
  const onEdge = (e: El, a: number, b: number) => (e.a === a && e.b === b) || (e.a === b && e.b === a);
  inter.add({
    priority: 1,
    cursor: 'pointer',
    hit: (px, py) => (nearestEdge(px, py) ? 0 : Infinity),
    start: (px, py) => {
      const ed = nearestEdge(px, py);
      if (!ed) return;
      const [a, b] = ed;
      const existing = elements.find((e) => onEdge(e, a, b));
      if (tool === 'select') {
        selected = existing ? existing.id : null;
        if (existing?.kind === 'switch') existing.closed = !existing.closed;
      } else if (tool === 'erase') {
        if (existing) elements = elements.filter((e) => e !== existing);
        selected = null;
      } else {
        const e = defaults({ id: nextId++, kind: tool, a, b });
        elements = [...elements.filter((x) => x !== existing), e];
        selected = e.id;
      }
      ctrl.invalidate();
    },
    move: () => {},
  });

  // ---- animation of the current ----
  const phase = new Map<number, number>();

  function symbol(e: El, x1: number, y1: number, x2: number, y2: number, pal: typeof palette.pal, isSel: boolean) {
    const c = ctx!;
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const s = geo.s;
    const ink = isSel ? pal.accent : pal.text2;
    c.strokeStyle = ink;
    c.lineWidth = 2;
    const gap = e.kind === 'wire' ? 0 : s * 0.28;
    // leads
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(mx - Math.cos(ang) * gap, my - Math.sin(ang) * gap);
    c.moveTo(mx + Math.cos(ang) * gap, my + Math.sin(ang) * gap);
    c.lineTo(x2, y2);
    c.stroke();
    if (e.kind === 'wire') return;
    c.save();
    c.translate(mx, my);
    c.rotate(ang);
    c.fillStyle = pal.bg;
    const w = gap;
    if (e.kind === 'resistor' || e.kind === 'ldr' || e.kind === 'thermistor') {
      c.fillRect(-w, -7, 2 * w, 14);
      c.strokeRect(-w, -7, 2 * w, 14);
      if (e.kind === 'thermistor') {
        c.beginPath();
        c.moveTo(-w - 4, 12);
        c.lineTo(-w + 4, 12);
        c.lineTo(w + 2, -12);
        c.stroke();
      }
      if (e.kind === 'ldr') {
        c.beginPath();
        c.arc(0, 0, w + 5, 0, Math.PI * 2);
        c.stroke();
        for (const dx of [-6, 4]) {
          c.beginPath();
          c.moveTo(dx - 8, -w - 16);
          c.lineTo(dx, -w - 7);
          c.stroke();
        }
      }
    } else if (e.kind === 'cell') {
      // + (long thin) at b side, − (short thick) at a side
      c.beginPath();
      c.moveTo(-w, 0);
      c.lineTo(-4, 0);
      c.moveTo(4, 0);
      c.lineTo(w, 0);
      c.stroke();
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(4, -13);
      c.lineTo(4, 13);
      c.stroke();
      c.lineWidth = 5;
      c.beginPath();
      c.moveTo(-4, -7);
      c.lineTo(-4, 7);
      c.stroke();
      c.lineWidth = 2;
      c.rotate(-ang);
      c.fillStyle = ink;
      c.font = '700 10px Inter Variable, system-ui, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('+', Math.cos(ang) * 10 - Math.sin(ang) * 18, Math.sin(ang) * 10 + Math.cos(ang) * 18);
    } else if (e.kind === 'lamp') {
      const T = lampT(sol.els.get(e.id)?.V ?? 0);
      const glow = Math.max(0, Math.min(1, (T - 900) / 1800));
      if (glow > 0) {
        const warm = pal.hl.startsWith('#') ? pal.hl : '#f59e0b';
        const g = c.createRadialGradient(0, 0, 3, 0, 0, 34);
        g.addColorStop(0, alpha(warm, glow));
        g.addColorStop(1, alpha(warm, 0));
        c.fillStyle = g;
        c.fillRect(-34, -34, 68, 68);
        c.fillStyle = pal.bg;
      }
      c.beginPath();
      c.arc(0, 0, w, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      const k = w * 0.7;
      c.beginPath();
      c.moveTo(-k, -k);
      c.lineTo(k, k);
      c.moveTo(k, -k);
      c.lineTo(-k, k);
      c.stroke();
    } else if (e.kind === 'switch') {
      c.beginPath();
      c.arc(-w, 0, 3, 0, Math.PI * 2);
      c.arc(w, 0, 3, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.moveTo(-w, 0);
      if (e.closed) c.lineTo(w, 0);
      else c.lineTo(w * 0.8, -w * 0.8);
      c.stroke();
    } else if (e.kind === 'ammeter' || e.kind === 'voltmeter') {
      c.beginPath();
      c.arc(0, 0, w * 0.9, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.rotate(-ang);
      c.fillStyle = ink;
      c.font = '700 13px Inter Variable, system-ui, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(e.kind === 'ammeter' ? 'A' : 'V', 0, 0);
    }
    c.restore();
    c.lineWidth = 1;
  }

  function label(e: El): string | null {
    const r = sol.els.get(e.id);
    if (!r) return null;
    switch (e.kind) {
      case 'ammeter':
        return `${fmt(Math.abs(r.I), 3)} A`;
      case 'voltmeter':
        return `${fmt(Math.abs(r.V), 3)} V`;
      case 'resistor':
        return `${fmt(e.R ?? 0, 3)} Ω`;
      case 'cell':
        return `${fmt(e.emf ?? 0, 3)} V`;
      case 'ldr':
      case 'thermistor':
        return `${fmt(r.R ?? 0, 3)} Ω`;
      default:
        return null;
    }
  }

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const usable = view.height - 20;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, view.height);
    const wArea = W > 760 ? W - 250 : W;
    geo.s = Math.min((wArea - 60) / (COLS - 1), (usable - 60) / (ROWS - 1));
    geo.ox = (wArea - geo.s * (COLS - 1)) / 2;
    geo.oy = 30 + (usable - 60 - geo.s * (ROWS - 1)) / 2;
    // dots
    ctx.fillStyle = pal.gridStrong;
    for (let p = 0; p < COLS * ROWS; p++) {
      const q = pt(p);
      ctx.beginPath();
      ctx.arc(q.x, q.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // components
    for (const e of elements) {
      const A = pt(e.a);
      const B = pt(e.b);
      symbol(e, A.x, A.y, B.x, B.y, pal, e.id === selected);
    }
    // moving charges
    ctx.fillStyle = params.flow === 'conv' ? pal.series[3] : pal.series[0];
    for (const e of elements) {
      const I = sol.els.get(e.id)?.I ?? 0;
      if (Math.abs(I) < 1e-6 || e.kind === 'voltmeter') continue;
      const A = pt(e.a);
      const B = pt(e.b);
      const ph = phase.get(e.id) ?? 0;
      for (let k = 0; k < 3; k++) {
        let f = (ph + k / 3) % 1;
        if (f < 0) f += 1;
        ctx.beginPath();
        ctx.arc(A.x + (B.x - A.x) * f, A.y + (B.y - A.y) * f, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // labels
    for (const e of elements) {
      const l = label(e);
      if (!l) continue;
      const A = pt(e.a);
      const B = pt(e.b);
      const horiz = A.y === B.y;
      drawTag(ctx, (A.x + B.x) / 2 + (horiz ? 0 : 34), (A.y + B.y) / 2 + (horiz ? -24 : 0), l, e.kind === 'ammeter' || e.kind === 'voltmeter' ? pal.ink : pal.text2, pal.surface);
    }
    if (!sol.ok) drawTag(ctx, wArea / 2, 14, sol.message ?? 'Cannot solve', pal.negative, pal.surface);
  }

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        const dir = params.flow === 'conv' ? 1 : -1;
        for (const e of elements) {
          const I = sol.els.get(e.id)?.I ?? 0;
          // speed in edges per second: grows with current but stays readable (not to scale)
          const v = Math.sign(I) * Math.min(2.5, 0.6 * Math.log10(1 + Math.abs(I) * 1000));
          phase.set(e.id, ((phase.get(e.id) ?? 0) + dir * v * dt) % 1);
        }
      },
      render: draw,
      reset: () => phase.clear(),
    },
    { dt: 1 / 60, autoplay: true },
  );
  const palette = usePalette(() => ctrl);
  inter.onChange = () => ctrl.invalidate();

  const rows = $derived.by(() => {
    if (!sel) return [{ label: 'tip', value: 'tap a component with Select' }];
    const r = sol.els.get(sel.id);
    if (!r) return [];
    const out: { label: string; value: string; unit?: string; strong?: boolean }[] = [
      { label: NAMES[sel.kind], value: '' },
      { label: 'current I', value: fmt(Math.abs(r.I), 4), unit: 'A', strong: true },
      { label: 'p.d. V', value: fmt(Math.abs(r.V), 4), unit: 'V', strong: true },
    ];
    if (r.R !== undefined) out.push({ label: 'resistance R', value: fmt(r.R, 4), unit: 'Ω' });
    if (sel.kind !== 'wire' && sel.kind !== 'ammeter' && sel.kind !== 'voltmeter') out.push({ label: sel.kind === 'cell' ? 'power supplied εI' : 'power P = VI', value: fmt(Math.abs(sel.kind === 'cell' ? (sel.emf ?? 0) * r.I : r.P), 4), unit: 'W' });
    return out;
  });

  const rDef: NumberParamDef = { key: 'R', label: 'Resistance', symbol: 'R', unit: 'Ω', min: 0.1, max: 100000, step: 0.1, log: true };
  const emfDef: NumberParamDef = { key: 'emf', label: 'emf', symbol: 'ε', unit: 'V', min: 0, max: 24, step: 0.1 };
  const rIntDef: NumberParamDef = { key: 'r', label: 'Internal resistance', symbol: 'r', unit: 'Ω', min: 0, max: 10, step: 0.05 };
  function loadLayout(id: string) {
    elements = parseLayout(LAYOUTS[id] ?? LAYOUTS.series);
    selected = null;
    ctrl.invalidate();
  }
  const hasLdr = $derived(elements.some((e) => e.kind === 'ldr'));
  const hasTh = $derived(elements.some((e) => e.kind === 'thermistor'));

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
  onpreset={(id) => loadLayout(id)}
  stopwatch={false}
  transport={false}
  shortcuts={false}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      interaction={inter}
      label="Circuit construction grid"
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
      <div class="tools" role="group" aria-label="Tools">
        {#each TOOLS as t (t.k)}
          <button type="button" class:on={tool === t.k} aria-pressed={tool === t.k} onclick={() => (tool = t.k)}>{t.label}</button>
        {/each}
      </div>
      {#if sel}
        <div class="sel">
          <strong>{NAMES[sel.kind]}</strong>
          {#if sel.kind === 'resistor'}<Slider def={rDef} bind:value={() => sel.R ?? 10, (v) => (sel.R = v)} />{/if}
          {#if sel.kind === 'cell'}
            <Slider def={emfDef} bind:value={() => sel.emf ?? 1.5, (v) => (sel.emf = v)} />
            <Slider def={rIntDef} bind:value={() => sel.r ?? 0, (v) => (sel.r = v)} />
            <button
              type="button"
              class="small"
              onclick={() => {
                const a = sel.a;
                sel.a = sel.b;
                sel.b = a;
              }}>Flip cell</button
            >
          {/if}
          {#if sel.kind === 'switch'}<Toggle label="Switch closed" bind:checked={() => sel.closed ?? true, (v) => (sel.closed = v)} />{/if}
          <button
            type="button"
            class="small ghost"
            onclick={() => {
              elements = elements.filter((e) => e.id !== sel.id);
              selected = null;
            }}>Delete</button
          >
        </div>
      {/if}
      {#if hasLdr}<Slider def={sl('lux')} bind:value={params.lux} />{/if}
      {#if hasTh}<Slider def={sl('temp')} bind:value={params.temp} />{/if}
      <Toggle label="Real meters" hint="ammeter 0.1 Ω, voltmeter 10 MΩ" bind:checked={params.real} />
      <Segmented
        label="Show the flow of"
        bind:value={params.flow}
        options={[
          { value: 'conv', label: 'Conventional current' },
          { value: 'elec', label: 'Electrons' },
        ]}
      />
      <button type="button" class="small ghost" onclick={() => { elements = []; selected = null; }}>Clear all</button>
    </div>
  {/snippet}
</SimShell>

<style>
  .controls {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .tools {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-1);
  }
  .tools button,
  .small {
    min-height: 44px;
    border-radius: var(--radius-s);
    border: 1px solid var(--border-strong);
    background: var(--surface);
    color: var(--text);
    font: inherit;
    font-size: var(--text-sm);
    cursor: pointer;
  }
  .tools button.on {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--on-accent);
    font-weight: 600;
  }
  .small {
    padding: 0 var(--space-4);
  }
  .ghost {
    background: transparent;
    color: var(--accent);
    border-color: var(--accent);
  }
  .sel {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-m);
  }
</style>

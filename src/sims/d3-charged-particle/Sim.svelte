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
  import type { SimInfo } from '../../sim/types';
  import { ChargedParticle, larmorRadius, cyclotronPeriod, type FieldFn } from '../../physics/emParticle';
  import { m_p, e, u } from '../../core/constants';
  import { alpha } from '../../sim/palette';
  import { drawTag } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [
    { key: 'v', label: 'Speed', symbol: 'v', unit: 'm s⁻¹', min: 1e4, max: 1e7, step: 1e3, log: true },
    { key: 'B', label: 'Magnetic flux density (into the screen)', symbol: 'B', unit: 'T', min: 1e-3, max: 1, step: 1e-4, log: true },
    { key: 'E', label: 'Electric field strength (downwards)', symbol: 'E', unit: 'V m⁻¹', min: 0, max: 1e5, step: 100 },
  ];
  const { params, sl } = useParams({ mode: 'B', part: 'p', v: 1e6, B: 0.1, E: 2e4 }, sliders);
  const presets = [
    { id: 'circle', label: 'Proton circling in a magnetic field', values: { mode: 'B', part: 'p', v: 1e6, B: 0.1 } },
    { id: 'parab', label: 'Electron between charged plates', values: { mode: 'E', part: 'e', v: 1e7, E: 2e3 } },
    { id: 'sel', label: 'Velocity selector', values: { mode: 'EB', part: 'p', E: 2e4, B: 0.02 } },
    { id: 'spec', label: 'Mass spectrometer (neon isotopes)', values: { mode: 'spec', B: 0.2, v: 1e5 } },
    { id: 'cyc', label: 'Cyclotron', values: { mode: 'cyc', part: 'p', B: 0.5 } },
  ];
  const PARTS: Record<string, { name: string; q: number; m: number }> = {
    p: { name: 'proton', q: e, m: m_p },
    e: { name: 'electron', q: -e, m: 9.11e-31 },
    a: { name: 'alpha particle', q: 2 * e, m: 4.0015 * u },
  };
  const info: SimInfo = {
    about: [
      'A charge moving through a magnetic field feels a force F = qvB sin θ at right angles to its velocity. The force changes the direction but not the speed, so in a uniform field the particle moves in a circle of radius r = mv/(qB). The time for one circle, T = 2πm/(qB), does not depend on the speed.',
      'In a uniform electric field the force qE is constant (like gravity), so a particle entering at right angles follows a parabola.',
      'Velocity selector: with E and B crossed, the electric and magnetic forces cancel only for v = E/B; faster or slower particles are deflected. Mass spectrometer: ions of the same speed and charge move on circles whose radius is proportional to their mass. Cyclotron: a field alternating at f = qB/2πm kicks the particle each time it crosses the gap, so it spirals outwards.',
    ],
    formulas: [
      { label: 'Magnetic force on a moving charge', tex: 'F = qvB\\sin\\theta' },
      { label: 'Electric force', tex: 'F = qE' },
      { label: 'Radius of the circle', tex: 'r = \\dfrac{mv}{qB}', beyond: true },
      { label: 'Velocity selector', tex: 'v = \\dfrac{E}{B}', beyond: true },
      { label: 'Period (cyclotron)', tex: 'T = \\dfrac{2\\pi m}{qB}', beyond: true },
    ],
    assumptions: [
      'Uniform fields with sharp edges; vacuum; non-relativistic speeds (below about 0.1c); gravity negligible.',
      'B points into the screen (×); a positive charge moving right is pushed up. Integrated with the Boris method (speed exactly constant in a pure magnetic field).',
      'Time is slowed down enormously; the view is rescaled to fit the motion.',
    ],
    tryThis: [
      'Double the speed of the proton. What happens to the radius and to the period?',
      'Compare a proton and an electron at the same speed: which way does each turn, and how different are the radii?',
      'Velocity selector: which particles get through the slit? Check v = E/B.',
      'Mass spectrometer: how far apart do neon-20 and neon-22 land?',
    ],
  };

  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;
  type Run = { p: ChargedParticle; trail: number[]; col: number; label: string; done: boolean };
  let runs: Run[] = [];
  let size = 0.4; // world size shown [m]
  let tScale = 1e-7; // simulated seconds per animation second
  let detector: { x: number; label: string }[] = [];

  function build() {
    const cols = [0, 3, 2, 1, 4]; // palette series used for the particles
    runs = [];
    detector = [];
    const part = PARTS[params.part] ?? PARTS.p;
    const Bz = -params.B; // into the screen
    const mk = (q: number, m: number, f: FieldFn, x: number, y: number, vx: number, vy: number, col: number, label: string) => {
      const p = new ChargedParticle(q, m, f);
      p.x[0] = x;
      p.x[1] = y;
      p.v[0] = vx;
      p.v[1] = vy;
      runs.push({ p, trail: [], col, label, done: false });
    };
    if (params.mode === 'B') {
      const r = larmorRadius(part.m, params.v, part.q, params.B);
      size = 3 * r;
      tScale = cyclotronPeriod(part.m, part.q, params.B) / 3;
      mk(part.q, part.m, (_x, _y, _t, _E, B) => (B[2] = Bz), 0, 0, params.v, 0, cols[0], part.name);
    } else if (params.mode === 'E') {
      size = 0.4;
      tScale = 0.35 / params.v / 3;
      const field: FieldFn = (x, y, _t, E) => {
        if (x > 0.05 && x < 0.25 && Math.abs(y) < 0.08) E[1] = -params.E;
      };
      mk(part.q, part.m, field, -0.15, 0, params.v, 0, cols[0], part.name);
    } else if (params.mode === 'EB') {
      size = 0.4;
      const v0 = params.E / params.B;
      tScale = 0.35 / v0 / 3;
      const field: FieldFn = (x, y, _t, E, B) => {
        if (x > -0.1 && x < 0.15 && Math.abs(y) < 0.08) {
          E[1] = -params.E;
          B[2] = Bz;
        }
      };
      [0.7, 0.85, 1, 1.15, 1.3].forEach((k, i) => mk(e, m_p, field, -0.18, 0, k * v0, 0, cols[i], `${k.toFixed(2)} E/B`));
    } else if (params.mode === 'spec') {
      const isotopes = [
        { A: 20, m: 19.992 * u, label: 'neon-20' },
        { A: 22, m: 21.991 * u, label: 'neon-22' },
      ];
      const rmax = larmorRadius(isotopes[1].m, params.v, e, params.B);
      size = 2.6 * rmax;
      tScale = cyclotronPeriod(isotopes[1].m, e, params.B) / 2 / 3;
      const field: FieldFn = (_x, y, _t, _E, B) => {
        if (y < 0) B[2] = -params.B; // field region below the entrance slit
      };
      isotopes.forEach((iso, i) => {
        mk(e, iso.m, field, -0.4 * size, 0.0001, 0, -params.v, cols[i], iso.label);
        detector.push({ x: -0.4 * size + 2 * larmorRadius(iso.m, params.v, e, params.B), label: iso.label });
      });
    } else {
      // cyclotron: D-shaped electrodes of radius R, gap 2g with an alternating field
      const R = 0.25;
      size = 0.6;
      const g = 0.01;
      const T = cyclotronPeriod(part.m, part.q, params.B);
      const Egap = 1e4 / (2 * g); // 10 kV across the gap
      tScale = T * 1.2;
      const field: FieldFn = (x, y, t, E, B) => {
        const r = Math.hypot(x, y);
        if (r < R) B[2] = Bz;
        if (Math.abs(x) < g && r < R) E[0] = Egap * Math.sign(part.q) * Math.cos((2 * Math.PI * t) / T);
      };
      mk(part.q, part.m, field, 0, 0, 0, 0, cols[0], part.name);
    }
  }

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const usable = view.height - 76;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, view.height);
    const wArea = W > 760 ? W - 270 : W;
    const sc = Math.min(wArea - 40, usable - 20) / size;
    const cx = wArea / 2;
    const cy = usable / 2;
    const X = (x: number) => cx + x * sc;
    const Y = (y: number) => cy - y * sc;
    // field regions
    const fieldTint = alpha(pal.series[4].startsWith('#') ? pal.series[4] : '#7c4dff', 0.08);
    const crosses = (x0: number, y0: number, x1: number, y1: number) => {
      ctx!.fillStyle = fieldTint;
      ctx!.fillRect(X(x0), Y(y1), (x1 - x0) * sc, (y1 - y0) * sc);
      ctx!.strokeStyle = alpha(pal.text3.startsWith('#') ? pal.text3 : '#888888', 0.6);
      const st = 28;
      for (let px = X(x0) + st / 2; px < X(x1); px += st)
        for (let py = Y(y1) + st / 2; py < Y(y0); py += st) {
          ctx!.beginPath();
          ctx!.moveTo(px - 3, py - 3);
          ctx!.lineTo(px + 3, py + 3);
          ctx!.moveTo(px + 3, py - 3);
          ctx!.lineTo(px - 3, py + 3);
          ctx!.stroke();
        }
    };
    const plates = (x0: number, x1: number, h: number) => {
      ctx!.fillStyle = pal.series[3];
      ctx!.fillRect(X(x0), Y(h) - 6, (x1 - x0) * sc, 5);
      ctx!.fillStyle = pal.series[0];
      ctx!.fillRect(X(x0), Y(-h) + 1, (x1 - x0) * sc, 5);
      drawTag(ctx!, X(x0) - 12, Y(h), '+', pal.series[3], pal.surface);
      drawTag(ctx!, X(x0) - 12, Y(-h), '−', pal.series[0], pal.surface);
    };
    if (params.mode === 'B') crosses(-size / 2, -size / 2, size / 2, size / 2);
    else if (params.mode === 'E') plates(0.05, 0.25, 0.08);
    else if (params.mode === 'EB') {
      crosses(-0.1, -0.08, 0.15, 0.08);
      plates(-0.1, 0.15, 0.08);
      ctx.fillStyle = pal.text2;
      ctx.fillRect(X(0.17), Y(0.1), 5, (0.1 - 0.006) * sc);
      ctx.fillRect(X(0.17), Y(-0.006), 5, (0.1 - 0.006) * sc);
      drawTag(ctx, X(0.17), Y(0.12), 'slit', pal.text2, pal.surface);
    } else if (params.mode === 'spec') {
      crosses(-size / 2, -size / 2, size / 2, 0);
      ctx.fillStyle = pal.text2;
      ctx.fillRect(X(-size / 2), Y(0) - 2, size * sc, 4);
      detector.forEach((d, i) => drawTag(ctx!, X(d.x), Y(0) - 16 - i * 18, `${d.label}: 2r = ${fmt((d.x + 0.4 * size) * 100, 3)} cm`, pal.ink, pal.surface));
    } else {
      ctx.fillStyle = fieldTint;
      ctx.beginPath();
      ctx.arc(X(0), Y(0), 0.25 * sc, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = pal.text2;
      ctx.lineWidth = 2;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(X(0), Y(0), 0.25 * sc, s > 0 ? -Math.PI / 2 : Math.PI / 2, s > 0 ? Math.PI / 2 : (3 * Math.PI) / 2);
        ctx.moveTo(X(s * 0.01), Y(0.25));
        ctx.lineTo(X(s * 0.01), Y(-0.25));
        ctx.stroke();
      }
      ctx.lineWidth = 1;
    }
    // trails and particles
    for (const r of runs) {
      ctx.strokeStyle = pal.series[r.col];
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < r.trail.length; i += 2) {
        if (i === 0) ctx.moveTo(X(r.trail[i]), Y(r.trail[i + 1]));
        else ctx.lineTo(X(r.trail[i]), Y(r.trail[i + 1]));
      }
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.fillStyle = pal.series[r.col];
      ctx.beginPath();
      ctx.arc(X(r.p.x[0]), Y(r.p.x[1]), 5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (params.mode === 'EB') runs.forEach((r, i) => drawTag(ctx!, X(-0.18), Y(-0.12) + i * 16, `v = ${r.label}`, pal.series[r.col], pal.surface));
    // scale bar
    const bar = Math.pow(10, Math.floor(Math.log10(size / 3)));
    ctx.strokeStyle = pal.text2;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(16, usable - 10);
    ctx.lineTo(16 + bar * sc, usable - 10);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = pal.text2;
    ctx.font = '500 10px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${fmt(bar, 2)} m`, 16, usable - 14);
  }

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        const H = dt * tScale;
        for (const r of runs) {
          if (r.done) continue;
          const n = 40;
          for (let i = 0; i < n; i++) {
            r.p.step(H / n);
            if (params.mode === 'spec' && r.p.x[1] > 0.0001 && r.p.t > 1e-12) {
              r.done = true;
              break;
            }
            if (params.mode === 'EB' && r.p.x[0] > 0.165 && Math.abs(r.p.x[1]) > 0.006) {
              r.done = true;
              break;
            }
            if (params.mode === 'cyc' && Math.hypot(r.p.x[0], r.p.x[1]) > 0.25) {
              r.done = true;
              break;
            }
          }
          if (r.trail.length < 60000) r.trail.push(r.p.x[0], r.p.x[1]);
          if (Math.abs(r.p.x[0]) > size || Math.abs(r.p.x[1]) > size) r.done = true;
        }
      },
      render: draw,
      reset: () => build(),
    },
    { dt: 1 / 120, autoplay: true },
  );
  const palette = usePalette(() => ctrl);
  build();
  resetOn(ctrl, () => [params.mode, params.part, params.v, params.B, params.E]);
  $effect(() => {
    void [params.mode, params.part, params.v, params.B, params.E];
    if (ctx) ctrl.play();
  });

  const rows = $derived.by(() => {
    void ctrl.renderCount;
    const part = PARTS[params.part] ?? PARTS.p;
    const r0 = runs[0]?.p;
    const out: { label: string; value: string; unit?: string; strong?: boolean }[] = [];
    if (params.mode === 'B' || params.mode === 'cyc') {
      out.push({ label: 'radius r = mv/(qB)', value: fmt(larmorRadius(part.m, params.mode === 'cyc' ? r0?.speed ?? 0 : params.v, part.q, params.B), 3), unit: 'm', strong: true });
      out.push({ label: 'period T = 2πm/(qB)', value: fmt(cyclotronPeriod(part.m, part.q, params.B), 3), unit: 's' });
      out.push({ label: 'speed now', value: fmt(r0?.speed ?? 0, 3), unit: 'm s⁻¹' });
      if (params.mode === 'cyc') out.push({ label: 'kinetic energy', value: fmt((0.5 * part.m * (r0?.speed ?? 0) ** 2) / e / 1e3, 3), unit: 'keV' });
    } else if (params.mode === 'E') {
      out.push({ label: 'force qE', value: fmt(Math.abs(part.q) * params.E, 3), unit: 'N' });
      out.push({ label: 'acceleration qE/m', value: fmt((Math.abs(part.q) * params.E) / part.m, 3), unit: 'm s⁻²' });
    } else if (params.mode === 'EB') {
      out.push({ label: 'selected speed v = E/B', value: fmt(params.E / params.B, 3), unit: 'm s⁻¹', strong: true });
    } else {
      out.push({ label: 'ion speed', value: fmt(params.v, 3), unit: 'm s⁻¹' });
      detector.forEach((d) => out.push({ label: `${d.label}: diameter 2r`, value: fmt((d.x + 0.4 * size) * 100, 4), unit: 'cm' }));
    }
    return out;
  });

  onMount(() => {
    build();
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
      label="Charged particles moving in electric and magnetic fields"
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
        label="Set-up"
        bind:value={params.mode}
        options={[
          { value: 'B', label: 'B' },
          { value: 'E', label: 'E' },
          { value: 'EB', label: 'Selector' },
          { value: 'spec', label: 'Mass spec' },
          { value: 'cyc', label: 'Cyclotron' },
        ]}
      />
      {#if params.mode === 'B' || params.mode === 'E' || params.mode === 'cyc'}
        <Segmented
          label="Particle"
          bind:value={params.part}
          options={[
            { value: 'p', label: 'Proton' },
            { value: 'e', label: 'Electron' },
            { value: 'a', label: 'Alpha' },
          ]}
        />
      {/if}
      {#if params.mode !== 'EB' && params.mode !== 'cyc'}<Slider def={sl('v')} bind:value={params.v} />{/if}
      {#if params.mode !== 'E'}<Slider def={sl('B')} bind:value={params.B} />{/if}
      {#if params.mode === 'E' || params.mode === 'EB'}<Slider def={sl('E')} bind:value={params.E} />{/if}
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

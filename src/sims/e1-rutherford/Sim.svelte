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
  import { deflection, closestApproach, trajectory, impactFor, nuclearRadius, MEV, M_ALPHA } from '../../physics/rutherford';
  import { Rng } from '../../core/rng';
  import { alpha } from '../../sim/palette';
  import { drawTag } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [
    { key: 'E', label: 'Kinetic energy of the α particles', symbol: 'E_k', unit: 'MeV', min: 1, max: 10, step: 0.1 },
    { key: 'bmax', label: 'Half-width of the beam', symbol: 'b_max', unit: 'fm', min: 20, max: 300, step: 5 },
  ];
  const { params, sl } = useParams({ target: 'Au', E: 5, bmax: 150 }, sliders);
  const presets = [
    { id: 'gold', label: 'Gold foil, 5 MeV α (Geiger–Marsden)', values: { target: 'Au', E: 5, bmax: 150 } },
    { id: 'narrow', label: 'Narrow beam: more large angles', values: { target: 'Au', E: 5, bmax: 40 } },
    { id: 'al', label: 'Aluminium: weaker scattering', values: { target: 'Al', E: 5, bmax: 150 } },
  ];
  const TARGETS: Record<string, { name: string; Z: number; A: number }> = {
    Au: { name: 'gold', Z: 79, A: 197 },
    Ag: { name: 'silver', Z: 47, A: 108 },
    Al: { name: 'aluminium', Z: 13, A: 27 },
  };
  const info: SimInfo = {
    about: [
      'Geiger and Marsden fired α particles at a thin gold foil. Most went straight through, but a few were deflected through large angles — some bounced almost straight back.',
      'Rutherford explained this with a tiny, massive, positively charged nucleus. An α particle passing far from a nucleus is hardly deflected; one aimed close to it is pushed away strongly by the Coulomb repulsion and follows a hyperbola. Large deflections are rare because the nucleus is so small.',
      'For a head-on collision all the kinetic energy turns into electric potential energy at the distance of closest approach d = kZ₁Z₂e²/E_k, an upper limit for the radius of the nucleus.',
      'The histogram counts particles by deflection angle; the curve is Rutherford’s prediction (the number per unit solid angle is proportional to 1/sin⁴(θ/2)).',
    ],
    formulas: [
      { label: 'Coulomb force', tex: 'F = k\\dfrac{q_1q_2}{r^{2}}' },
      { label: 'Head-on closest approach', tex: 'E_k = k\\dfrac{Z_1Z_2e^{2}}{d}', beyond: true },
      { label: 'Deflection', tex: '\\tan\\dfrac{\\theta}{2} = \\dfrac{kZ_1Z_2e^{2}}{2E_kb}', beyond: true },
      { label: 'Nuclear radius', tex: 'R = R_0A^{1/3}', hl: true },
    ],
    assumptions: [
      'One fixed nucleus at a time (it is much heavier than the α particle); only the electric force acts (the α particles do not reach the nucleus at these energies); electrons ignored.',
      'Impact parameters are spread evenly over a circular beam. Paths are calculated exactly (numerically); they are drawn in one plane and shown in slow motion, not to scale in time.',
      'R₀ = 1.2 fm (data booklet). 1 fm = 10⁻¹⁵ m.',
    ],
    tryThis: [
      'What fraction of particles is deflected by more than 90°? How does it change with the energy?',
      'Find the distance of closest approach for 5 MeV α particles on gold and compare with the radius of the gold nucleus.',
      'Compare gold and aluminium at the same energy.',
    ],
  };

  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;
  const fm = 1e-15;
  const NB = 18;
  let hist = new Float64Array(NB);
  let total = 0;
  type Shot = { pts: number[]; age: number };
  let shots: Shot[] = [];
  let rng = new Rng(5);
  let spawnAcc = 0;
  const tgt = () => TARGETS[params.target] ?? TARGETS.Au;
  const VIEW = 160 * fm;

  function spawn() {
    const t = tgt();
    const b = params.bmax * fm * Math.sqrt(rng.next());
    const sign = rng.next() < 0.5 ? -1 : 1;
    const th = deflection(b, params.E * MEV, 2, t.Z);
    const k = Math.min(NB - 1, Math.floor((th / Math.PI) * NB));
    hist[k]++;
    total++;
    if (shots.length < 60) {
      const tr = trajectory(sign * b, params.E * MEV, 2, t.Z, M_ALPHA, 400 * fm, 600);
      shots.push({ pts: tr.pts, age: 0 });
    }
  }

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const usable = view.height - 76;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, view.height);
    const wide = W > 760;
    const sceneW = wide ? W * 0.45 : W;
    const sc = Math.min(sceneW - 20, usable - 20) / (2 * VIEW);
    const cx = sceneW / 2;
    const cy = usable / 2;
    // trajectories (drawn progressively), clipped to the scene
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, sceneW, usable);
    ctx.clip();
    for (const s of shots) {
      const n = Math.min(s.pts.length / 2, Math.floor(s.age * 600));
      ctx.strokeStyle = alpha(pal.series[0].startsWith('#') ? pal.series[0] : '#3b82f6', Math.max(0.15, 1 - s.age / 3));
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = cx + s.pts[2 * i] * sc;
        const y = cy - s.pts[2 * i + 1] * sc;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      if (n > 0 && n < s.pts.length / 2) {
        ctx.fillStyle = pal.series[0];
        ctx.beginPath();
        ctx.arc(cx + s.pts[2 * (n - 1)] * sc, cy - s.pts[2 * (n - 1) + 1] * sc, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    ctx.lineWidth = 1;
    // nucleus to scale and closest-approach circle
    const t = tgt();
    const R = nuclearRadius(t.A);
    const d = closestApproach(params.E * MEV, 2, t.Z);
    ctx.fillStyle = pal.series[3];
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(2, R * sc), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = pal.text3;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, d * sc, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    drawTag(ctx, cx, cy - d * sc - 14, `head-on closest approach ${fmt(d / fm, 3)} fm`, pal.text2, pal.surface);
    // 50 fm scale bar
    ctx.strokeStyle = pal.text2;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(14, usable - 10);
    ctx.lineTo(14 + 50 * fm * sc, usable - 10);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = pal.text2;
    ctx.font = '500 10px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('50 fm', 14, usable - 14);
    // histogram (log scale) with Rutherford prediction
    const hx0 = wide ? sceneW + 60 : 60;
    const hx1 = W - 20;
    const hy0 = wide ? 200 : usable * 0.6;
    const hy1 = usable - 30;
    if (hx1 - hx0 < 100 || hy1 - hy0 < 60 || total === 0) return;
    const bw = (hx1 - hx0) / NB;
    const lmax = Math.log10(Math.max(10, total));
    const Y = (c: number) => (c <= 0 ? hy1 : hy1 - (Math.log10(c) + 0.3) / (lmax + 0.3) * (hy1 - hy0));
    const bmax = params.bmax * fm;
    for (let k = 0; k < NB; k++) {
      ctx.fillStyle = alpha(pal.series[0].startsWith('#') ? pal.series[0] : '#3b82f6', 0.45);
      ctx.fillRect(hx0 + k * bw + 1, Y(hist[k]), bw - 2, hy1 - Y(hist[k]));
      // predicted count in this angle bin
      const t1 = (k * Math.PI) / NB;
      const t2 = ((k + 1) * Math.PI) / NB;
      const f = (th: number) => (th <= 0 ? 1 : Math.min(1, (impactFor(th, params.E * MEV, 2, tgt().Z) / bmax) ** 2));
      const pred = total * (f(t1) - f(t2));
      ctx.strokeStyle = pal.series[3];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hx0 + k * bw, Y(pred));
      ctx.lineTo(hx0 + (k + 1) * bw, Y(pred));
      ctx.stroke();
      ctx.lineWidth = 1;
    }
    ctx.strokeStyle = pal.gridStrong;
    ctx.beginPath();
    ctx.moveTo(hx0, hy0);
    ctx.lineTo(hx0, hy1);
    ctx.lineTo(hx1, hy1);
    ctx.stroke();
    ctx.fillStyle = pal.text3;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const deg of [0, 45, 90, 135, 180]) ctx.fillText(`${deg}°`, hx0 + (deg / 180) * (hx1 - hx0), hy1 + 4);
    ctx.fillText('deflection angle θ', (hx0 + hx1) / 2, hy1 + 16);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('number of α particles (log scale) · line: Rutherford’s prediction', hx0, hy0 - 6);
  }

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        spawnAcc += dt * 25;
        while (spawnAcc >= 1) {
          spawnAcc -= 1;
          // many more particles are counted than drawn (most pass far away)
          for (let i = 0; i < 40; i++) spawn();
        }
        for (const s of shots) s.age += dt;
        shots = shots.filter((s) => s.age < 3);
      },
      render: draw,
      reset: () => {
        hist = new Float64Array(NB);
        total = 0;
        shots = [];
        rng = new Rng(5);
      },
    },
    { dt: 1 / 60, autoplay: true },
  );
  const palette = usePalette(() => ctrl);
  resetOn(ctrl, () => [params.target, params.E, params.bmax]);

  const rows = $derived.by(() => {
    void ctrl.renderCount;
    const t = tgt();
    const back = hist.slice(NB / 2).reduce((a, b) => a + b, 0);
    return [
      { label: 'closest approach d (head-on)', value: fmt(closestApproach(params.E * MEV, 2, t.Z) / fm, 3), unit: 'fm', strong: true },
      { label: `radius of the ${t.name} nucleus R₀A^⅓`, value: fmt(nuclearRadius(t.A) / fm, 3), unit: 'fm' },
      { label: 'α particles counted', value: `${total}` },
      { label: 'deflected by more than 90°', value: total ? `${back} (${((100 * back) / total).toPrecision(2)} %)` : '0' },
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
      label="Alpha particles scattered by a nucleus with a histogram of deflection angles"
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
        label="Target"
        bind:value={params.target}
        options={[
          { value: 'Au', label: 'Gold' },
          { value: 'Ag', label: 'Silver' },
          { value: 'Al', label: 'Aluminium' },
        ]}
      />
      <Slider def={sl('E')} bind:value={params.E} />
      <Slider def={sl('bmax')} bind:value={params.bmax} />
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

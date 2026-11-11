<script lang="ts">
  import { onDestroy } from 'svelte';
  import LabShell from './LabShell.svelte';
  import { Recorder } from '../core/recorder';
  import type { GraphDef } from '../sim/types';
  import type { ReadoutRow } from '../sim/Readouts.svelte';
  import type { LabMeta } from './tools';
  import { watchGps, holdScreenOn, support, type GpsSample } from './sensors';
  import { haversine, R_EARTH_GPS } from './analysis';
  import { readPalette } from '../sim/palette';
  import { fmt } from '../core/format';

  let { meta }: { meta: LabMeta } = $props();
  const MAX_ACC = 30; // m: less accurate positions are not added to the distance
  const rec = new Recorder([
    { key: 't', label: 't', unit: 's' },
    { key: 'v', label: 'speed', unit: 'm s⁻¹', color: '--series-1' },
    { key: 'd', label: 'distance travelled', unit: 'm', color: '--series-4' },
    { key: 'h', label: 'altitude', unit: 'm', color: '--series-2' },
    { key: 'acc', label: 'accuracy', unit: 'm', color: '--series-3' },
  ]);
  const graphs: GraphDef[] = [
    { id: 'v', title: 'Speed', series: ['v'] },
    { id: 'd', title: 'Distance travelled', series: ['d'] },
    { id: 'h', title: 'Altitude', series: ['h'] },
  ];
  let running = $state(false);
  let status = $state('');
  let hint = $state('');
  let cur = $state<GpsSample | null>(null);
  let dist = $state(0);
  let t0 = NaN;
  let lastGood: GpsSample | null = null;
  const route: [number, number][] = [];
  let origin: GpsSample | null = null;
  let stopWatch: (() => void) | null = null;
  let release: (() => void) | null = null;
  let canvas: HTMLCanvasElement | undefined = $state();

  function onSample(s: GpsSample) {
    if (!running) return;
    status = '';
    hint = '';
    if (Number.isNaN(t0)) t0 = s.t;
    if (!origin) origin = s;
    if (s.accuracy <= MAX_ACC) {
      if (lastGood) dist += haversine(lastGood.lat, lastGood.lon, s.lat, s.lon);
      lastGood = s;
      const x = ((s.lon - origin.lon) * Math.PI * R_EARTH_GPS * Math.cos((origin.lat * Math.PI) / 180)) / 180;
      const y = ((s.lat - origin.lat) * Math.PI * R_EARTH_GPS) / 180;
      route.push([x, y]);
    }
    cur = s;
    rec.push([s.t - t0, s.speed, dist, s.alt, s.accuracy]);
  }
  async function start() {
    status = '';
    if (!support().gps) {
      status = 'This browser has no access to location.';
      return;
    }
    running = true;
    hint = 'Waiting for the first position (outside this takes a few seconds)…';
    stopWatch = watchGps(onSample, (msg) => {
      status = msg;
      hint = '';
    });
    release = holdScreenOn();
  }
  function stop() {
    running = false;
    stopWatch?.();
    stopWatch = null;
    release?.();
    hint = '';
  }
  function clear() {
    rec.clear();
    route.length = 0;
    dist = 0;
    lastGood = null;
    origin = null;
    t0 = NaN;
    cur = null;
  }
  onDestroy(stop);

  $effect(() => {
    void cur;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = canvas.clientWidth;
    const H = 240;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const pal = readPalette();
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = pal.text3;
    ctx.font = '500 11px Inter Variable, system-ui, sans-serif';
    if (route.length < 1) {
      ctx.textAlign = 'center';
      ctx.fillText('your route will appear here (north is up)', W / 2, H / 2);
      return;
    }
    let ext = 20;
    for (const [x, y] of route) ext = Math.max(ext, Math.abs(x), Math.abs(y));
    const k = (Math.min(W, H) / 2 - 16) / ext;
    ctx.strokeStyle = pal.series[0];
    ctx.lineWidth = 3;
    ctx.beginPath();
    route.forEach(([x, y], i) => (i ? ctx.lineTo(W / 2 + x * k, H / 2 - y * k) : ctx.moveTo(W / 2 + x * k, H / 2 - y * k)));
    ctx.stroke();
    ctx.lineWidth = 1;
    const [lx, ly] = route[route.length - 1];
    ctx.fillStyle = pal.series[3];
    ctx.beginPath();
    ctx.arc(W / 2 + lx * k, H / 2 - ly * k, 6, 0, Math.PI * 2);
    ctx.fill();
    // scale bar
    const bar = 10 ** Math.floor(Math.log10(ext));
    ctx.strokeStyle = pal.text2;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(12, H - 14);
    ctx.lineTo(12 + bar * k, H - 14);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = pal.text2;
    ctx.textAlign = 'left';
    ctx.fillText(`${bar} m`, 12, H - 20);
  });

  const rows = $derived.by((): ReadoutRow[] => {
    const s = cur;
    const tt = rec.length ? rec.last(0) : 0;
    return [
      { label: 'latitude, longitude', value: s ? `${s.lat.toFixed(5)}°, ${s.lon.toFixed(5)}°` : '—' },
      { label: 'accuracy', value: s ? `± ${fmt(s.accuracy, 2)}` : '—', unit: s ? 'm' : undefined },
      { label: 'speed', value: s && Number.isFinite(s.speed) ? `${fmt(s.speed, 3)} m s⁻¹ = ${fmt(s.speed * 3.6, 3)}` : '—', unit: s && Number.isFinite(s.speed) ? 'km h⁻¹' : undefined, strong: true },
      { label: 'altitude', value: s && Number.isFinite(s.alt) ? fmt(s.alt, 4) : '—', unit: s && Number.isFinite(s.alt) ? 'm' : undefined },
      { label: 'distance travelled', value: fmt(dist, 4), unit: 'm', color: '--series-4' },
      { label: 'average speed = distance ÷ time', value: tt > 0 ? fmt(dist / tt, 3) : '—', unit: tt > 0 ? 'm s⁻¹' : undefined },
    ];
  });
</script>

<LabShell {meta} {running} ontoggle={() => (running ? stop() : start())} onclear={clear} {status} {hint} {rows} recorder={rec} {graphs}>
  {#snippet visual()}<canvas bind:this={canvas} style="height:240px" aria-label="Route travelled, north up"></canvas>{/snippet}
</LabShell>

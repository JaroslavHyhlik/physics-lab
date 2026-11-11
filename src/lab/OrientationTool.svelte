<script lang="ts">
  import { onDestroy } from 'svelte';
  import LabShell from './LabShell.svelte';
  import { Recorder } from '../core/recorder';
  import type { GraphDef } from '../sim/types';
  import type { ReadoutRow } from '../sim/Readouts.svelte';
  import type { LabMeta } from './tools';
  import { listenOrientation, requestMotionPermission, holdScreenOn, support, type OrientationSample } from './sensors';
  import { readPalette } from '../sim/palette';
  import { fmt } from '../core/format';

  let { meta }: { meta: LabMeta } = $props();
  const rec = new Recorder([
    { key: 't', label: 't', unit: 's' },
    { key: 'b', label: 'tilt front–back β', unit: '°', color: '--series-1' },
    { key: 'g', label: 'tilt left–right γ', unit: '°', color: '--series-2' },
    { key: 'h', label: 'compass heading', unit: '°', color: '--series-4' },
  ]);
  const graphs: GraphDef[] = [
    { id: 'tilt', title: 'Tilt', series: ['b', 'g'] },
    { id: 'h', title: 'Compass heading', series: ['h'] },
  ];
  let running = $state(false);
  let status = $state('');
  let hint = $state('');
  let cur = $state<OrientationSample | null>(null);
  let magnet = $state(NaN); // µT, only where the Generic Sensor API exists
  let stopListen: (() => void) | null = null;
  let release: (() => void) | null = null;
  let sensor: { stop: () => void } | null = null;
  let t0 = NaN;
  let noData = 0;
  let canvas: HTMLCanvasElement | undefined = $state();

  function onSample(s: OrientationSample) {
    if (!running || !Number.isFinite(s.beta)) return;
    if (Number.isNaN(t0)) t0 = s.t;
    cur = s;
    rec.push([s.t - t0, s.beta, s.gamma, Number.isFinite(s.heading) ? s.heading : NaN]);
    hint = '';
  }

  async function start() {
    status = '';
    if (!support().orientation) {
      status = 'This browser gives no orientation data (for example on a laptop). Open the lab on your phone.';
      return;
    }
    const p = await requestMotionPermission();
    if (destroyed) return;
    if (p === 'denied') {
      status = 'No access to orientation: access was refused, or this device has no such sensor. On iPhone: Settings → Safari → Motion & Orientation Access, then reload the page.';
      return;
    }
    running = true;
    hint = 'Waiting for data from the sensor…';
    stopListen = listenOrientation(onSample);
    release = holdScreenOn();
    noData = window.setTimeout(() => {
      if (running && !cur) status = 'No orientation data arrives. This device probably has no such sensor, or access was blocked.';
    }, 2500);
    // magnetometer in µT: only browsers with the Generic Sensor API (not iPhone)
    const M = (window as unknown as { Magnetometer?: new (o: { frequency: number }) => { x: number; y: number; z: number; start: () => void; stop: () => void; addEventListener: (e: string, f: () => void) => void } }).Magnetometer;
    if (M) {
      try {
        const m = new M({ frequency: 10 });
        m.addEventListener('reading', () => (magnet = Math.hypot(m.x, m.y, m.z)));
        m.start();
        sensor = m;
      } catch {
        sensor = null;
      }
    }
  }
  function stop() {
    running = false;
    stopListen?.();
    release?.();
    sensor?.stop();
    sensor = null;
    clearTimeout(noData);
    hint = '';
  }
  let destroyed = false;
  onDestroy(() => {
    destroyed = true;
    stop();
  });

  $effect(() => {
    const s = cur;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = canvas.clientWidth;
    const H = 230;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const pal = readPalette();
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    const r = Math.min(90, W / 4 - 12);
    // spirit level: the bubble moves away from the low side
    const lx = W / 4;
    const ly = H / 2;
    ctx.strokeStyle = pal.text3;
    ctx.beginPath();
    ctx.arc(lx, ly, r, 0, Math.PI * 2);
    ctx.moveTo(lx - r, ly);
    ctx.lineTo(lx + r, ly);
    ctx.moveTo(lx, ly - r);
    ctx.lineTo(lx, ly + r);
    ctx.stroke();
    if (s) {
      const bx = Math.max(-1, Math.min(1, s.gamma / 45));
      const by = Math.max(-1, Math.min(1, s.beta / 45));
      ctx.fillStyle = pal.series[2];
      ctx.beginPath();
      ctx.arc(lx - bx * (r - 14), ly - by * (r - 14), 14, 0, Math.PI * 2);
      ctx.fill();
    }
    // compass: the needle points to north on the phone's screen
    const cx = (3 * W) / 4;
    ctx.strokeStyle = pal.text3;
    ctx.beginPath();
    ctx.arc(cx, ly, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = pal.text2;
    ctx.font = '600 12px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('phone →', cx, ly - r - 12 < 6 ? ly - r + 12 : ly - r - 10);
    if (s && Number.isFinite(s.heading)) {
      const a = (-s.heading * Math.PI) / 180; // north is at −heading from the top of the phone
      ctx.strokeStyle = pal.series[3];
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(cx, ly);
      ctx.lineTo(cx + Math.sin(a) * (r - 10), ly - Math.cos(a) * (r - 10));
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.fillStyle = pal.series[3];
      ctx.fillText('N', cx + Math.sin(a) * (r + 12), ly - Math.cos(a) * (r + 12));
    } else {
      ctx.fillText('no heading', cx, ly);
    }
  });

  const rows = $derived.by((): ReadoutRow[] => {
    const s = cur;
    return [
      { label: 'tilt front–back β', value: s ? s.beta.toFixed(1) : '—', unit: s ? '°' : undefined, strong: true },
      { label: 'tilt left–right γ', value: s ? s.gamma.toFixed(1) : '—', unit: s ? '°' : undefined, strong: true },
      { label: 'compass heading', value: s && Number.isFinite(s.heading) ? s.heading.toFixed(0) : '—', unit: s && Number.isFinite(s.heading) ? '°' : undefined },
      { label: 'magnetic field strength', value: Number.isFinite(magnet) ? fmt(magnet, 3) : 'not available in this browser', unit: Number.isFinite(magnet) ? 'µT' : undefined },
    ];
  });
</script>

<LabShell {meta} {running} ontoggle={() => (running ? stop() : start())} onclear={() => rec.clear()} {status} {hint} {rows} recorder={rec} {graphs}>
  {#snippet visual()}<canvas bind:this={canvas} style="height:230px" aria-label="Spirit level and compass"></canvas>{/snippet}
</LabShell>

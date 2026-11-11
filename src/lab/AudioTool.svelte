<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import LabShell from './LabShell.svelte';
  import Slider from '../ui/Slider.svelte';
  import { Recorder, type ChannelDef } from '../core/recorder';
  import type { GraphDef } from '../sim/types';
  import type { ReadoutRow } from '../sim/Readouts.svelte';
  import type { LabMeta } from './tools';
  import { openMic, explainError, holdScreenOn, support, type Mic } from './sensors';
  import { spectrum, peakFrequency, rmsDb } from './analysis';
  import { readPalette, alpha } from '../sim/palette';
  import { fmt } from '../core/format';

  let { meta }: { meta: LabMeta } = $props();
  // the page re-creates this component for another experiment ({#key}), so reading meta once is enough
  const id = untrack(() => meta.id); // 'oscilloscope' | 'spectrum' | 'acoustic-stopwatch'
  const N = 4096;

  let span = $state(20); // oscilloscope time span [ms]
  let fmax = $state(5000); // spectrum upper frequency [Hz]
  let threshold = $state(0.3); // stopwatch trigger level (fraction of full scale)
  let distance = $state(34); // stopwatch: distance travelled by the sound [m]

  const channels: ChannelDef[] =
    id === 'spectrum'
      ? [
          { key: 't', label: 't', unit: 's' },
          { key: 'f', label: 'peak frequency', unit: 'Hz', color: '--series-1' },
          { key: 'L', label: 'level', unit: 'dBFS', color: '--series-4' },
        ]
      : [
          { key: 't', label: 't', unit: 's' },
          { key: 'L', label: 'level', unit: 'dBFS', color: '--series-4' },
        ];
  const graphs: GraphDef[] =
    id === 'spectrum'
      ? [
          { id: 'f', title: 'Peak frequency', series: ['f'] },
          { id: 'L', title: 'Sound level', series: ['L'] },
        ]
      : [{ id: 'L', title: 'Sound level', series: ['L'] }];
  const rec = new Recorder(channels, 40000);
  const row = new Float64Array(channels.length);

  let running = $state(false);
  let status = $state('');
  let hint = $state('');
  let tick = $state(0);
  let mic: Mic | null = null;
  let starting = false;
  let cancelled = false;
  let release: (() => void) | null = null;
  let raf = 0;
  let tStart = 0;
  let lastRec = 0;
  const data = new Float32Array(N);
  let level = $state(-120);
  let peak = $state({ f: NaN, amp: 0 });
  let fs = $state(48000);

  // acoustic stopwatch state (sample-accurate, from a ScriptProcessor stream)
  let proc: ScriptProcessorNode | null = null;
  let mute: GainNode | null = null;
  let armed = $state(false);
  let firstAt = -1;
  let deadUntil = 0;
  let sampleCount = 0;
  let maxAbs = $state(0);
  let results: number[] = $state([]);

  let scope: HTMLCanvasElement | undefined = $state();
  let spec: HTMLCanvasElement | undefined = $state();
  let gram: HTMLCanvasElement | undefined = $state();

  function size(c: HTMLCanvasElement, h: number) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = c.clientWidth;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  function drawScope() {
    if (!scope) return;
    const { ctx, w, h } = size(scope, 220);
    const pal = readPalette();
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = pal.grid;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
    // trigger: first upward zero crossing in the first half of the buffer
    let start = 0;
    for (let i = 1; i < N / 2; i++)
      if (data[i - 1] < 0 && data[i] >= 0) {
        start = i;
        break;
      }
    const n = Math.min(N - start, Math.round((span / 1000) * fs));
    let mx = 0.05;
    for (let i = start; i < start + n; i++) mx = Math.max(mx, Math.abs(data[i]));
    ctx.strokeStyle = pal.series[0];
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * w;
      const y = h / 2 - (data[start + i] / mx) * (h / 2 - 8);
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = pal.text3;
    ctx.font = '500 11px Inter Variable, system-ui, sans-serif';
    ctx.fillText(`${span} ms across · scaled to the loudest point`, 8, h - 8);
  }

  const sp = new Float64Array(N / 2);
  function drawSpectrum() {
    if (!spec || !gram) return;
    const { ctx, w, h } = size(spec, 200);
    const pal = readPalette();
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, w, h);
    const kmax = Math.min(sp.length - 1, Math.round((fmax * N) / fs));
    const db = (v: number) => Math.max(-100, 20 * Math.log10(v + 1e-12));
    ctx.strokeStyle = pal.series[0];
    ctx.beginPath();
    for (let k = 1; k <= kmax; k++) {
      const x = (k / kmax) * w;
      const y = h - 18 - ((db(sp[k]) + 100) / 100) * (h - 26);
      if (k > 1) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = pal.text3;
    ctx.font = '500 11px Inter Variable, system-ui, sans-serif';
    for (let f = 0; f <= fmax; f += fmax / 5) ctx.fillText(`${f >= 1000 ? `${f / 1000} k` : f}Hz`, (f / fmax) * w + 2, h - 4);
    if (Number.isFinite(peak.f) && peak.f < fmax) {
      ctx.strokeStyle = pal.series[3];
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo((peak.f / fmax) * w, 0);
      ctx.lineTo((peak.f / fmax) * w, h - 18);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // spectrogram: scroll left by 2 px and draw the newest column on the right
    const g = size(gram, 160);
    const gctx = g.ctx;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    gctx.setTransform(1, 0, 0, 1, 0, 0);
    gctx.drawImage(gram, -2 * dpr, 0);
    gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const col = pal.series[0].startsWith('#') ? pal.series[0] : '#3b82f6';
    gctx.fillStyle = pal.bg;
    gctx.fillRect(g.w - 2, 0, 2, g.h);
    const rows = 80;
    for (let r = 0; r < rows; r++) {
      const k = Math.round(((r + 0.5) / rows) * kmax);
      const v = Math.min(1, Math.max(0, (db(sp[k]) + 90) / 70));
      if (v <= 0) continue;
      gctx.fillStyle = alpha(col, v);
      gctx.fillRect(g.w - 2, g.h - ((r + 1) / rows) * g.h, 2, g.h / rows + 1);
    }
  }

  function frame() {
    if (!running || !mic) return;
    mic.analyser.getFloatTimeDomainData(data);
    level = rmsDb(data);
    const now = (performance.now() - tStart) / 1000;
    if (id === 'oscilloscope') drawScope();
    if (id !== 'acoustic-stopwatch') {
      spectrum(data, sp);
      peak = peakFrequency(sp, fs, N, 30);
      if (id === 'spectrum') drawSpectrum();
    }
    if (now - lastRec >= 0.05) {
      lastRec = now;
      row[0] = now;
      if (id === 'spectrum') {
        row[1] = level > -70 ? peak.f : NaN;
        row[2] = level;
        if (Number.isFinite(row[1])) rec.push(row);
      } else {
        row[1] = level;
        rec.push(row);
      }
      tick++;
    }
    raf = requestAnimationFrame(frame);
  }

  function onBlock(e: AudioProcessingEvent) {
    const x = e.inputBuffer.getChannelData(0);
    let m = 0;
    for (let i = 0; i < x.length; i++) {
      const a = Math.abs(x[i]);
      if (a > m) m = a;
      if (armed && sampleCount + i >= deadUntil && a > threshold) {
        const t = (sampleCount + i) / fs;
        if (firstAt < 0) {
          firstAt = t;
          deadUntil = sampleCount + i + Math.round(0.05 * fs);
        } else {
          results = [t - firstAt, ...results].slice(0, 10);
          firstAt = -1;
          armed = false;
        }
      }
    }
    maxAbs = m;
    sampleCount += x.length;
  }

  async function start() {
    status = '';
    if (!support().mic) {
      status = 'This browser cannot use a microphone here (it needs a secure https:// page and a device with a microphone).';
      return;
    }
    hint = 'Starting the microphone…';
    starting = true;
    try {
      mic = await openMic(N);
    } catch (e) {
      starting = false;
      hint = '';
      status = explainError(e, 'microphone');
      return;
    }
    starting = false;
    if (cancelled) {
      cancelled = false;
      mic.stop();
      mic = null;
      hint = '';
      return;
    }
    fs = mic.sampleRate;
    running = true;
    hint = '';
    tStart = performance.now();
    lastRec = -1;
    release = holdScreenOn();
    if (id === 'acoustic-stopwatch') {
      proc = mic.ctx.createScriptProcessor(2048, 1, 1);
      mute = mic.ctx.createGain();
      mute.gain.value = 0;
      proc.onaudioprocess = onBlock;
      mic.source.connect(proc);
      proc.connect(mute);
      mute.connect(mic.ctx.destination);
      sampleCount = 0;
    }
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    if (starting) cancelled = true;
    running = false;
    armed = false;
    cancelAnimationFrame(raf);
    proc?.disconnect();
    mute?.disconnect();
    proc = null;
    mic?.stop();
    mic = null;
    release?.();
    release = null;
  }
  function clear() {
    rec.clear();
    results = [];
    tick++;
  }
  onDestroy(stop);

  const rows = $derived.by((): ReadoutRow[] => {
    void tick;
    const r: ReadoutRow[] = [{ label: 'level (relative to full scale)', value: running ? level.toFixed(1) : '—', unit: running ? 'dBFS' : undefined }];
    if (id !== 'acoustic-stopwatch')
      r.push({
        label: 'strongest frequency',
        value: running && Number.isFinite(peak.f) && level > -70 ? fmt(peak.f, 4) : '—',
        unit: running && Number.isFinite(peak.f) && level > -70 ? 'Hz' : undefined,
        strong: true,
      });
    if (id === 'spectrum') r.push({ label: 'resolution of the bins fs/N', value: fmt(fs / N, 3), unit: 'Hz' }, { label: 'sample rate', value: fmt(fs, 5), unit: 'Hz' });
    if (id === 'acoustic-stopwatch') {
      r.push({ label: 'state', value: !running ? 'microphone off' : armed ? (firstAt >= 0 ? 'timing… waiting for the second sound' : 'armed: waiting for the first sound') : 'not armed' });
      if (results.length) {
        r.push(
          { label: 'time between the sounds Δt', value: results[0].toFixed(4), unit: 's', strong: true },
          { label: 'speed d/Δt', value: fmt(distance / results[0], 3), unit: 'm s⁻¹', color: '--series-4' },
        );
        if (results.length > 1) r.push({ label: 'earlier results', value: results.slice(1).map((x) => x.toFixed(4)).join(', '), unit: 's' });
      }
    }
    return r;
  });
</script>

<LabShell
  {meta}
  {running}
  ontoggle={() => (running ? stop() : start())}
  onclear={clear}
  {status}
  {hint}
  {rows}
  recorder={rec}
  {graphs}
  startLabel="Start microphone"
>
  {#snippet visual()}
    {#if id === 'oscilloscope'}<canvas bind:this={scope} style="height:220px" aria-label="Microphone signal against time"></canvas>{/if}
    {#if id === 'spectrum'}
      <canvas bind:this={spec} style="height:200px" aria-label="Sound spectrum: amplitude against frequency"></canvas>
      <canvas bind:this={gram} style="height:160px;margin-top:8px" aria-label="Spectrogram: frequency against time"></canvas>
    {/if}
    {#if id === 'acoustic-stopwatch'}
      <div class="meter" aria-label="Loudness of the latest sound">
        <div class="bar" style={`width:${Math.min(100, maxAbs * 100)}%`}></div>
        <div class="thr" style={`left:${threshold * 100}%`}></div>
      </div>
    {/if}
  {/snippet}
  {#snippet controls()}
    {#if id === 'oscilloscope'}<Slider def={{ key: 'span', label: 'Time across the screen', symbol: '', unit: 'ms', min: 2, max: 80, step: 1 }} bind:value={span} />{/if}
    {#if id === 'spectrum'}<Slider def={{ key: 'fmax', label: 'Highest frequency shown', symbol: '', unit: 'Hz', min: 500, max: 20000, step: 100, log: true }} bind:value={fmax} />{/if}
    {#if id === 'acoustic-stopwatch'}
      <button type="button" class="arm" disabled={!running} onclick={() => ((armed = true), (firstAt = -1), (deadUntil = 0))}>{armed ? 'Armed' : 'Arm the stopwatch'}</button>
      <Slider def={{ key: 'thr', label: 'Trigger threshold (fraction of the loudest possible)', symbol: '', unit: '', min: 0.02, max: 0.95, step: 0.01 }} bind:value={threshold} />
      <Slider def={{ key: 'd', label: 'Distance the sound travels between the two triggers', symbol: 'd', unit: 'm', min: 0.1, max: 500, step: 0.1, log: true }} bind:value={distance} />
    {/if}
  {/snippet}
</LabShell>

<style>
  .meter {
    position: relative;
    height: 28px;
    border-radius: var(--radius-s);
    background: var(--surface-2);
    overflow: hidden;
  }
  .bar {
    height: 100%;
    background: var(--series-1);
  }
  .thr {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 3px;
    background: var(--danger);
  }
  .arm {
    min-height: 48px;
    border-radius: var(--radius-m);
    border: 1px solid var(--accent);
    background: var(--accent-soft);
    color: var(--accent);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }
  .arm:disabled {
    opacity: 0.45;
    cursor: default;
  }
</style>

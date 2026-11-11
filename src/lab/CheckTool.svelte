<script lang="ts">
  import { onDestroy } from 'svelte';
  import LabShell from './LabShell.svelte';
  import type { ReadoutRow } from '../sim/Readouts.svelte';
  import type { LabMeta } from './tools';
  import { support, requestMotionPermission, listenMotion, listenOrientation, openMic, explainError, RateMeter, type Mic } from './sensors';
  import { rmsDb } from './analysis';
  import { fmt } from '../core/format';

  let { meta }: { meta: LabMeta } = $props();
  const s = support();
  let running = $state(false);
  let status = $state('');
  let motionState = $state(s.motion ? (s.needsPermission ? 'needs permission' : 'available') : 'not available');
  let micState = $state(s.mic ? 'not tested' : 'not available');
  let gpsState = $state(s.gps ? 'not tested' : 'not available');
  let motionHz = $state(0);
  let orientHz = $state(0);
  let micDb = $state(NaN);
  let micRate = $state(NaN);
  const mRate = new RateMeter();
  const oRate = new RateMeter();
  let offM: (() => void) | null = null;
  let offO: (() => void) | null = null;
  let mic: Mic | null = null;
  let timer = 0;

  async function start() {
    status = '';
    const p = await requestMotionPermission();
    if (p === 'denied') {
      motionState = 'refused';
      status = 'No access to the motion sensors: access was refused, or this device has none. On iPhone: Settings → Safari → Motion & Orientation Access, then reload the page.';
    } else if (p === 'unsupported') motionState = 'not available';
    else {
      offM = listenMotion(() => mRate.tick());
      offO = listenOrientation(() => oRate.tick());
    }
    running = true;
    timer = window.setInterval(() => {
      motionHz = mRate.hz;
      orientHz = oRate.hz;
      if (motionHz > 0) motionState = 'working';
      if (mic) {
        const d = new Float32Array(mic.analyser.fftSize);
        mic.analyser.getFloatTimeDomainData(d);
        micDb = rmsDb(d);
      }
    }, 250);
  }
  function stop() {
    running = false;
    offM?.();
    offO?.();
    offM = offO = null;
    mic?.stop();
    mic = null;
    clearInterval(timer);
    mRate.reset();
    oRate.reset();
  }
  async function testMic() {
    try {
      mic = await openMic(2048);
      micRate = mic.sampleRate;
      micState = 'working';
      if (!running) await start();
    } catch (e) {
      micState = 'refused or missing';
      status = explainError(e, 'microphone');
    }
  }
  function testGps() {
    if (!s.gps) return;
    gpsState = 'waiting…';
    navigator.geolocation.getCurrentPosition(
      (p) => (gpsState = `working (± ${fmt(p.coords.accuracy, 2)} m)`),
      (e) => {
        gpsState = 'refused or unavailable';
        status = explainError(e, 'location');
      },
      { enableHighAccuracy: true, timeout: 20000 },
    );
  }
  onDestroy(stop);

  const yes = (b: boolean) => (b ? 'yes' : 'no');
  const rows = $derived.by((): ReadoutRow[] => [
    { label: 'secure page (https)', value: yes(s.secure) },
    { label: 'accelerometer and gyroscope', value: motionState, strong: true },
    { label: 'motion readings per second', value: running ? fmt(motionHz, 3) : '—', unit: running ? 'Hz' : undefined },
    { label: 'orientation readings per second', value: running ? fmt(orientHz, 3) : '—', unit: running ? 'Hz' : undefined },
    { label: 'microphone', value: micState, strong: true },
    { label: 'microphone level / sample rate', value: Number.isFinite(micRate) ? `${micDb.toFixed(1)} dBFS / ${fmt(micRate, 5)} Hz` : '—' },
    { label: 'location (GPS)', value: gpsState, strong: true },
    { label: 'keep the screen on (Wake Lock)', value: yes(s.wakeLock) },
    { label: 'share sheet (AirDrop …)', value: yes(s.share) },
    { label: 'magnetic field, light, pressure', value: 'not available in Safari' },
  ]);
</script>

<LabShell {meta} {running} ontoggle={() => (running ? stop() : start())} {status} {rows} startLabel="Allow motion sensors" stopLabel="Stop the check">
  {#snippet controls()}
    <div class="row">
      <button type="button" onclick={testMic} disabled={!s.mic}>Test the microphone</button>
      <button type="button" onclick={testGps} disabled={!s.gps}>Test the location</button>
    </div>
  {/snippet}
</LabShell>

<style>
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  button {
    min-height: 48px;
    padding: 0 var(--space-4);
    border-radius: var(--radius-m);
    border: 1px solid var(--accent);
    background: transparent;
    color: var(--accent);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.45;
  }
</style>

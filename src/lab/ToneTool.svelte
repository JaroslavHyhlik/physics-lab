<script lang="ts">
  import { onDestroy } from 'svelte';
  import LabShell from './LabShell.svelte';
  import Slider from '../ui/Slider.svelte';
  import Segmented from '../ui/Segmented.svelte';
  import Toggle from '../ui/Toggle.svelte';
  import type { ReadoutRow } from '../sim/Readouts.svelte';
  import type { LabMeta } from './tools';
  import { support } from './sensors';
  import { fmt } from '../core/format';

  let { meta }: { meta: LabMeta } = $props();
  const V_SOUND = 343; // m s⁻¹ in air at 20 °C

  let wave = $state<OscillatorType>('sine');
  let f1 = $state(440);
  let f2 = $state(442);
  let second = $state(false);
  let volume = $state(0.3);
  let running = $state(false);
  let status = $state('');

  let ctx: AudioContext | null = null;
  let o1: OscillatorNode | null = null;
  let o2: OscillatorNode | null = null;
  let gain: GainNode | null = null;

  async function start() {
    status = '';
    if (!support().audio) {
      status = 'This browser cannot play generated sound.';
      return;
    }
    // iPhone: play even when the ring/silent switch is on silent
    const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (session) session.type = 'playback';
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    if (ctx.state === 'suspended') await ctx.resume();
    gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(ctx.destination);
    o1 = ctx.createOscillator();
    o1.connect(gain);
    o1.start();
    running = true;
    apply();
    gain.gain.setTargetAtTime(volume * (second ? 0.5 : 1), ctx.currentTime, 0.02);
  }
  function stop() {
    running = false;
    if (ctx && gain) gain.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
    const c = ctx;
    setTimeout(() => void c?.close(), 120);
    ctx = null;
    o1 = o2 = null;
    gain = null;
  }
  function apply() {
    if (!ctx || !o1 || !gain) return;
    const t = ctx.currentTime;
    o1.type = wave;
    o1.frequency.setTargetAtTime(f1, t, 0.01);
    if (second && !o2) {
      o2 = ctx.createOscillator();
      o2.connect(gain);
      o2.start();
    }
    if (!second && o2) {
      o2.stop();
      o2.disconnect();
      o2 = null;
    }
    if (o2) {
      o2.type = wave;
      o2.frequency.setTargetAtTime(f2, t, 0.01);
    }
    gain.gain.setTargetAtTime(volume * (second ? 0.5 : 1), t, 0.02);
  }
  $effect(() => {
    void [wave, f1, f2, second, volume];
    apply();
  });
  onDestroy(stop);

  const rows = $derived.by((): ReadoutRow[] => {
    const r: ReadoutRow[] = [
      { label: 'frequency f₁', value: fmt(f1, 4), unit: 'Hz', strong: true },
      { label: 'period T = 1/f', value: fmt(1000 / f1, 3), unit: 'ms' },
      { label: 'wavelength in air λ = v/f (v = 343 m s⁻¹)', value: fmt(V_SOUND / f1, 3), unit: 'm' },
    ];
    if (second) r.push({ label: 'beat frequency |f₁ − f₂|', value: fmt(Math.abs(f1 - f2), 3), unit: 'Hz', color: '--series-4' });
    return r;
  });
</script>

<LabShell {meta} {running} ontoggle={() => (running ? stop() : start())} {status} {rows} startLabel="Play" stopLabel="Stop sound">
  {#snippet controls()}
    <Segmented
      label="Waveform"
      bind:value={wave}
      options={[
        { value: 'sine', label: 'Sine' },
        { value: 'square', label: 'Square' },
        { value: 'triangle', label: 'Triangle' },
        { value: 'sawtooth', label: 'Sawtooth' },
      ]}
    />
    <Slider def={{ key: 'f1', label: 'Frequency', symbol: 'f_1', unit: 'Hz', min: 20, max: 20000, step: 1, log: true }} bind:value={f1} />
    <Slider def={{ key: 'vol', label: 'Volume', symbol: '', unit: '', min: 0, max: 1, step: 0.01 }} bind:value={volume} />
    <Toggle label="Second tone (beats)" bind:checked={second} />
    {#if second}<Slider def={{ key: 'f2', label: 'Frequency of the second tone', symbol: 'f_2', unit: 'Hz', min: 20, max: 20000, step: 0.1, log: true }} bind:value={f2} />{/if}
  {/snippet}
</LabShell>

<script lang="ts">
  import type { NumberParamDef } from '../sim/params.svelte';
  import Badge from './Badge.svelte';
  import SubText from './SubText.svelte';

  let {
    def,
    value = $bindable(),
    disabled = false,
  }: { def: NumberParamDef; value: number; disabled?: boolean } = $props();

  const RES = 1000;
  const decimals = $derived(
    def.decimals ?? Math.max(0, Math.min(6, -Math.floor(Math.log10(def.step) + 1e-9))),
  );

  function toPos(v: number): number {
    if (def.log) return (RES * Math.log(v / def.min)) / Math.log(def.max / def.min);
    return v;
  }
  function fromPos(p: number): number {
    if (def.log) {
      const v = def.min * Math.pow(def.max / def.min, p / RES);
      const mag = Math.pow(10, Math.floor(Math.log10(v)) - 2);
      return Math.round(v / mag) * mag;
    }
    return p;
  }
  function clamp(v: number): number {
    return Math.min(def.max, Math.max(def.min, v));
  }

  const pct = $derived(
    def.log
      ? (100 * Math.log(value / def.min)) / Math.log(def.max / def.min)
      : (100 * (value - def.min)) / (def.max - def.min),
  );

  let text = $state('');
  let editing = $state(false);
  // log sliders span orders of magnitude: show 3 significant figures
  const shown = $derived(def.log ? Number(value.toPrecision(3)).toString() : value.toFixed(decimals));

  function commit() {
    const v = parseFloat(text.replace(',', '.').replace('−', '-'));
    if (Number.isFinite(v)) value = clamp(v);
    editing = false;
  }
  const id = `sl-${Math.random().toString(36).slice(2, 9)}`;
</script>

<div class="slider" class:disabled>
  <div class="row">
    <label for={id}>
      <span><SubText text={def.label} /></span>
      {#if def.symbol}<span class="sym"><SubText text={def.symbol} /></span>{/if}
      {#if def.hl}<Badge kind="hl" />{/if}
    </label>
    <span class="value num">
      {#if editing}
        <!-- svelte-ignore a11y_autofocus -->
        <input
          class="edit num"
          type="text"
          inputmode="decimal"
          bind:value={text}
          autofocus
          onblur={commit}
          onkeydown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') editing = false;
          }}
          aria-label={`${def.label} value`}
        />
      {:else}
        <button
          class="val"
          type="button"
          {disabled}
          onclick={() => {
            text = shown;
            editing = true;
          }}
          title="Type an exact value">{shown.replace('-', '−')}</button
        >
      {/if}
      <span class="unit">{def.unit}</span>
    </span>
  </div>
  <input
    {id}
    type="range"
    min={def.log ? 0 : def.min}
    max={def.log ? RES : def.max}
    step={def.log ? 1 : def.step}
    value={toPos(value)}
    {disabled}
    style={`--pct:${Math.max(0, Math.min(100, pct))}%`}
    oninput={(e) => (value = clamp(fromPos(+(e.currentTarget as HTMLInputElement).value)))}
  />
  {#if def.hint}<p class="hint">{def.hint}</p>{/if}
</div>

<style>
  .slider {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .disabled {
    opacity: 0.5;
  }
  .row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-2);
  }
  label {
    font-size: var(--text-sm);
    color: var(--text-2);
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .sym {
    font-style: italic;
    font-family: 'Times New Roman', Georgia, serif;
    font-size: 1.05em;
    color: var(--text);
  }
  .value {
    display: inline-flex;
    align-items: baseline;
    gap: 4px;
    font-size: var(--text-sm);
  }
  .val {
    border: 0;
    background: none;
    padding: 2px 4px;
    border-radius: 6px;
    font-weight: 600;
    color: var(--text);
    font-variant-numeric: tabular-nums;
  }
  .val:hover:not(:disabled) {
    background: var(--surface-2);
  }
  .edit {
    width: 6.5em;
    padding: 2px 6px;
    border-radius: 6px;
    border: 1px solid var(--accent);
    background: var(--surface);
    text-align: right;
    font-weight: 600;
  }
  .unit {
    color: var(--text-3);
    min-width: 1em;
  }
  .hint {
    font-size: var(--text-xs);
    color: var(--text-3);
  }
  input[type='range'] {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 28px;
    background: transparent;
    margin: 0;
    touch-action: pan-y;
  }
  input[type='range']::-webkit-slider-runnable-track {
    height: 4px;
    border-radius: 4px;
    background: linear-gradient(to right, var(--accent) var(--pct), var(--surface-3) var(--pct));
  }
  input[type='range']::-moz-range-track {
    height: 4px;
    border-radius: 4px;
    background: linear-gradient(to right, var(--accent) var(--pct), var(--surface-3) var(--pct));
  }
  input[type='range']::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 20px;
    height: 20px;
    margin-top: -8px;
    border-radius: 50%;
    background: var(--surface);
    border: 2px solid var(--accent);
    box-shadow: var(--shadow-1);
    transition: transform var(--dur-fast) var(--ease);
  }
  input[type='range']::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--surface);
    border: 2px solid var(--accent);
  }
  input[type='range']:active::-webkit-slider-thumb {
    transform: scale(1.15);
  }
  input[type='range']:focus-visible {
    box-shadow: none;
  }
  input[type='range']:focus-visible::-webkit-slider-thumb {
    box-shadow: var(--focus);
  }
</style>

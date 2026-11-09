<script lang="ts">
  import Badge from './Badge.svelte';
  let {
    label,
    checked = $bindable(),
    hint,
    hl = false,
    color,
  }: { label: string; checked: boolean; hint?: string; hl?: boolean; color?: string } = $props();
</script>

<label class="toggle">
  <span class="text">
    <span class="label">
      {#if color}<span class="dot" style={`background:${color}`}></span>{/if}
      {label}
      {#if hl}<Badge kind="hl" />{/if}
    </span>
    {#if hint}<span class="hint">{hint}</span>{/if}
  </span>
  <input type="checkbox" role="switch" bind:checked />
  <span class="track" aria-hidden="true"><span class="knob"></span></span>
</label>

<style>
  .toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    min-height: 36px;
    cursor: pointer;
    position: relative;
  }
  .text {
    display: flex;
    flex-direction: column;
  }
  .label {
    font-size: var(--text-sm);
    color: var(--text-2);
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
  .hint {
    font-size: var(--text-xs);
    color: var(--text-3);
  }
  input {
    position: absolute;
    opacity: 0;
    width: 1px;
    height: 1px;
  }
  .track {
    flex: none;
    width: 36px;
    height: 22px;
    border-radius: 11px;
    background: var(--surface-3);
    position: relative;
    transition: background var(--dur) var(--ease);
  }
  .knob {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--surface);
    box-shadow: var(--shadow-1);
    transition: transform var(--dur) var(--ease);
  }
  input:checked + .track {
    background: var(--accent);
  }
  input:checked + .track .knob {
    transform: translateX(14px);
  }
  input:focus-visible + .track {
    box-shadow: var(--focus);
  }
</style>

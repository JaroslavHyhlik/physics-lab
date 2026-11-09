<script lang="ts" generics="T extends string | number">
  let {
    options,
    value = $bindable(),
    label,
    small = false,
  }: { options: { value: T; label: string }[]; value: T; label?: string; small?: boolean } = $props();
</script>

<div class="wrap">
  {#if label}<span class="label">{label}</span>{/if}
  <div class="seg" class:small role="radiogroup" aria-label={label}>
    {#each options as o (o.value)}
      <button
        type="button"
        role="radio"
        aria-checked={value === o.value}
        class:on={value === o.value}
        onclick={() => (value = o.value)}>{o.label}</button
      >
    {/each}
  </div>
</div>

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .label {
    font-size: var(--text-sm);
    color: var(--text-2);
  }
  .seg {
    display: flex;
    padding: 3px;
    gap: 2px;
    background: var(--surface-2);
    border-radius: var(--radius-s);
    overflow-x: auto;
    scrollbar-width: none;
  }
  button {
    flex: 1 0 auto;
    border: 0;
    background: transparent;
    border-radius: 6px;
    padding: 6px 10px;
    font-size: var(--text-sm);
    color: var(--text-2);
    white-space: nowrap;
    transition:
      background var(--dur-fast) var(--ease),
      color var(--dur-fast) var(--ease);
  }
  .small button {
    padding: 4px 8px;
    font-size: var(--text-xs);
  }
  button:hover {
    color: var(--text);
  }
  button.on {
    background: var(--surface);
    color: var(--text);
    font-weight: 600;
    box-shadow: var(--shadow-1);
  }
</style>

<script lang="ts">
  import type { Component, Snippet } from 'svelte';
  let {
    icon: Icon,
    label,
    onclick,
    active = false,
    primary = false,
    size = 40,
    showLabel = false,
    disabled = false,
    children,
  }: {
    icon: Component<{ size?: number; strokeWidth?: number }>;
    label: string;
    onclick?: (e: MouseEvent) => void;
    active?: boolean;
    primary?: boolean;
    size?: number;
    showLabel?: boolean;
    disabled?: boolean;
    children?: Snippet;
  } = $props();
</script>

<button
  type="button"
  class="ib"
  class:active
  class:primary
  class:withLabel={showLabel}
  style={`--s:${size}px`}
  aria-label={label}
  aria-pressed={active ? 'true' : undefined}
  title={label}
  {disabled}
  {onclick}
>
  <Icon size={Math.round(size * 0.45)} strokeWidth={2} />
  {#if showLabel}<span>{label}</span>{/if}
  {@render children?.()}
</button>

<style>
  .ib {
    min-width: var(--s);
    height: var(--s);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border: 0;
    border-radius: calc(var(--s) / 2);
    background: transparent;
    color: var(--text-2);
    transition:
      background var(--dur-fast) var(--ease),
      color var(--dur-fast) var(--ease),
      transform var(--dur-fast) var(--ease);
    -webkit-tap-highlight-color: transparent;
  }
  .withLabel {
    padding: 0 14px 0 10px;
    font-size: var(--text-sm);
    font-weight: 550;
  }
  .ib:hover:not(:disabled) {
    background: var(--surface-2);
    color: var(--text);
  }
  .ib:active:not(:disabled) {
    transform: scale(0.94);
  }
  .active {
    background: var(--accent-soft);
    color: var(--accent);
  }
  .active:hover:not(:disabled) {
    background: var(--accent-soft);
    color: var(--accent);
  }
  .primary {
    background: var(--accent);
    color: var(--on-accent);
  }
  .primary:hover:not(:disabled) {
    background: var(--accent-hover);
    color: var(--on-accent);
  }
  .ib:disabled {
    opacity: 0.4;
    cursor: default;
  }
</style>

<script lang="ts">
  let { kind, text }: { kind: 'hl' | 'beyond' | 'code' | 'soon' | 'extra'; text?: string } = $props();
  const label = $derived(
    text ??
      (kind === 'hl'
        ? 'HL'
        : kind === 'beyond'
          ? 'Beyond syllabus'
          : kind === 'soon'
            ? 'Coming soon'
            : kind === 'extra'
              ? 'Extra'
              : ''),
  );
  const title = $derived(
    kind === 'hl'
      ? 'Additional higher level content'
      : kind === 'beyond'
        ? 'Not in the IB data booklet — included for deeper understanding'
        : undefined,
  );
</script>

<span class="badge {kind}" {title}>{label}</span>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    height: 20px;
    padding: 0 7px;
    border-radius: var(--radius-full);
    font-size: 11px;
    font-weight: 650;
    letter-spacing: 0.02em;
    white-space: nowrap;
    line-height: 1;
    font-style: normal;
  }
  .hl {
    color: var(--hl);
    background: var(--hl-soft);
  }
  .beyond {
    color: var(--beyond);
    background: var(--beyond-soft);
  }
  .code {
    color: var(--text-2);
    background: var(--surface-2);
    font-variant-numeric: tabular-nums;
  }
  .soon,
  .extra {
    color: var(--text-3);
    background: var(--surface-2);
    font-weight: 550;
  }
</style>

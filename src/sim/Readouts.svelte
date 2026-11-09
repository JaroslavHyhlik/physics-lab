<script lang="ts" module>
  export interface ReadoutRow {
    label: string;
    value: string;
    unit?: string;
    hl?: boolean;
    color?: string;
    strong?: boolean;
  }
</script>

<script lang="ts">
  import Badge from '../ui/Badge.svelte';
  let { rows, title }: { rows: ReadoutRow[]; title?: string } = $props();
</script>

<div class="ro">
  {#if title}<div class="t">{title}</div>{/if}
  <dl>
    {#each rows as r (r.label)}
      <div class="row" class:strong={r.strong}>
        <dt>
          {#if r.color}<span class="dot" style={`background:var(${r.color})`}></span>{/if}
          {r.label}
          {#if r.hl}<Badge kind="hl" />{/if}
        </dt>
        <dd class="num">{r.value}{#if r.unit}<span class="u">&nbsp;{r.unit}</span>{/if}</dd>
      </div>
    {/each}
  </dl>
</div>

<style>
  .ro {
    background: var(--glass);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border: 1px solid var(--border);
    border-radius: var(--radius-m);
    box-shadow: var(--shadow-1);
    padding: 8px 12px;
    font-size: var(--text-xs);
  }
  .t {
    font-weight: 700;
    color: var(--text-3);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-size: 10px;
    margin-bottom: 2px;
  }
  dl {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .row {
    display: flex;
    justify-content: space-between;
    gap: 14px;
    align-items: baseline;
  }
  dt {
    color: var(--text-2);
    display: inline-flex;
    align-items: center;
    gap: 5px;
    white-space: nowrap;
  }
  dd {
    margin: 0;
    font-weight: 650;
    color: var(--text);
    white-space: nowrap;
  }
  .strong dd {
    font-size: var(--text-sm);
  }
  .u {
    color: var(--text-3);
    font-weight: 500;
  }
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }
  @media (max-width: 899px) {
    .ro {
      padding: 6px 9px;
      font-size: 11px;
    }
  }
</style>

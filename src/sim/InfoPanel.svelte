<script lang="ts">
  import { TriangleAlert, Lightbulb } from '@lucide/svelte';
  import Formula from '../ui/Formula.svelte';
  import Badge from '../ui/Badge.svelte';
  import SubText from '../ui/SubText.svelte';
  import type { SimInfo } from './types';

  let { info }: { info: SimInfo } = $props();
</script>

<div class="info">
  <section>
    <h3>About</h3>
    {#each info.about as p, i (i)}<p><SubText text={p} /></p>{/each}
  </section>

  <section>
    <h3>Equations</h3>
    <ul class="formulas">
      {#each info.formulas as f, i (i)}
        <li>
          <div class="ftop">
            {#if f.label}<span class="flabel">{f.label}</span>{/if}
            {#if f.hl}<Badge kind="hl" />{/if}
            {#if f.beyond}<Badge kind="beyond" />{/if}
          </div>
          <Formula tex={f.tex} display />
        </li>
      {/each}
    </ul>
    <p class="note">Notation as in the IB Physics data booklet (first assessment 2025).</p>
  </section>

  <section class="assume">
    <h3><TriangleAlert size={15} /> Model assumptions</h3>
    <ul>
      {#each info.assumptions as a, i (i)}<li><SubText text={a} /></li>{/each}
    </ul>
  </section>

  {#if info.tryThis?.length}
    <section>
      <h3><Lightbulb size={15} /> Try this</h3>
      <ul>
        {#each info.tryThis as a, i (i)}<li><SubText text={a} /></li>{/each}
      </ul>
    </section>
  {/if}
</div>

<style>
  .info {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    font-size: var(--text-sm);
    color: var(--text-2);
  }
  section {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  h3 {
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-3);
    display: flex;
    align-items: center;
    gap: 6px;
  }
  p {
    line-height: 1.55;
  }
  ul {
    margin: 0;
    padding-left: 1.1em;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .formulas {
    list-style: none;
    padding: 0;
    gap: var(--space-2);
  }
  .formulas li {
    background: var(--surface-2);
    border-radius: var(--radius-m);
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .ftop {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .flabel {
    font-size: var(--text-xs);
    color: var(--text-3);
    font-weight: 550;
  }
  .note {
    font-size: var(--text-xs);
    color: var(--text-3);
  }
  .assume {
    background: var(--hl-soft);
    border-radius: var(--radius-m);
    padding: 12px 14px;
  }
  .assume h3 {
    color: var(--hl);
  }
  .assume ul {
    color: var(--text);
  }
</style>

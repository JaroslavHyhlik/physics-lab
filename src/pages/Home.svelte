<script lang="ts">
  import { Search, ArrowRight, Smartphone, SunMoon, Sun, Moon, X } from '@lucide/svelte';
  import { sims, subtopics, topics, isReady, type SimEntry } from '../app/registry';
  import { theme } from '../app/theme.svelte';
  import Badge from '../ui/Badge.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import Logo from '../ui/Logo.svelte';

  let query = $state('');
  let filter = $state<'all' | 'hl' | 'ready'>('all');

  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');

  const subTitle = (code: string) => subtopics.find((s) => s.code === code)?.title ?? '';

  function matches(e: SimEntry): boolean {
    if (filter === 'hl' && e.hl === 'none' && !subtopics.find((s) => s.code === e.code)?.hlOnly) return false;
    if (filter === 'ready' && !isReady(e)) return false;
    const q = norm(query.trim());
    if (!q) return true;
    const hay = norm([e.title, e.blurb, e.code, subTitle(e.code), ...(e.keywords ?? [])].join(' '));
    return q.split(/\s+/).every((tok) => hay.includes(tok));
  }

  const visible = $derived(sims.filter(matches));
  const readyCount = sims.filter(isReady).length;
</script>

<div class="home">
  <header class="top">
    <a href="#/" class="brand"><Logo size={28} /><span>Physics Lab</span></a>
    <IconButton
      icon={theme.choice === 'auto' ? SunMoon : theme.choice === 'light' ? Sun : Moon}
      label={`Theme: ${theme.choice}`}
      size={38}
      onclick={() => theme.cycle()}
    />
  </header>

  <section class="hero">
    <h1>Physics you can <span class="grad">play with</span>.</h1>
    <p class="sub">
      Interactive simulations for IB Physics HL — first assessment 2025, themes A–E. Accurate models, live
      graphs, real measuring tools and data export.
    </p>
    <div class="search">
      <Search size={18} />
      <input
        type="search"
        placeholder="Search simulations, topics or codes — “Snell”, “C.3”, “momentum”"
        bind:value={query}
        aria-label="Search simulations"
      />
      {#if query}<button class="clear" aria-label="Clear search" onclick={() => (query = '')}><X size={16} /></button
        >{/if}
    </div>
    <div class="filters" role="radiogroup" aria-label="Filter">
      {#each [{ v: 'all', l: 'All' }, { v: 'hl', l: 'HL content' }, { v: 'ready', l: 'Ready to use' }] as f (f.v)}
        <button
          type="button"
          role="radio"
          aria-checked={filter === f.v}
          class:on={filter === f.v}
          onclick={() => (filter = f.v as typeof filter)}>{f.l}</button
        >
      {/each}
      <span class="count num">{readyCount} of {sims.length} ready</span>
    </div>
  </section>

  <a class="lab" href="#/lab">
    <span class="labicon"><Smartphone size={22} /></span>
    <span class="labtext">
      <strong>Mobile Lab</strong>
      <span>Measure with your phone: accelerometer, gyroscope, tilt and compass, microphone, GPS and a tone generator — 13 experiments.</span>
    </span>
  </a>

  {#each topics as t (t.id)}
    {@const inTopic = visible.filter((e) => e.code[0] === t.id)}
    {#if inTopic.length}
      <section class="topic" style={`--tc: var(--topic-${t.id.toLowerCase()})`}>
        <h2><span class="letter">{t.id}</span>{t.title}</h2>
        {#each subtopics.filter((s) => s.code[0] === t.id) as st (st.code)}
          {@const items = inTopic.filter((e) => e.code === st.code)}
          {#if items.length}
            <div class="sub-head">
              <h3><span class="code num">{st.code}</span> {st.title}</h3>
              {#if st.hlOnly}<Badge kind="hl" text="HL only" />{/if}
            </div>
            <div class="grid">
              {#each items as e (e.id)}
                {#if isReady(e)}
                  <a class="card ready" href={`#/sim/${e.id}`}>
                    <div class="ctop">
                      {#if e.hl === 'full' && !st.hlOnly}<Badge kind="hl" />{/if}
                      {#if e.hl === 'part'}<Badge kind="hl" text="SL + HL" />{/if}
                      {#if e.extra}<Badge kind="extra" />{/if}
                    </div>
                    <h4>{e.title}</h4>
                    <p>{e.blurb}</p>
                    <span class="go">Open <ArrowRight size={15} /></span>
                  </a>
                {:else}
                  <div class="card soon" aria-disabled="true">
                    <div class="ctop">
                      {#if e.hl === 'full' && !st.hlOnly}<Badge kind="hl" />{/if}
                      {#if e.hl === 'part'}<Badge kind="hl" text="SL + HL" />{/if}
                      {#if e.extra}<Badge kind="extra" />{/if}
                      <Badge kind="soon" />
                    </div>
                    <h4>{e.title}</h4>
                    <p>{e.blurb}</p>
                  </div>
                {/if}
              {/each}
            </div>
          {/if}
        {/each}
      </section>
    {/if}
  {/each}

  {#if visible.length === 0}
    <p class="empty">No simulation matches “{query}”.</p>
  {/if}

  <footer>
    <p>Not affiliated with or endorsed by the International Baccalaureate Organization.</p>
    <p>Equations and constants follow the IB Physics data booklet (first assessment 2025).</p>
  </footer>
</div>

<style>
  .home {
    max-width: 1180px;
    margin: 0 auto;
    padding: 0 var(--space-4) var(--space-7);
    padding-left: max(var(--space-4), env(safe-area-inset-left));
    padding-right: max(var(--space-4), env(safe-area-inset-right));
  }
  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: calc(64px + env(safe-area-inset-top));
    padding-top: env(safe-area-inset-top);
  }
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    color: var(--text);
    font-weight: 700;
    font-size: var(--text-lg);
    letter-spacing: -0.02em;
  }
  .hero {
    padding: var(--space-6) 0 var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  h1 {
    font-size: clamp(2rem, 5.5vw, 3.4rem);
    font-weight: 750;
    letter-spacing: -0.035em;
    line-height: 1.05;
  }
  .grad {
    background: linear-gradient(100deg, var(--topic-a), var(--topic-d) 45%, var(--topic-e));
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .sub {
    color: var(--text-2);
    font-size: var(--text-lg);
    max-width: 640px;
  }
  .search {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    max-width: 640px;
    height: 52px;
    padding: 0 var(--space-4);
    background: var(--surface);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-full);
    box-shadow: var(--shadow-1);
    color: var(--text-3);
    transition: box-shadow var(--dur) var(--ease);
  }
  .search:focus-within {
    box-shadow: var(--focus);
    border-color: var(--accent);
  }
  .search input {
    flex: 1;
    min-width: 0;
    border: 0;
    outline: 0;
    background: transparent;
    font-size: var(--text-md);
    color: var(--text);
  }
  .search input:focus-visible {
    box-shadow: none;
  }
  .clear {
    border: 0;
    background: var(--surface-2);
    border-radius: 50%;
    width: 28px;
    height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--text-2);
  }
  .filters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }
  .filters button {
    border: 1px solid var(--border-strong);
    background: transparent;
    border-radius: var(--radius-full);
    padding: 6px 14px;
    font-size: var(--text-sm);
    font-weight: 550;
    color: var(--text-2);
    min-height: 36px;
  }
  .filters button.on {
    background: var(--text);
    color: var(--bg);
    border-color: var(--text);
  }
  .count {
    margin-left: auto;
    font-size: var(--text-sm);
    color: var(--text-3);
  }
  .lab {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-4) var(--space-5);
    border-radius: var(--radius-l);
    background:
      radial-gradient(120% 140% at 0% 0%, var(--accent-soft), transparent 60%),
      var(--surface);
    border: 1px solid var(--border);
    color: var(--text);
    margin-bottom: var(--space-5);
  }
  .labicon {
    flex: none;
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: var(--accent);
    color: var(--on-accent);
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .labtext {
    display: flex;
    flex-direction: column;
    flex: 1;
    gap: 2px;
  }
  .labtext span {
    color: var(--text-2);
    font-size: var(--text-sm);
  }
  .topic {
    padding-top: var(--space-6);
  }
  h2 {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    font-size: var(--text-xl);
    font-weight: 700;
    letter-spacing: -0.02em;
    margin-bottom: var(--space-2);
  }
  .letter {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: var(--tc);
    color: #fff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: var(--text-lg);
  }
  .sub-head {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: var(--space-5) 0 var(--space-3);
  }
  h3 {
    font-size: var(--text-md);
    font-weight: 650;
    color: var(--text);
  }
  .code {
    color: var(--tc);
    margin-right: 4px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: var(--space-3);
  }
  .card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: var(--space-4);
    border-radius: var(--radius-l);
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text);
    min-height: 140px;
    overflow: hidden;
    transition:
      transform var(--dur) var(--ease),
      box-shadow var(--dur) var(--ease),
      border-color var(--dur) var(--ease);
  }
  .card::before {
    content: '';
    position: absolute;
    inset: 0 0 auto 0;
    height: 3px;
    background: var(--tc);
    opacity: 0.85;
  }
  .card.ready:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-2);
    border-color: var(--border-strong);
  }
  .card.soon {
    opacity: 0.62;
  }
  .card.soon::before {
    opacity: 0.3;
  }
  .ctop {
    display: flex;
    gap: 6px;
    min-height: 20px;
    flex-wrap: wrap;
  }
  h4 {
    font-size: var(--text-md);
    font-weight: 650;
    letter-spacing: -0.01em;
  }
  .card p {
    font-size: var(--text-sm);
    color: var(--text-2);
    flex: 1;
  }
  .go {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: var(--text-sm);
    font-weight: 650;
    color: var(--accent);
  }
  .empty {
    color: var(--text-3);
    padding: var(--space-6) 0;
  }
  footer {
    margin-top: var(--space-7);
    padding-top: var(--space-5);
    border-top: 1px solid var(--border);
    color: var(--text-3);
    font-size: var(--text-xs);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
</style>

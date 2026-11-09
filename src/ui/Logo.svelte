<script lang="ts">
  let { size = 28 }: { size?: number } = $props();
</script>

<!-- Own mark: an orbit around a nucleus-like dot. -->
<svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
  <defs>
    <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="var(--topic-a)" />
      <stop offset="0.55" stop-color="var(--topic-d)" />
      <stop offset="1" stop-color="var(--topic-e)" />
    </linearGradient>
  </defs>
  <rect width="32" height="32" rx="9" fill="url(#lg)" />
  <ellipse cx="16" cy="16" rx="11" ry="5.2" fill="none" stroke="#fff" stroke-width="1.8" transform="rotate(-28 16 16)" opacity="0.95" />
  <circle cx="16" cy="16" r="3" fill="#fff" />
  <circle cx="25.2" cy="11" r="1.8" fill="#fff" />
</svg>

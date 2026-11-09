/** Theme state: 'auto' follows the OS; the resolved theme is what is actually shown. */
export type ThemeChoice = 'auto' | 'light' | 'dark';

const KEY = 'pl-theme';

function load(): ThemeChoice {
  try {
    const t = localStorage.getItem(KEY);
    if (t === 'light' || t === 'dark' || t === 'auto') return t;
  } catch {
    /* storage unavailable (private mode) */
  }
  return 'auto';
}

const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;

class ThemeState {
  choice = $state<ThemeChoice>(load());
  private systemDark = $state(media?.matches ?? false);
  /** Bumps whenever the visible colours change (canvas renderers re-read tokens). */
  version = $state(0);

  resolved = $derived<'light' | 'dark'>(
    this.choice === 'auto' ? (this.systemDark ? 'dark' : 'light') : this.choice,
  );

  constructor() {
    media?.addEventListener('change', (e) => {
      this.systemDark = e.matches;
      this.version++;
    });
    this.apply();
  }

  set(choice: ThemeChoice) {
    this.choice = choice;
    try {
      localStorage.setItem(KEY, choice);
    } catch {
      /* ignore */
    }
    this.apply();
  }

  cycle() {
    this.set(this.choice === 'auto' ? 'light' : this.choice === 'light' ? 'dark' : 'auto');
  }

  private apply() {
    if (typeof document !== 'undefined') document.documentElement.dataset.theme = this.choice;
    this.version++;
  }
}

export const theme = new ThemeState();

/** Read a CSS custom property (resolved for the current theme). */
export function cssVar(name: string, el: Element = document.documentElement): string {
  return getComputedStyle(el).getPropertyValue(name).trim();
}

/** Reactive media queries. */
class Media {
  mobile = $state(false);
  constructor() {
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia('(max-width: 899px)');
    this.mobile = mq.matches;
    mq.addEventListener('change', (e) => (this.mobile = e.matches));
  }
}
export const media = new Media();

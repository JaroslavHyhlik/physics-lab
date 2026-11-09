/** Number formatting for readouts (IB style: "1.23 × 10⁻⁵"). */

const SUP: Record<string, string> = {
  '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
};

export function superscript(s: string | number): string {
  return String(s)
    .split('')
    .map((ch) => SUP[ch] ?? ch)
    .join('');
}

/**
 * Format with `sig` significant figures. Uses scientific notation outside [1e-3, 1e5).
 * The minus sign is a true minus (U+2212).
 */
export function fmt(value: number, sig = 3): string {
  if (!Number.isFinite(value)) return value > 0 ? '∞' : value < 0 ? '−∞' : '—';
  if (value === 0) return '0';
  const abs = Math.abs(value);
  let s: string;
  if (abs >= 1e5 || abs < 1e-3) {
    const exp = Math.floor(Math.log10(abs));
    let mant = value / Math.pow(10, exp);
    let e = exp;
    let m = mant.toPrecision(sig);
    if (Math.abs(parseFloat(m)) >= 10) {
      e += 1;
      mant /= 10;
      m = mant.toPrecision(sig);
    }
    s = `${m} × 10${superscript(e)}`;
  } else {
    s = Number(value.toPrecision(sig)).toString();
    // keep trailing zeros that matter for significant figures (e.g. 2.50)
    const digits = s.replace('-', '').replace('.', '').replace(/^0+/, '').length;
    if (digits < sig && !s.includes('e')) s = value.toPrecision(sig);
  }
  return s.replace('-', '−');
}

/** Fixed number of decimals, with a true minus sign. */
export function fixed(value: number, decimals: number): string {
  if (!Number.isFinite(value)) return '—';
  const s = value.toFixed(decimals);
  return (s === `-${(0).toFixed(decimals)}` ? s.slice(1) : s).replace('-', '−');
}

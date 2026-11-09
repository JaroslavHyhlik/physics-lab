/**
 * CSV export. "en" = comma separator, decimal point (most software).
 * "cz" = semicolon separator, decimal comma (Czech-locale Excel opens it directly).
 */
export type CsvFormat = 'en' | 'cz';

export interface CsvColumn {
  label: string;
  unit: string;
  data: ArrayLike<number>;
}

function cell(v: number, format: CsvFormat): string {
  if (!Number.isFinite(v)) return '';
  // up to 10 significant figures, without float noise like 0.30000000000000004
  let s = Number(v.toPrecision(10)).toString();
  if (format === 'cz') s = s.replace('.', ',');
  return s;
}

function header(col: CsvColumn, sep: string): string {
  const text = col.unit ? `${col.label} (${col.unit})` : col.label;
  return text.includes(sep) || text.includes('"') ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(columns: CsvColumn[], format: CsvFormat = 'en'): string {
  const sep = format === 'cz' ? ';' : ',';
  const rows = columns.length ? Math.min(...columns.map((c) => c.data.length)) : 0;
  const lines: string[] = [columns.map((c) => header(c, sep)).join(sep)];
  for (let r = 0; r < rows; r++) lines.push(columns.map((c) => cell(c.data[r], format)).join(sep));
  return lines.join('\r\n') + '\r\n';
}

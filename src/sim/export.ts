import { toCsv, type CsvFormat } from '../core/csv';
import type { Recorder } from '../core/recorder';

/** Download all recorded channels as a CSV file. */
export function downloadCsv(recorder: Recorder, simId: string, format: CsvFormat): void {
  const columns = recorder.channels.map((c, i) => ({
    label: c.label,
    unit: c.unit,
    data: recorder.view(i),
  }));
  const csv = toCsv(columns, format);
  // BOM so Excel detects UTF-8 (units contain ⁻¹, ², Ω …)
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${simId}_${stamp}${format === 'cz' ? '_excel-cz' : ''}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

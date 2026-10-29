export function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
  }
  return String(value);
}

/** Okabe-Ito identity colour for a row (by rowid, so it never changes). */
export function rowColor(rid: number): string {
  return `var(--row-${(rid % 8) + 1})`;
}

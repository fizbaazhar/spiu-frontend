export const ERROR_STRINGS = new Set([
  "Incomplete",
  "N/A",
  "Invalid",
]);

export function isErrorValue(v: unknown): boolean {
  return typeof v === "string" && ERROR_STRINGS.has(v as string);
}

export function toPlottable(v: unknown): number | null {
  if (isErrorValue(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

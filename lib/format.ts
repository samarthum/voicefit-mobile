/**
 * Compact large-number formatting: 1400 -> "1.4k", 38000 -> "38k",
 * 1_400_000 -> "1.4M". Numbers below 1000 are returned with locale grouping.
 * One decimal of precision, trailing ".0" trimmed. Handles negatives & non-finite.
 */
export function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs < 1000) return sign + abs.toLocaleString();
  const units = [
    { v: 1_000_000_000, s: "B" },
    { v: 1_000_000, s: "M" },
    { v: 1_000, s: "k" },
  ];
  for (const u of units) {
    if (abs >= u.v) {
      const scaled = abs / u.v;
      // one decimal, but drop ".0"
      const str = scaled >= 100 ? Math.round(scaled).toString() : (Math.round(scaled * 10) / 10).toString();
      return sign + str + u.s;
    }
  }
  return sign + abs.toString();
}

/**
 * Nutrition display. Drafts keep full precision (scaling an ingredient gives
 * values like 45.333…); only presentation rounds. Grams and macros keep one
 * decimal below 10 so small amounts don't read as zero; calories are whole.
 */
export function formatNutrient(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "--";
  if (Math.abs(value) >= 10) return String(Math.round(value));
  return String(Math.round(value * 10) / 10);
}

export function formatKcal(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "--";
  return Math.round(value).toLocaleString();
}

/** "P 12g" style macro label; unknown nutrition reads as a dash, never 0. */
export function formatMacro(prefix: string, value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? `${prefix} —` : `${prefix} ${formatNutrient(value)}g`;
}

/** Plot only actual measurements, preserving gaps and calendar positions. */
export function buildSparklinePath(values: (number | null)[]): string {
  const measured = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (measured.length < 2) return "";
  const min = Math.min(...measured);
  const max = Math.max(...measured);
  let connected = false;
  return values.map((value, index) => {
    if (value == null || !Number.isFinite(value)) {
      connected = false;
      return "";
    }
    const x = 2 + index * 116 / Math.max(values.length - 1, 1);
    const y = max === min ? 9 : 16 - (value - min) * 14 / (max - min);
    const command = connected ? "L" : "M";
    connected = true;
    return `${command}${x.toFixed(2)} ${y.toFixed(2)}`;
  }).filter(Boolean).join(" ");
}

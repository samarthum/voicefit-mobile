/** One saving detent, with room for scaled/wrapped copy and the bottom safe area.
 * The saving body scrolls if an unusually small viewport cannot fit that room.
 */
export function getSavingSheetHeight({
  height,
  width,
  fontScale,
  topInset,
  bottomInset,
}: Readonly<{
  height: number;
  width: number;
  fontScale: number;
  topInset: number;
  bottomInset: number;
}>): number {
  const copyAllowance = 80 * Math.max(0, fontScale - 1) + (width < 360 ? 16 : 0);
  const desiredHeight = 220 + bottomInset + copyAllowance;
  return Math.min(desiredHeight, Math.max(1, height - topInset));
}

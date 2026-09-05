// Development-only timings. Never retain payloads, query strings, IDs, tokens,
// error messages, or response contents.
export type TimingRecord = {
  sequence: number;
  kind: "api" | "coach-first-text" | "coach-complete" | "screen-ready";
  route: string;
  method: string;
  outcome: "success" | "error" | "timeout" | "cancelled";
  durationMs: number;
  headersMs?: number;
  bodyMs?: number;
  status?: number;
};
const records: TimingRecord[] = [];
let sequence = 0;
const safeSegments = new Set([
  "api", "screens", "dashboard", "meals", "recent", "ingredients", "interpret", "entry",
  "workout-sessions", "workout-detail", "workout-sets", "batch", "daily-metrics", "conversation",
  "coach", "chat", "messages", "profile", "clear", "user", "settings", "goals",
  "transcribe", "exercises", "search", "top-meals", "trends", "stats",
]);
export function timingRoute(path: string) {
  try {
    return new URL(path, "http://local").pathname.split("/").map((part) =>
      !part || safeSegments.has(part) ? part : ":id",
    ).join("/");
  } catch { return "/unknown"; }
}
export const monotonicNow = () => globalThis.performance?.now() ?? Date.now();
export function recordTiming(record: Omit<TimingRecord, "sequence">) {
  if (typeof __DEV__ === "undefined" || !__DEV__) return;
  const entry: TimingRecord = {
    kind: record.kind,
    method: record.method,
    outcome: record.outcome,
    status: record.status,
    route: timingRoute(record.route),
    durationMs: Math.round(record.durationMs),
    headersMs: record.headersMs === undefined ? undefined : Math.round(record.headersMs),
    bodyMs: record.bodyMs === undefined ? undefined : Math.round(record.bodyMs),
    sequence: ++sequence,
  };
  records.push(entry);
  if (records.length > 200) records.shift();
  console.info("[VoiceFit timing]", JSON.stringify(entry));
}
export const getTimings = () => records.slice();

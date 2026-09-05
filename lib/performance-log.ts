// Opt-in, local-only diagnostic timings. Never retain payloads, query strings, IDs, tokens,
// error messages, or response contents.
export type TimingRecord = {
  sequence: number;
  kind: "api" | "coach-first-text" | "coach-complete" | "screen-ready" | "auth-ready" | "auth-token" | "startup-ready";
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
export const diagnosticsEnabled = () =>
  (typeof __DEV__ !== "undefined" && __DEV__) || process.env.EXPO_PUBLIC_DIAGNOSTICS === "1";
export const appTimingStarted = monotonicNow();
export async function measureToken<T>(route: string, getToken: () => Promise<T>): Promise<T> {
  const start = monotonicNow();
  try {
    const result = await getToken();
    recordTiming({ kind: "auth-token", route, method: "TOKEN", outcome: result ? "success" : "error", durationMs: monotonicNow() - start });
    return result;
  } catch (error) {
    recordTiming({ kind: "auth-token", route, method: "TOKEN", outcome: "error", durationMs: monotonicNow() - start });
    throw error;
  }
}
export function recordTiming(record: Omit<TimingRecord, "sequence">) {
  if (!diagnosticsEnabled()) return;
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
  if (typeof __DEV__ !== "undefined" && __DEV__) console.info("[VoiceFit timing]", JSON.stringify(entry));
}
export const getTimings = () => records.slice();

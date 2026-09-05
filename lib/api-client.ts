import { monotonicNow, recordTiming } from "@/lib/performance-log";
import type { ApiResponse } from "@voicefit/contracts/types";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL;

const normalizeUrl = (path: string) => {
  if (!API_BASE) {
    throw new Error("Missing EXPO_PUBLIC_API_BASE_URL");
  }
  if (path.startsWith("http")) return path;
  return `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
};

const buildHeaders = (
  body: RequestInit["body"],
  token?: string,
  headers?: HeadersInit
) => {
  const result = new Headers(headers);

  if (token) {
    result.set("Authorization", `Bearer ${token}`);
  }

  if (body instanceof FormData) {
    // Let fetch set multipart boundary automatically.
    result.delete("Content-Type");
  } else if (!result.has("Content-Type")) {
    result.set("Content-Type", "application/json");
  }

  return result;
};

async function parseApiResponse<T>(response: Response): Promise<T> {
  let json: ApiResponse<T>;
  try {
    json = (await response.json()) as ApiResponse<T>;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new Error(response.ok ? "Invalid response payload" : "Request failed");
  }

  if (!response.ok || !json.success) {
    throw new Error(json.error || "Request failed");
  }

  if (!("data" in json)) {
    throw new Error("No data returned from API");
  }

  return json.data as T;
}

const DEFAULT_TIMEOUT_MS = 15_000;

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { token?: string; timeoutMs?: number } = {}
): Promise<T> {
  const { token, headers, body, timeoutMs, signal, ...rest } = options;
  const started = monotonicNow();
  let receivedAt: number | undefined;
  let status: number | undefined;
  let outcome: "success" | "error" | "timeout" | "cancelled" = "error";
  const controller = new AbortController();
  let timedOut = false;
  const onAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener("abort", onAbort, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(normalizeUrl(path), {
      ...rest,
      body,
      headers: buildHeaders(body, token, headers),
      signal: controller.signal,
    });
    receivedAt = monotonicNow();
    status = response.status;
    const data = await parseApiResponse<T>(response);
    outcome = "success";
    return data;
  } catch (error) {
    outcome = signal?.aborted ? "cancelled" : timedOut ? "timeout" : "error";
    if (timedOut && !signal?.aborted) {
      throw new Error("Request timed out");
    }
    throw error;
  } finally {
    const finished = monotonicNow();
    recordTiming({
      kind: "api", route: path, method: (rest.method ?? "GET").toUpperCase(), outcome,
      durationMs: finished - started,
      headersMs: receivedAt === undefined ? undefined : receivedAt - started,
      bodyMs: receivedAt === undefined ? undefined : finished - receivedAt,
      status,
    });
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onAbort);
  }
}

export async function apiFormRequest<T>(
  path: string,
  formData: FormData,
  options: Omit<RequestInit, "body"> & { token?: string; timeoutMs?: number } = {}
): Promise<T> {
  return apiRequest<T>(path, {
    ...options,
    method: options.method ?? "POST",
    body: formData,
  });
}

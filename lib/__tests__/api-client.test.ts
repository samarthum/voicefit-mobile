import { test, expect } from "bun:test";

// No requests leave the process. Exercise fetch cancellation, including the
// response-body phase, rather than asserting the implementation's structure.
test("API preserves caller cancellation, distinguishes timeout, and covers body parsing", async () => {
  const oldBase = process.env.EXPO_PUBLIC_API_BASE_URL;
  process.env.EXPO_PUBLIC_API_BASE_URL = "https://example.invalid";
  const { apiRequest, apiFormRequest } = await import("../api-client");
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = ((_url: unknown, options: RequestInit) => new Promise((_resolve, reject) => {
      const abort = () => reject(new DOMException("Cancelled", "AbortError"));
      if (options.signal?.aborted) abort();
      else options.signal?.addEventListener("abort", abort, { once: true });
    })) as typeof fetch;
    const caller = new AbortController();
    const request = apiRequest("/test", { signal: caller.signal });
    caller.abort();
    const cancelled = await request.catch((error: Error) => error);
    expect((cancelled as Error).name).toBe("AbortError");
    const timedOut = await apiFormRequest("/test", new FormData(), { timeoutMs: 1 }).catch((error: Error) => error);
    expect((timedOut as Error).message).toBe("Request timed out");

    globalThis.fetch = (async (_url: unknown, options: RequestInit) => ({
      ok: true,
      json: () => new Promise((_resolve, reject) => {
        options.signal?.addEventListener("abort", () => reject(new DOMException("Cancelled", "AbortError")), { once: true });
      }),
    })) as typeof fetch;
    const bodyTimeout = await apiRequest("/test", { timeoutMs: 1 }).catch((error: Error) => error);
    expect((bodyTimeout as Error).message).toBe("Request timed out");
  } finally {
    globalThis.fetch = originalFetch;
    if (oldBase === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = oldBase;
  }
});

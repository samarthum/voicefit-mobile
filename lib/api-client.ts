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
  } catch {
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
  const { token, headers, body, timeoutMs, ...rest } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(normalizeUrl(path), {
      ...rest,
      body,
      headers: buildHeaders(body, token, headers),
      signal: controller.signal,
    });
    return parseApiResponse<T>(response);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function apiFormRequest<T>(
  path: string,
  formData: FormData,
  options: Omit<RequestInit, "body"> & { token?: string; timeoutMs?: number } = {}
): Promise<T> {
  const { token, headers, timeoutMs, ...rest } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(normalizeUrl(path), {
      ...rest,
      method: rest.method ?? "POST",
      body: formData,
      headers: buildHeaders(formData, token, headers),
      signal: controller.signal,
    });
    return parseApiResponse<T>(response);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

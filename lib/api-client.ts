import type { ApiResponse } from "@voicefit/contracts/types";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL;

if (!API_BASE) {
  throw new Error("Missing EXPO_PUBLIC_API_BASE_URL");
}

const normalizeUrl = (path: string) => {
  if (path.startsWith("http")) return path;
  return `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
};

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, headers, ...rest } = options;
  const response = await fetch(normalizeUrl(path), {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
  });

  const json = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !json.success) {
    const message = json.error || "Request failed";
    throw new Error(message);
  }

  if (!json.data) {
    throw new Error("No data returned from API");
  }

  return json.data;
}

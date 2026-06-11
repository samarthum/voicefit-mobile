import { useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";
import { apiRequest } from "@/lib/api-client";
import { isWebPreviewMode } from "@/lib/web-preview-mode";
import { shouldSyncSteps, type HealthStepsAccess } from "@/lib/health/shared";
import {
  checkHealthStepsAccess,
  getHealthStepsForDate,
  healthSourceName,
  requestHealthStepsPermission,
} from "@/lib/health/steps";

const AUTO_PROMPT_FLAG_KEY = "voicefit.health.steps.autoPrompted";
const HEALTH_STEPS_QUERY_KEY = "health-steps";
const HEALTH_ACCESS_QUERY_KEY = "health-access";

/**
 * Resolves whether we can read steps from the device health store,
 * auto-prompting for permission at most once per install so a user who
 * declined isn't nagged on every launch.
 */
async function ensureHealthStepsAccess(): Promise<boolean> {
  const access = await checkHealthStepsAccess();
  if (access === "unavailable") return false;
  if (access === "granted") return true;

  let alreadyPrompted = false;
  try {
    alreadyPrompted = (await SecureStore.getItemAsync(AUTO_PROMPT_FLAG_KEY)) === "1";
  } catch {
    // SecureStore failures fall through to prompting; worst case we re-ask.
  }
  if (alreadyPrompted) return false;
  try {
    await SecureStore.setItemAsync(AUTO_PROMPT_FLAG_KEY, "1");
  } catch {
    // Ignore; the prompt itself is still worth showing.
  }
  return requestHealthStepsPermission();
}

let ensureAccessPromise: Promise<boolean> | null = null;

function ensureAccessOnce(): Promise<boolean> {
  if (!ensureAccessPromise) {
    // Only a positive result is cached: access can be granted later from the
    // settings page (or the Health Connect app), so "no access" must be
    // re-checked on the next read. The auto-prompt flag keeps the re-check
    // from showing the permission UI again.
    ensureAccessPromise = ensureHealthStepsAccess()
      .then((granted) => {
        if (!granted) ensureAccessPromise = null;
        return granted;
      })
      .catch(() => {
        ensureAccessPromise = null;
        return false;
      });
  }
  return ensureAccessPromise;
}

/**
 * Reads the device step count (Apple Health / Health Connect) for a local
 * date key ("YYYY-MM-DD"). Returns null when the platform has no health
 * store or the user hasn't granted access. Refreshes whenever the app
 * returns to the foreground.
 */
export function useHealthSteps(date: string) {
  const enabled =
    (Platform.OS === "ios" || Platform.OS === "android") && !isWebPreviewMode();
  const queryClient = useQueryClient();

  const query = useQuery<number | null>({
    queryKey: [HEALTH_STEPS_QUERY_KEY, date],
    enabled,
    staleTime: 30_000,
    queryFn: async () => {
      const hasAccess = await ensureAccessOnce();
      if (!hasAccess) return null;
      return getHealthStepsForDate(date);
    },
  });

  useEffect(() => {
    if (!enabled) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void queryClient.invalidateQueries({ queryKey: [HEALTH_STEPS_QUERY_KEY] });
      }
    });
    return () => subscription.remove();
  }, [enabled, queryClient]);

  return {
    steps: query.data ?? null,
    isLoading: enabled && query.isLoading,
    sourceName: healthSourceName,
  };
}

/**
 * Exposes the current health-store access state plus a `connect` action for
 * the settings page, so users can set up (or retry) the integration whenever
 * they like — including after declining the one-time dashboard prompt.
 */
export function useHealthAccess() {
  const enabled =
    (Platform.OS === "ios" || Platform.OS === "android") && !isWebPreviewMode();
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);

  const query = useQuery<HealthStepsAccess>({
    queryKey: [HEALTH_ACCESS_QUERY_KEY],
    enabled,
    queryFn: checkHealthStepsAccess,
  });

  // Re-check when the app foregrounds: the user may have flipped the
  // permission in the Health app / Health Connect and switched back.
  useEffect(() => {
    if (!enabled) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void queryClient.invalidateQueries({ queryKey: [HEALTH_ACCESS_QUERY_KEY] });
      }
    });
    return () => subscription.remove();
  }, [enabled, queryClient]);

  const connect = async (): Promise<boolean> => {
    if (!enabled || isConnecting) return false;
    setIsConnecting(true);
    try {
      // The user is connecting explicitly, so the one-time dashboard
      // auto-prompt is no longer needed.
      try {
        await SecureStore.setItemAsync(AUTO_PROMPT_FLAG_KEY, "1");
      } catch {
        // Non-fatal; worst case the dashboard prompts once more.
      }
      const granted = await requestHealthStepsPermission();
      await queryClient.invalidateQueries({ queryKey: [HEALTH_ACCESS_QUERY_KEY] });
      await queryClient.invalidateQueries({ queryKey: [HEALTH_STEPS_QUERY_KEY] });
      return granted;
    } finally {
      setIsConnecting(false);
    }
  };

  return {
    access: enabled ? (query.data ?? null) : ("unavailable" as const),
    isConnecting,
    connect,
    sourceName: healthSourceName,
  };
}

/**
 * Pushes the device step count to the backend (POST /api/daily-metrics) when
 * it's ahead of the server value, so trends and the coach see the same data.
 * The dashboard query is invalidated afterwards to pick up the new value.
 */
export function useHealthStepsSync(
  date: string,
  deviceSteps: number | null,
  serverSteps: number | null | undefined,
  serverLoaded: boolean
) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const lastSyncedRef = useRef<string | null>(null);

  useEffect(() => {
    if (isWebPreviewMode()) return;
    if (!serverLoaded) return;
    if (!shouldSyncSteps(deviceSteps, serverSteps)) return;

    const syncKey = `${date}:${deviceSteps}`;
    if (lastSyncedRef.current === syncKey) return;
    lastSyncedRef.current = syncKey;

    void (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        await apiRequest("/api/daily-metrics", {
          method: "POST",
          token,
          body: JSON.stringify({ date, steps: deviceSteps }),
        });
        await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      } catch {
        // Allow a retry the next time the device count changes.
        lastSyncedRef.current = null;
      }
    })();
  }, [date, deviceSteps, serverSteps, serverLoaded, getToken, queryClient]);
}

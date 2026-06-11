import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";
import { apiRequest } from "@/lib/api-client";
import { isWebPreviewMode } from "@/lib/web-preview-mode";
import { shouldSyncSteps } from "@/lib/health/shared";
import {
  checkHealthStepsAccess,
  getHealthStepsForDate,
  healthSourceName,
  requestHealthStepsPermission,
} from "@/lib/health/steps";

const AUTO_PROMPT_FLAG_KEY = "voicefit.health.steps.autoPrompted";
const HEALTH_STEPS_QUERY_KEY = "health-steps";

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
    ensureAccessPromise = ensureHealthStepsAccess().catch(() => {
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

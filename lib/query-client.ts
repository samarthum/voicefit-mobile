import { QueryClient } from "@tanstack/react-query";
import type { Query } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import AsyncStorage from "@react-native-async-storage/async-storage";

// How long a persisted cache snapshot stays usable across cold starts.
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24h

const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      // gcTime must be >= the persister's maxAge. Otherwise queries are
      // garbage-collected (and pruned from the persisted snapshot) long before
      // it expires, which is exactly what made the dashboard go cold again
      // after the app had been backgrounded/evicted for ~30 min.
      gcTime: CACHE_MAX_AGE,
      refetchOnReconnect: true,
      retry: 1,
      // Rehydrated data is shown instantly, then refreshed in the background
      // once it's older than this — stale-while-revalidate across app launches.
      staleTime: 60 * 1000,
    },
  },
});

// Only these queries are worth persisting across cold starts. Excluded queries
// (coach chat history, health-store reads, screen-scoped lists) are either
// re-fetched cheaply from the server, re-read from the device, or grow the
// AsyncStorage blob so much that rehydration on Android dominates cold start.
const PERSIST_WHITELIST = [
  "dashboard",
  "meals",
  "workout-sessions",
  "workout-session-detail",
  "daily-metrics",
  "conversation",
  "top-meals",
] as const;

export const PERSIST_KEY = "voicefit-rq-cache";

export function userCacheKey(userId: string | null | undefined) {
  return `${PERSIST_KEY}:${userId ?? "signed-out"}`;
}

export async function clearPersistedUserCache(userId: string | null | undefined) {
  await AsyncStorage.removeItem(userCacheKey(userId));
}

// Each auth identity owns both a separate in-memory client and storage key.
// A late response from an expired session can only update that old client.
export function createUserQueryCache(userId: string | null | undefined) {
  return {
    queryClient: createQueryClient(),
    persistOptions: {
      persister: createAsyncStoragePersister({
        storage: AsyncStorage,
        key: userCacheKey(userId),
        throttleTime: 1000,
      }),
      maxAge: CACHE_MAX_AGE,
      buster: "v4",
      dehydrateOptions: {
        shouldDehydrateQuery: (query: Query) => {
          const key = query.queryKey[0];
          return !!userId && query.state.status === "success" && typeof key === "string" &&
            (PERSIST_WHITELIST as readonly string[]).includes(key);
        },
      },
    },
  };
}

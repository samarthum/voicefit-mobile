import { QueryClient } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import AsyncStorage from "@react-native-async-storage/async-storage";

// How long a persisted cache snapshot stays usable across cold starts.
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24h

export const queryClient = new QueryClient({
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

export const PERSIST_KEY = "voicefit-rq-cache";

// Persist the React Query cache to disk so a cold start (first sign-in of the
// day, or after the OS evicted the app) rehydrates the last-known dashboard
// data immediately instead of flashing an empty loading skeleton while it waits
// on a full auth + network round trip.
export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: PERSIST_KEY,
  throttleTime: 1000,
});

export const persistOptions = {
  persister: asyncStoragePersister,
  maxAge: CACHE_MAX_AGE,
  // Bump this to discard persisted caches when the cached shape changes
  // between releases.
  buster: "v1",
};

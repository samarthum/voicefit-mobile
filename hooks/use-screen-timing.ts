import { useCallback, useEffect, useRef } from "react";
import { useFocusEffect } from "expo-router";
import { diagnosticsEnabled, monotonicNow, recordTiming } from "@/lib/performance-log";

// Measures focus → data-ready in React, not native paint/animation completion.
export function useScreenTiming(screen: "dashboard" | "meals" | "workout-sessions" | "workout-detail" | "settings" | "coach", ready: boolean, failed = false) {
  const state = useRef({ ready, failed });
  state.current = { ready, failed };
  const started = useRef<number | null>(null);
  const finish = useCallback(() => {
    if (started.current === null || (!state.current.ready && !state.current.failed)) return;
    recordTiming({ kind: "screen-ready", route: `/screens/${screen}`, method: "FOCUS", outcome: state.current.failed ? "error" : "success", durationMs: monotonicNow() - started.current });
    started.current = null;
  }, [screen]);
  useFocusEffect(useCallback(() => {
    if (!diagnosticsEnabled()) return;
    started.current = monotonicNow();
    finish();
    return () => { started.current = null; };
  }, [finish]));
  useEffect(finish, [ready, failed, finish]);
}

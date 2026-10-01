import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { CommonActions, StackActions, StackRouter } from "@react-navigation/routers";

// Exercise the actual picker component/press handler, without booting Clerk or
// native views. Module-local shims avoid leaking bun mock.module into other tests.
// The navigation reducer is the installed React Navigation implementation:
// Expo Router 6 delegates REPLACE, POP_TO and GO_BACK to it unchanged.
// This Expo project supplies minimal test types rather than @types/node.
const { readFileSync } = require("node:fs") as { readFileSync(path: URL, encoding: "utf8"): string };
const { createRequire } = require("node:module") as { createRequire(path: URL): (name: string) => unknown };
const pickerPath = new URL("../../app/exercise-picker.tsx", import.meta.url);
const requireFromPicker = createRequire(pickerPath);
const pickerCode = ts.transpileModule(readFileSync(pickerPath, "utf8"), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

type Href = string | { pathname: string; params?: Record<string, string> };
function harness(sessionId: string | undefined = "synthetic-session", openSession = true) {
  const reducer = StackRouter({ initialRouteName: "(tabs)" });
  const options = {
    routeNames: ["(tabs)", "workout-session/[id]", "exercise-picker"],
    routeParamList: {},
    routeGetIdList: {},
  };
  let state = reducer.getInitialState(options);
  const dispatch = (action: Parameters<typeof reducer.getStateForAction>[1]) => {
    const next = reducer.getStateForAction(state, action, options);
    if (!next) throw new Error(`Unhandled navigation action: ${action.type}`);
    state = reducer.getRehydratedState(next, options);
  };
  const active = () => state.routes[state.index]!;
  const destination = (href: Href) => typeof href === "string"
    ? { name: "(tabs)", params: { screen: "workouts" } }
    : { name: href.pathname.replace(/^\//, ""), params: href.params };
  // Only the href-to-action boundary is adapted. These are Expo Router 6's
  // actual action types (global-state/routing.js); no stack operations are faked.
  const router = {
    replace(href: Href) {
      const { name, params } = destination(href);
      dispatch(StackActions.replace(name, params));
    },
    dismissTo(href: Href) {
      const { name, params } = destination(href);
      dispatch(StackActions.popTo(name, params));
    },
    back() { dispatch(CommonActions.goBack()); },
  };
  if (openSession) dispatch(StackActions.push("workout-session/[id]", { id: sessionId }));
  const sessionKey = active().key;
  const openPicker = () => dispatch(StackActions.push("exercise-picker", { sessionId }));
  openPicker();
  const presses = new Map<string, () => void>();
  const View = ({ children }: { children?: React.ReactNode }) => React.createElement("div", null, children);
  const exports: { default?: React.ComponentType } = {};
  const shims: Record<string, unknown> = {
    "react-native": {
      View, Text: View, ScrollView: View, TextInput: () => null,
      Pressable: ({ children, accessibilityLabel, onPress }: {
        children?: React.ReactNode; accessibilityLabel?: string; onPress: () => void;
      }) => {
        if (accessibilityLabel) presses.set(accessibilityLabel, onPress);
        return React.createElement(View, null, children);
      },
      StyleSheet: { create: (styles: unknown) => styles },
    },
    "expo-router": {
      useRouter: () => router,
      useLocalSearchParams: () => ({ sessionId }),
      Stack: { Screen: () => null },
    },
    "@/components/FloatingCommandBar": { FloatingCommandBar: () => null },
    "@/components/Icon": { Icon: () => null },
    "@/components/command-center": { useCommandCenter: () => ({ launcherProps: {} }) },
    "@/lib/haptics": { haptic: { tap() {} } },
  };
  new Function("require", "exports", pickerCode)((name: string) => {
    if (name in shims) return shims[name];
    return requireFromPicker(name.startsWith("@/") ? `../${name.slice(2)}` : name);
  }, exports);
  const renderPicker = () => renderToStaticMarkup(React.createElement(exports.default!));
  renderPicker();
  const add = (name: string) => {
    const press = presses.get(`Add ${name}`);
    if (!press) throw new Error(`Exercise not found: ${name}`);
    press();
  };
  return { active, add, openPicker, router, sessionKey, routes: () => state.routes };
}

describe("workout picker return navigation", () => {
  test("one Back after adding an exercise returns to the list, not an older workout", () => {
    const h = harness();
    h.add("Bench Press");
    h.router.back();
    expect(h.active().name).toBe("(tabs)");
  });

  test("repeated additions keep the original session instance and deliver each payload", () => {
    const h = harness();
    for (const name of ["Bench Press", "Squat", "Burpee"]) {
      h.add(name);
      expect(h.routes().map((route) => route.name)).toEqual(["(tabs)", "workout-session/[id]"]);
      // React Navigation keys identify mounted screens. Keeping the key keeps
      // the original session's local drafts instead of creating a second copy.
      expect(h.active().key).toBe(h.sessionKey);
      expect(h.active().params).toEqual({
        id: "synthetic-session",
        addExerciseName: name,
        addExerciseType: name === "Burpee" ? "cardio" : "resistance",
        addExerciseNonce: (h.active().params as Record<string, string>).addExerciseNonce,
      });
      expect(Number((h.active().params as Record<string, string>).addExerciseNonce) > 0).toBe(true);
      if (name !== "Burpee") h.openPicker();
    }
    h.router.back();
    expect(h.active().name).toBe("(tabs)");
  });

  test("cancelling the picker returns to the same session without an add payload", () => {
    const h = harness();
    h.router.back();
    expect(h.active().key).toBe(h.sessionKey);
    expect(h.active().params).toEqual({ id: "synthetic-session" });
    h.router.back();
    expect(h.active().name).toBe("(tabs)");
  });

  test("a picker deep link without a mounted session can still add an exercise", () => {
    const h = harness("synthetic-session", false);
    h.add("Squat");
    expect(h.routes().map((route) => route.name)).toEqual(["(tabs)", "workout-session/[id]"]);
    expect((h.active().params as Record<string, string>).id).toBe("synthetic-session");
    h.router.back();
    expect(h.active().name).toBe("(tabs)");
  });

  test("a picker without a session ID retains the workouts-list fallback", () => {
    const h = harness("", false);
    h.add("Squat");
    expect(h.active().name).toBe("(tabs)");
    expect(h.active().params).toEqual({ screen: "workouts" });
  });
});

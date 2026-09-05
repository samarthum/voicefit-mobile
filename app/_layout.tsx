import { appTimingStarted, measureToken, monotonicNow, recordTiming } from "@/lib/performance-log";
import "@/polyfills";
import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { focusManager } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createUserQueryCache } from "@/lib/query-client";
import * as SecureStore from "expo-secure-store";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { InterTight_300Light } from "@expo-google-fonts/inter-tight/300Light";
import { InterTight_400Regular } from "@expo-google-fonts/inter-tight/400Regular";
import { InterTight_500Medium } from "@expo-google-fonts/inter-tight/500Medium";
import { InterTight_600SemiBold } from "@expo-google-fonts/inter-tight/600SemiBold";
import { InterTight_700Bold } from "@expo-google-fonts/inter-tight/700Bold";
import { InterTight_800ExtraBold } from "@expo-google-fonts/inter-tight/800ExtraBold";
import { GeistMono_400Regular } from "@expo-google-fonts/geist-mono/400Regular";
import { GeistMono_500Medium } from "@expo-google-fonts/geist-mono/500Medium";
import { GeistMono_600SemiBold } from "@expo-google-fonts/geist-mono/600SemiBold";
import { CommandCenterProvider, CommandCenterOverlay } from "@/components/command-center";
import { TopLoadingBar } from "@/components/pulse";
import { color } from "@/lib/tokens";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

const tokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // Ignore write errors
    }
  },
};

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <View style={ebStyles.root}>
      <Text style={ebStyles.title}>Something went wrong</Text>
      <Text style={ebStyles.message}>{error.message}</Text>
      <Pressable style={ebStyles.button} onPress={retry}>
        <Text style={ebStyles.buttonText}>Try Again</Text>
      </Pressable>
    </View>
  );
}

const ebStyles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: color.bg },
  title: { fontSize: 20, fontWeight: "700", color: color.text, marginBottom: 8 },
  message: { fontSize: 14, color: color.textSoft, textAlign: "center", marginBottom: 20 },
  button: { backgroundColor: color.accent, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 },
  buttonText: { color: color.accentInk, fontSize: 16, fontWeight: "700" },
});

// Refreshes the session token (network round trip when expired) in the
// background at boot, in parallel with font loading and cache restore, so the
// first screen's queries don't wait on getToken() on their critical path.
function SessionTokenWarmUp() {
  const { isLoaded, isSignedIn, getToken } = useAuth();

  const recorded = useRef(false);
  useEffect(() => {
    if (isLoaded && !recorded.current) {
      recorded.current = true;
      recordTiming({ kind: "auth-ready", route: "/screens/dashboard", method: "STARTUP", outcome: "success", durationMs: monotonicNow() - appTimingStarted });
    }
    if (!isLoaded || !isSignedIn) return;
    void measureToken("/screens/dashboard", getToken).catch(() => undefined);
  }, [isLoaded, isSignedIn, getToken]);

  return null;
}

function UserQueryProvider({ userId, children }: { userId: string | null; children: ReactNode }) {
  const [{ queryClient, persistOptions }] = useState(() => createUserQueryCache(userId));
  useEffect(() => () => {
    void queryClient.cancelQueries();
    queryClient.clear();
  }, [queryClient]);
  return <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>{children}</PersistQueryClientProvider>;
}

function AuthQueryProvider({ children }: { children: ReactNode }) {
  const { isLoaded, userId } = useAuth();
  if (!isLoaded) return <View style={ebStyles.root}><ActivityIndicator color={color.accent} /></View>;
  return <UserQueryProvider key={userId ?? "signed-out"} userId={userId ?? null}>{children}</UserQueryProvider>;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    InterTight_300Light,
    InterTight_400Regular,
    InterTight_500Medium,
    InterTight_600SemiBold,
    InterTight_700Bold,
    InterTight_800ExtraBold,
    GeistMono_400Regular,
    GeistMono_500Medium,
    GeistMono_600SemiBold,
  });

  useEffect(() => {
    if (process.env.EXPO_OS === "web") return undefined;
    const subscription = AppState.addEventListener("change", (status) => {
      focusManager.setFocused(status === "active");
    });
    return () => subscription.remove();
  }, []);

  // Throwing here (render) instead of at module scope lets the route
  // ErrorBoundary above show a readable message; a module-scope throw
  // hard-crashes release builds on launch with no UI at all.
  if (!publishableKey) {
    throw new Error(
      "Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY — set it in the EAS project environment variables (and EXPO_PUBLIC_API_BASE_URL too) for this build profile."
    );
  }

  if (fontError) throw fontError;

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: color.bg }}>
        <ActivityIndicator color={color.accent} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
          <SessionTokenWarmUp />
          <AuthQueryProvider>
            <SafeAreaProvider>
              {/* CommandCenterProvider must sit ABOVE BottomSheetModalProvider:
                  gorhom renders sheet content through @gorhom/portal into a host
                  inside BottomSheetModalProvider, so anything the sheet consumes
                  (the command-center context) has to be provided higher up — or
                  the portaled content throws "must be used within
                  CommandCenterProvider". */}
              <CommandCenterProvider>
                <BottomSheetModalProvider>
                  {/* expo-status-bar (not RN StatusBar): under Android
                      edge-to-edge the RN `backgroundColor` is a no-op and the
                      system paints a dark scrim in dark mode. `style="dark"`
                      pins dark icons over a transparent bar so the app canvas
                      (color.bg) shows through and matches the in-app header. */}
                  <StatusBar style="dark" />
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      headerBackButtonDisplayMode: "minimal",
                      headerBackTitle: "Back",
                      contentStyle: { backgroundColor: color.bg },
                      // Screens that opt into native headers get a flat,
                      // canvas-colored bar (no Android elevation shadow).
                      headerShadowVisible: false,
                      headerStyle: { backgroundColor: color.bg },
                      headerTintColor: color.text,
                    }}
                  >
                    <Stack.Screen name="index" />
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen
                      name="meal-edit/[id]"
                      options={{ presentation: "fullScreenModal" }}
                    />
                    <Stack.Screen name="exercise-picker" options={{ presentation: "modal" }} />
                    <Stack.Screen name="workout-session/[id]" />
                    <Stack.Screen name="meals" />
                    <Stack.Screen name="trends" />
                    <Stack.Screen name="coach" />
                    <Stack.Screen name="feed" />
                    <Stack.Screen name="log" />
                    <Stack.Screen name="sign-in" />
                    <Stack.Screen name="sign-up-email" options={{ presentation: "modal" }} />
                    <Stack.Screen name="oauth-native-callback" />
                    <Stack.Screen name="+not-found" />
                  </Stack>
                  <CommandCenterOverlay />
                  {/* Global background-fetch indicator. Sits last so it paints
                      above every screen, and reads useIsFetching() app-wide. */}
                  <TopLoadingBar />
                </BottomSheetModalProvider>
              </CommandCenterProvider>
            </SafeAreaProvider>
          </AuthQueryProvider>
        </ClerkProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

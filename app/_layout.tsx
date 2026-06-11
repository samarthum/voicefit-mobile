import "@/polyfills";
import { ClerkProvider } from "@clerk/clerk-expo";
import { focusManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { useEffect } from "react";
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import {
  InterTight_300Light,
  InterTight_400Regular,
  InterTight_500Medium,
  InterTight_600SemiBold,
  InterTight_700Bold,
  InterTight_800ExtraBold,
} from "@expo-google-fonts/inter-tight";
import {
  GeistMono_400Regular,
  GeistMono_500Medium,
  GeistMono_600SemiBold,
} from "@expo-google-fonts/geist-mono";
import { CommandCenterProvider, CommandCenterOverlay } from "@/components/command-center";
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 30 * 60 * 1000,
      refetchOnReconnect: true,
      retry: 1,
      staleTime: 60 * 1000,
    },
  },
});

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

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
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
          <QueryClientProvider client={queryClient}>
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
                      options={{ presentation: "formSheet", sheetGrabberVisible: true, sheetAllowedDetents: [0.7, 1] }}
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
                </BottomSheetModalProvider>
              </CommandCenterProvider>
            </SafeAreaProvider>
          </QueryClientProvider>
        </ClerkProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

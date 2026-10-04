import { useEffect } from "react";
import { Redirect, router } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Wordmark } from "@/components/pulse";
import { color, font } from "@/lib/tokens";

// Clerk's useSSO redirects to voicefit://sso-callback. iOS consumes that inside
// the auth session, but Android hands it to the router as a deep link while
// sign-in finishes. Show a calm hand-off screen; once the session is active the
// signed-in tree remounts onto the dashboard.
const GIVE_UP_MS = 10_000;

export default function SSOCallbackScreen() {
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (isSignedIn) return;
    // Sign-in failed or was abandoned after the redirect: return to the
    // sign-in screen (which shows the error) instead of spinning forever.
    const timer = setTimeout(() => {
      if (router.canGoBack()) router.back();
      else router.replace("/sign-in");
    }, GIVE_UP_MS);
    return () => clearTimeout(timer);
  }, [isSignedIn]);

  if (isLoaded && isSignedIn) return <Redirect href="/(tabs)/dashboard" />;

  return (
    <View style={styles.root}>
      <Wordmark size={26} />
      <View style={styles.status}>
        <ActivityIndicator color={color.accent} />
        <Text style={styles.label}>Signing you in…</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", gap: 28, backgroundColor: color.bg },
  status: { flexDirection: "row", alignItems: "center", gap: 10 },
  label: { fontFamily: font.sans[500], fontSize: 14, color: color.textSoft },
});

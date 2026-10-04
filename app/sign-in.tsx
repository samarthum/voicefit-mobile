import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSSO } from "@clerk/clerk-expo";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path, Rect } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { color, font, radius } from "@/lib/tokens";
import { Wordmark } from "@/components/pulse";
import { haptic } from "@/lib/haptics";

// Sign in with Apple only exists on Apple platforms; App Review also requires
// its button to stay black/white, never the brand accent.
const SHOW_APPLE = process.env.EXPO_OS === "ios";

// Clerk's recommended Android pre-warm: the Custom Tab opens instantly instead
// of cold-starting Chrome after the tap.
WebBrowser.maybeCompleteAuthSession();
function useWarmUpBrowser() {
  useEffect(() => {
    if (process.env.EXPO_OS !== "android") return;
    void WebBrowser.warmUpAsync();
    return () => { void WebBrowser.coolDownAsync(); };
  }, []);
}

function HeroOrb() {
  const reducedMotion = useReducedMotion();
  const breath = useSharedValue(0);
  useEffect(() => {
    if (reducedMotion) return;
    breath.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [breath, reducedMotion]);
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.12 + breath.value * 0.1,
    transform: [{ scale: 0.92 + breath.value * 0.08 }],
  }));

  return (
    <View style={styles.heroOrb}>
      <Animated.View style={[styles.heroOrbGlow, glowStyle]} />
      <View style={styles.heroOrbCore}>
        <Svg width={32} height={40} viewBox="0 0 32 40" fill="none">
          <Rect x={10} y={1} width={12} height={20} rx={6} fill={color.accentInk} />
          <Path
            d="M4 18C4 25 9.5 30.5 16 30.5C22.5 30.5 28 25 28 18"
            stroke={color.accentInk}
            strokeWidth={2.4}
            strokeLinecap="round"
            fill="none"
          />
          <Path d="M16 30.5V38M10 38H22" stroke={color.accentInk} strokeWidth={2.4} strokeLinecap="round" />
        </Svg>
      </View>
    </View>
  );
}

function GoogleGlyph() {
  return (
    <Svg width={16} height={16} viewBox="0 0 20 20" fill="none">
      <Path d="M19.6 10.23c0-.68-.06-1.36-.17-2.01H10v3.8h5.38a4.6 4.6 0 01-2 3.02v2.5h3.24c1.89-1.74 2.98-4.3 2.98-7.31z" fill="#4285F4" />
      <Path d="M10 20c2.7 0 4.96-.9 6.62-2.42l-3.24-2.5c-.9.6-2.04.95-3.38.95-2.6 0-4.8-1.76-5.58-4.12H1.08v2.58A10 10 0 0010 20z" fill="#34A853" />
      <Path d="M4.42 11.91A6.01 6.01 0 014.1 10c0-.66.12-1.31.32-1.91V5.51H1.08A10 10 0 000 10c0 1.61.39 3.14 1.08 4.49l3.34-2.58z" fill="#FBBC05" />
      <Path d="M10 3.96c1.47 0 2.78.5 3.81 1.5l2.86-2.86C14.96 1 12.7 0 10 0A10 10 0 001.08 5.51l3.34 2.58C5.2 5.72 7.4 3.96 10 3.96z" fill="#EA4335" />
    </Svg>
  );
}

export default function SignInScreen() {
  useWarmUpBrowser();
  const { startSSOFlow } = useSSO();
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [isAppleSubmitting, setIsAppleSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsGoogleSubmitting(true);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: "oauth_google",
      });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        router.replace("/(tabs)/dashboard");
      } else {
        setError("Additional verification is required.");
      }
    } catch (err) {
      haptic.error();
      setError(err instanceof Error ? err.message : "Google sign in failed.");
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  const handleAppleSignIn = async () => {
    setError(null);
    setIsAppleSubmitting(true);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: "oauth_apple",
      });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        router.replace("/(tabs)/dashboard");
      } else {
        setError("Additional verification is required.");
      }
    } catch (err) {
      haptic.error();
      setError(err instanceof Error ? err.message : "Apple sign in failed.");
    } finally {
      setIsAppleSubmitting(false);
    }
  };

  const busy = isAppleSubmitting || isGoogleSubmitting;

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <View style={styles.wordmarkRow}>
        <Wordmark size={22} />
      </View>

      <View style={styles.heroArea}>
        <HeroOrb />
        <Text style={styles.heroTitle}>
          Your body. <Text style={styles.heroAccent}>In a sentence.</Text>
        </Text>
        <Text style={styles.heroSubtitle}>
          Log meals, lifts, and weight by voice. No dropdowns. A calm AI companion reads your week back to you.
        </Text>
      </View>

      <View style={styles.authArea}>
        {SHOW_APPLE ? (
          <Pressable
            style={({ pressed }) => [styles.appleButton, busy ? styles.disabled : null, pressed && styles.pressed]}
            onPress={() => { haptic.press(); void handleAppleSignIn(); }}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Continue with Apple"
          >
            {isAppleSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <View style={styles.buttonContent}>
                <Ionicons name="logo-apple" size={19} color="#FFFFFF" style={styles.appleLogo} />
                <Text style={styles.appleButtonText}>Continue with Apple</Text>
              </View>
            )}
          </Pressable>
        ) : null}

        <Pressable
          style={({ pressed }) => [styles.googleButton, !SHOW_APPLE && styles.googleButtonFirst, busy ? styles.disabled : null, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
          onPress={() => { haptic.press(); void handleGoogleSignIn(); }}
          disabled={busy}
        >
          {isGoogleSubmitting ? (
            <ActivityIndicator color={color.text} />
          ) : (
            <View style={styles.buttonContent}>
              <GoogleGlyph />
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </View>
          )}
        </Pressable>

        <Pressable
          style={styles.emailRow}
          onPress={() => router.push({ pathname: "/sign-up-email", params: { mode: "signin" } })}
        >
          <Text style={styles.emailRowText}>
            or <Text style={styles.emailRowAccent}>continue with email</Text>
          </Text>
        </Pressable>

        {error ? <Text style={styles.error} selectable>{error}</Text> : null}

        <Text style={styles.terms}>By continuing you agree to our Terms &amp; Privacy Policy.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.bg,
    paddingHorizontal: 28,
  },
  wordmarkRow: {
    paddingTop: 10,
  },
  heroArea: {
    flex: 1,
    justifyContent: "center",
    paddingBottom: 40,
  },
  heroOrb: {
    width: 140,
    height: 140,
    marginBottom: 30,
    position: "relative",
  },
  heroOrbGlow: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: radius.pill,
    backgroundColor: color.accent,
    opacity: 0.18,
  },
  heroOrbCore: {
    position: "absolute",
    top: 28,
    left: 28,
    width: 84,
    height: 84,
    borderRadius: radius.pill,
    backgroundColor: color.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    fontFamily: font.sans[600],
    fontSize: 44,
    fontWeight: "600",
    lineHeight: 46,
    letterSpacing: -1.32,
    color: color.text,
  },
  heroAccent: {
    color: color.accent,
  },
  heroSubtitle: {
    marginTop: 18,
    fontFamily: font.sans[400],
    fontSize: 15,
    lineHeight: 23,
    letterSpacing: -0.075,
    color: color.textSoft,
    maxWidth: 320,
  },
  authArea: {
    paddingBottom: 28,
  },
  appleButton: {
    height: 56,
    borderRadius: radius.sm,
    borderCurve: "continuous",
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
  },
  // Ionicons' apple glyph sits low in its em box; lift it onto the text's
  // optical center.
  appleLogo: { marginTop: -3 },
  appleButtonText: {
    fontFamily: font.sans[700],
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  googleButton: {
    marginTop: 10,
    height: 56,
    borderRadius: radius.sm,
    borderCurve: "continuous",
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
    alignItems: "center",
    justifyContent: "center",
  },
  googleButtonFirst: { marginTop: 0 },
  googleButtonText: {
    fontFamily: font.sans[600],
    color: color.text,
    fontSize: 15,
    fontWeight: "600",
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  emailRow: {
    marginTop: 18,
    alignItems: "center",
  },
  emailRowText: {
    fontFamily: font.sans[400],
    fontSize: 14,
    color: color.textSoft,
  },
  emailRowAccent: {
    fontFamily: font.sans[600],
    color: color.accent,
    fontWeight: "600",
  },
  disabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.99 }],
  },
  error: {
    marginTop: 16,
    textAlign: "center",
    fontFamily: font.sans[600],
    color: color.negative,
    fontSize: 13,
    fontWeight: "600",
  },
  terms: {
    marginTop: 16,
    textAlign: "center",
    fontFamily: font.sans[400],
    fontSize: 11,
    lineHeight: 17,
    color: color.textMute,
  },
});

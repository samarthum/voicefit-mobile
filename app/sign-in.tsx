import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSSO } from "@clerk/clerk-expo";
import { router } from "expo-router";
import Svg, { Path, Rect } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { color, font, radius } from "../lib/tokens";
import { Wordmark } from "../components/pulse";

function HeroOrb() {
  return (
    <View style={styles.heroOrb}>
      <View style={styles.heroOrbGlow} />
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

function AppleGlyph() {
  return (
    <Svg width={14} height={16} viewBox="0 0 14 16">
      <Path
        d="M11.5 8.5c0-2 1.5-3 1.5-3s-1-1.8-3.2-1.8c-1.5 0-2.5 1-3.3 1s-1.8-1-3-1c-1.6 0-3.5 1.3-3.5 4.3 0 3.5 2.5 7 4.3 7 .9 0 1.5-.6 2.4-.6s1.4.6 2.3.6c1.5 0 3-2.7 3.5-4.2 0 0-1-.3-1-3.3zM8 2.5c.6-.7.9-1.7.8-2.5-.8 0-1.8.5-2.3 1.2-.5.6-.9 1.5-.8 2.4.8.1 1.7-.5 2.3-1.1z"
        fill={color.accentInk}
      />
    </Svg>
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
      setError(err instanceof Error ? err.message : "Google sign in failed.");
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  const handleAppleSignIn = async () => {
    if (Platform.OS === "android" || Platform.OS === "web") {
      Alert.alert("Apple Sign In", "Apple sign in is only available on supported Apple platforms.");
      return;
    }

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
        <Pressable
          style={[styles.appleButton, busy ? styles.disabled : null]}
          onPress={() => void handleAppleSignIn()}
          disabled={busy}
        >
          {isAppleSubmitting ? (
            <ActivityIndicator color={color.accentInk} />
          ) : (
            <View style={styles.buttonContent}>
              <AppleGlyph />
              <Text style={styles.appleButtonText}>Continue with Apple</Text>
            </View>
          )}
        </Pressable>

        <Pressable
          style={[styles.googleButton, busy ? styles.disabled : null]}
          onPress={() => void handleGoogleSignIn()}
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

        {error ? <Text style={styles.error}>{error}</Text> : null}

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
    backgroundColor: color.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  appleButtonText: {
    fontFamily: font.sans[700],
    color: color.accentInk,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  googleButton: {
    marginTop: 10,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
    alignItems: "center",
    justifyContent: "center",
  },
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

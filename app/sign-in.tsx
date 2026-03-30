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

const COLORS = {
  bg: "#FFFFFF",
  surface: "#F8F8F8",
  border: "#E8E8E8",
  textPrimary: "#1A1A1A",
  textSecondary: "#8E8E93",
  textTertiary: "#AEAEB2",
};

function BrandMic() {
  return (
    <View style={styles.brandMic}>
      <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
        <Rect x={10} y={3} width={12} height={16} rx={6} stroke="#FFFFFF" strokeWidth={2.5} />
        <Path d="M6 15C6 20.523 10.477 25 16 25C21.523 25 26 20.523 26 15" stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" />
        <Path d="M16 25V29" stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

function AppleGlyph() {
  return (
    <Svg width={18} height={22} viewBox="0 0 20 24" fill="#FFFFFF">
      <Path d="M17.05 12.54c-.02-2.25 1.83-3.33 1.91-3.38-1.04-1.52-2.66-1.73-3.24-1.75-1.38-.14-2.69.81-3.39.81-.7 0-1.78-.79-2.93-.77-1.51.02-2.9.88-3.67 2.23-1.57 2.72-.4 6.75 1.13 8.96.75 1.08 1.64 2.3 2.81 2.26 1.13-.05 1.55-.73 2.91-.73 1.36 0 1.74.73 2.93.7 1.21-.02 1.98-1.1 2.72-2.19.86-1.25 1.21-2.47 1.23-2.53-.03-.01-2.36-.91-2.38-3.61zM14.83 5.54c.62-.76 1.04-1.81.93-2.86-.9.04-1.99.6-2.63 1.35-.58.67-1.09 1.74-.95 2.77.99.08 2.01-.51 2.65-1.26z" />
    </Svg>
  );
}

function GoogleGlyph() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path d="M19.6 10.23c0-.68-.06-1.36-.17-2.01H10v3.8h5.38a4.6 4.6 0 01-2 3.02v2.5h3.24c1.89-1.74 2.98-4.3 2.98-7.31z" fill="#4285F4" />
      <Path d="M10 20c2.7 0 4.96-.9 6.62-2.42l-3.24-2.5c-.9.6-2.04.95-3.38.95-2.6 0-4.8-1.76-5.58-4.12H1.08v2.58A10 10 0 0010 20z" fill="#34A853" />
      <Path d="M4.42 11.91A6.01 6.01 0 014.1 10c0-.66.12-1.31.32-1.91V5.51H1.08A10 10 0 000 10c0 1.61.39 3.14 1.08 4.49l3.34-2.58z" fill="#FBBC05" />
      <Path d="M10 3.96c1.47 0 2.78.5 3.81 1.5l2.86-2.86C14.96 1 12.7 0 10 0A10 10 0 001.08 5.51l3.34 2.58C5.2 5.72 7.4 3.96 10 3.96z" fill="#EA4335" />
    </Svg>
  );
}

function EmailGlyph() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Rect x={1.2} y={3.2} width={15.6} height={11.6} rx={2} stroke={COLORS.textSecondary} strokeWidth={1.8} />
      <Path d="M2.5 5L9 9.5L15.5 5" stroke={COLORS.textSecondary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
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

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.brandArea}>
        <BrandMic />
        <Text style={styles.brandName}>VoiceFit</Text>
        <Text style={styles.brandTagline}>Track with your voice</Text>
      </View>

      <View style={styles.authArea}>
        <Pressable
          style={[styles.appleButton, (isAppleSubmitting || isGoogleSubmitting) ? { opacity: 0.6 } : null]}
          onPress={() => void handleAppleSignIn()}
          disabled={isAppleSubmitting || isGoogleSubmitting}
        >
          {isAppleSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <View style={styles.buttonContent}>
              <AppleGlyph />
              <Text style={styles.appleButtonText}>Continue with Apple</Text>
            </View>
          )}
        </Pressable>

        <Pressable
          style={[styles.googleButton, (isAppleSubmitting || isGoogleSubmitting) ? { opacity: 0.6 } : null]}
          onPress={() => void handleGoogleSignIn()}
          disabled={isAppleSubmitting || isGoogleSubmitting}
        >
          {isGoogleSubmitting ? (
            <ActivityIndicator color={COLORS.textPrimary} />
          ) : (
            <View style={styles.buttonContent}>
              <GoogleGlyph />
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </View>
          )}
        </Pressable>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <Pressable
          style={styles.emailButton}
          onPress={() => router.push({ pathname: "/sign-up-email", params: { mode: "signin" } })}
        >
          <View style={styles.buttonContent}>
            <EmailGlyph />
            <Text style={styles.emailButtonText}>Continue with email</Text>
          </View>
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.terms}>
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  brandArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingBottom: 20,
  },
  brandMic: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: COLORS.textPrimary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    borderWidth: 6,
    borderColor: "rgba(26,26,26,0.06)",
  },
  brandName: {
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -1,
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  brandTagline: {
    fontSize: 17,
    color: COLORS.textSecondary,
  },
  authArea: {
    paddingHorizontal: 28,
    paddingBottom: 48,
  },
  appleButton: {
    height: 54,
    borderRadius: 14,
    backgroundColor: COLORS.textPrimary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  appleButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
  googleButton: {
    height: 54,
    borderRadius: 14,
    backgroundColor: COLORS.bg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  googleButtonText: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: "600",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    fontSize: 13,
    color: COLORS.textTertiary,
    textTransform: "lowercase",
  },
  emailButton: {
    height: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  emailButtonText: {
    color: COLORS.textSecondary,
    fontSize: 17,
    fontWeight: "600",
  },
  error: {
    marginTop: 16,
    textAlign: "center",
    color: "#B91C1C",
    fontSize: 13,
    fontWeight: "600",
  },
  terms: {
    marginTop: 24,
    textAlign: "center",
    fontSize: 12,
    lineHeight: 19,
    color: COLORS.textTertiary,
  },
  termsLink: {
    color: COLORS.textSecondary,
    textDecorationLine: "underline",
  },
});

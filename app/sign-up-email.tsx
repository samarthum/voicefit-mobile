import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSignIn, useSignUp } from "@clerk/clerk-expo";
import { useLocalSearchParams, useRouter } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";

import { color as token, font, radius as rad } from "../lib/tokens";

const COLORS = {
  bg: token.bg,
  surface: token.surface,
  surface2: token.surface2,
  border: token.line,
  textPrimary: token.text,
  textSecondary: token.textSoft,
  textTertiary: token.textMute,
  accent: token.accent,
  accentInk: token.accentInk,
};

function BackGlyph() {
  return (
    <Svg width={10} height={18} viewBox="0 0 10 18" fill="none">
      <Path d="M9 1L1 9L9 17" stroke={COLORS.textPrimary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function EyeGlyph({ secure }: { secure: boolean }) {
  if (secure) {
    return (
      <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
        <Path d="M1 10C1 10 4.5 3 10 3C15.5 3 19 10 19 10C19 10 15.5 17 10 17C4.5 17 1 10 1 10Z" stroke={COLORS.textTertiary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M10 13C11.6569 13 13 11.6569 13 10C13 8.34315 11.6569 7 10 7C8.34315 7 7 8.34315 7 10C7 11.6569 8.34315 13 10 13Z" stroke={COLORS.textTertiary} strokeWidth={1.8} />
      </Svg>
    );
  }

  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path d="M2 2L18 18" stroke={COLORS.textTertiary} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M7.3 7.6C6.8 8.2 6.5 9 6.5 10C6.5 11.93 8.07 13.5 10 13.5C10.96 13.5 11.83 13.11 12.47 12.47" stroke={COLORS.textTertiary} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M4.2 4.95C2.25 6.31 1 10 1 10C1 10 4.5 17 10 17C11.6 17 13.02 16.41 14.22 15.54" stroke={COLORS.textTertiary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M8.18 3.22C8.77 3.08 9.38 3 10 3C15.5 3 19 10 19 10C19 10 18.23 11.54 16.83 13.1" stroke={COLORS.textTertiary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function SignUpEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string | string[] }>();
  const modeParam = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const [mode, setMode] = useState<"signin" | "signup">(modeParam === "signin" ? "signin" : "signup");
  const { isLoaded: signInLoaded, signIn, setActive: setActiveSignIn } = useSignIn();
  const { isLoaded: signUpLoaded, signUp, setActive: setActiveSignUp } = useSignUp();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [secure, setSecure] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const content = useMemo(() => {
    if (mode === "signin") {
      return {
        title: "Sign in with email",
        subtitle: "Use your VoiceFit email and password to continue.",
        button: "Sign In",
        switchText: "Don't have an account?",
        switchLink: "Create one",
      };
    }
    return {
      title: "Create account",
      subtitle: "Start tracking your meals and workouts with just your voice.",
      button: "Create Account",
      switchText: "Already have an account?",
      switchLink: "Sign in",
    };
  }, [mode]);

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      if (mode === "signin") {
        if (!signInLoaded) return;
        const result = await signIn.create({
          identifier: email.trim(),
          password,
        });
        if (result.status === "complete" && result.createdSessionId) {
          await setActiveSignIn?.({ session: result.createdSessionId });
          router.replace("/(tabs)/dashboard");
        } else {
          setError("Additional verification is required.");
        }
      } else {
        if (!signUpLoaded) return;
        const [firstName = "", ...rest] = fullName.trim().split(/\s+/);
        const lastName = rest.join(" ");
        const result = await signUp.create({
          emailAddress: email.trim(),
          password,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
        });

        if (result.status === "complete" && result.createdSessionId) {
          await setActiveSignUp?.({ session: result.createdSessionId });
          router.replace("/(tabs)/dashboard");
        } else {
          setError("Email verification is required before the account can be used.");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.navHeader}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <BackGlyph />
        </Pressable>
      </View>

      <View style={styles.content}>
        <Text style={styles.pageTitle}>{content.title}</Text>
        <Text style={styles.pageSubtitle}>{content.subtitle}</Text>

        <View style={styles.authTabs}>
          <Pressable
            style={[styles.authTab, mode === "signin" ? styles.authTabActive : null]}
            onPress={() => setMode("signin")}
          >
            <Text style={[styles.authTabText, mode === "signin" ? styles.authTabTextActive : null]}>
              Sign In
            </Text>
          </Pressable>
          <Pressable
            style={[styles.authTab, mode === "signup" ? styles.authTabActive : null]}
            onPress={() => setMode("signup")}
          >
            <Text style={[styles.authTabText, mode === "signup" ? styles.authTabTextActive : null]}>
              Sign Up
            </Text>
          </Pressable>
        </View>

        {mode === "signup" ? (
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Full name</Text>
            <View style={styles.fieldWrap}>
              <TextInput
                style={styles.fieldInput}
                value={fullName}
                onChangeText={setFullName}
                placeholder="John Doe"
                placeholderTextColor={COLORS.textTertiary}
              />
            </View>
          </View>
        ) : null}

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Email</Text>
          <View style={styles.fieldWrap}>
            <TextInput
              style={styles.fieldInput}
              value={email}
              onChangeText={setEmail}
              placeholder="john@example.com"
              placeholderTextColor={COLORS.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Password</Text>
          <View style={styles.fieldWrap}>
            <TextInput
              style={styles.fieldInput}
              value={password}
              onChangeText={setPassword}
              placeholder={mode === "signup" ? "Create a password" : "Enter your password"}
              placeholderTextColor={COLORS.textTertiary}
              secureTextEntry={secure}
              autoCapitalize="none"
            />
            <Pressable style={styles.toggleButton} onPress={() => setSecure((prev) => !prev)}>
              <EyeGlyph secure={secure} />
            </Pressable>
          </View>
          {mode === "signup" ? (
            <Text style={styles.fieldHint}>Must be at least 8 characters</Text>
          ) : (
            <Pressable onPress={() => setError("Password reset is not implemented in this build yet.")}>
              <Text style={styles.forgotLink}>Forgot password?</Text>
            </Pressable>
          )}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={styles.submitButton} onPress={() => void handleSubmit()} disabled={isSubmitting}>
          {isSubmitting ? (
            <ActivityIndicator color={token.accentInk} />
          ) : (
            <Text style={styles.submitButtonText}>{content.button}</Text>
          )}
        </Pressable>
      </View>

      <View style={styles.bottomArea}>
        <Text style={styles.switchText}>
          {content.switchText}{" "}
          <Text
            style={styles.switchLink}
            onPress={() => setMode((prev) => (prev === "signin" ? "signup" : "signin"))}
          >
            {content.switchLink}
          </Text>
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: token.bg,
  },
  navHeader: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: rad.pill,
    backgroundColor: token.surface,
    borderWidth: 1,
    borderColor: token.line,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 24,
  },
  pageTitle: {
    fontFamily: font.sans[600],
    fontSize: 36,
    fontWeight: "600",
    letterSpacing: -1.08,
    color: token.text,
    marginBottom: 10,
  },
  pageSubtitle: {
    fontFamily: font.sans[400],
    fontSize: 15,
    lineHeight: 23,
    color: token.textSoft,
    marginBottom: 32,
    letterSpacing: -0.075,
  },
  authTabs: {
    flexDirection: "row",
    backgroundColor: token.surface,
    borderWidth: 1,
    borderColor: token.line,
    borderRadius: rad.sm,
    padding: 4,
    marginBottom: 28,
  },
  authTab: {
    flex: 1,
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 10,
  },
  authTabActive: {
    backgroundColor: token.accent,
  },
  authTabText: {
    fontFamily: font.sans[600],
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.26,
    color: token.textSoft,
  },
  authTabTextActive: {
    color: token.accentInk,
  },
  field: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontFamily: font.sans[600],
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 1.68,
    textTransform: "uppercase",
    color: token.textMute,
    marginBottom: 8,
  },
  fieldWrap: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    borderRadius: rad.sm,
    backgroundColor: token.surface,
    borderWidth: 1,
    borderColor: token.line,
    paddingHorizontal: 16,
  },
  fieldInput: {
    flex: 1,
    fontFamily: font.sans[400],
    fontSize: 15,
    color: token.text,
    letterSpacing: -0.075,
  },
  toggleButton: {
    paddingLeft: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  fieldHint: {
    marginTop: 6,
    fontFamily: font.sans[400],
    fontSize: 11,
    color: token.textMute,
  },
  forgotLink: {
    marginTop: 8,
    textAlign: "right",
    fontFamily: font.sans[600],
    fontSize: 13,
    fontWeight: "600",
    color: token.accent,
  },
  error: {
    fontFamily: font.sans[600],
    color: token.negative,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 12,
  },
  submitButton: {
    height: 56,
    borderRadius: rad.sm,
    backgroundColor: token.accent,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  submitButtonText: {
    fontFamily: font.sans[700],
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
    color: token.accentInk,
  },
  bottomArea: {
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 48,
    alignItems: "center",
  },
  switchText: {
    fontFamily: font.sans[400],
    fontSize: 14,
    color: token.textSoft,
  },
  switchLink: {
    fontFamily: font.sans[600],
    color: token.accent,
    fontWeight: "600",
  },
});

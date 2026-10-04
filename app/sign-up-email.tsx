import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSignIn, useSignUp } from "@clerk/clerk-expo";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import Svg, { Path } from "react-native-svg";

import { color as token, font, radius as rad } from "@/lib/tokens";
import { haptic } from "@/lib/haptics";
import { Icon } from "@/components/Icon";

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

function HeaderClose() {
  const router = useRouter();
    return (
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Close"
        style={{ paddingHorizontal: 4 }}
      >
        <Icon name="close" size={22} color={token.text} />
      </Pressable>
    );
  }


type CodeStrategy = "email_code" | "phone_code" | "totp";
type Step =
  | { kind: "form" }
  | {
      kind: "code";
      /** signin: Clerk second factor (incl. new-device "client trust" checks). */
      purpose: "signin" | "signup" | "reset";
      strategy: CodeStrategy;
      destination: string | null;
    };

const CODE_LENGTH = 6;

function clerkMessage(err: unknown, fallback: string) {
  const first = (err as { errors?: { longMessage?: string; message?: string }[] })?.errors?.[0];
  if (first) return first.longMessage ?? first.message ?? fallback;
  return err instanceof Error ? err.message : fallback;
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
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<Step>({ kind: "form" });
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");

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

  const finish = async (sessionId: string | null, via: "signin" | "signup") => {
    if (!sessionId) {
      setError("Sign-in couldn't be completed. Please try again.");
      return;
    }
    haptic.success();
    if (via === "signin") await setActiveSignIn?.({ session: sessionId });
    else await setActiveSignUp?.({ session: sessionId });
    router.replace("/(tabs)/dashboard");
  };

  // Clerk asks for a second factor on accounts with 2FA and, with client trust
  // enabled, on any password sign-in from a new device.
  const startSecondFactor = async (factors: NonNullable<typeof signIn>["supportedSecondFactors"]) => {
    if (!signIn) return;
    const factor =
      factors?.find((f) => f.strategy === "email_code") ??
      factors?.find((f) => f.strategy === "phone_code") ??
      factors?.find((f) => f.strategy === "totp");
    if (!factor) {
      setError("This account needs a verification method the app doesn't support yet.");
      return;
    }
    if (factor.strategy === "email_code") {
      await signIn.prepareSecondFactor({ strategy: "email_code", emailAddressId: factor.emailAddressId });
    } else if (factor.strategy === "phone_code") {
      await signIn.prepareSecondFactor({ strategy: "phone_code", phoneNumberId: factor.phoneNumberId });
    }
    setCode("");
    setStep({
      kind: "code",
      purpose: "signin",
      strategy: factor.strategy as CodeStrategy,
      destination: "safeIdentifier" in factor ? factor.safeIdentifier : null,
    });
  };

  const handleSubmit = async () => {
    haptic.press();
    setError(null);
    setNotice(null);
    setIsSubmitting(true);

    try {
      if (mode === "signin") {
        if (!signInLoaded) return;
        const result = await signIn.create({
          identifier: email.trim(),
          password,
        });
        if (result.status === "complete") {
          await finish(result.createdSessionId, "signin");
        } else if (result.status === "needs_second_factor") {
          await startSecondFactor(result.supportedSecondFactors);
        } else {
          setError("This account needs a sign-in method the app doesn't support yet.");
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

        if (result.status === "complete") {
          await finish(result.createdSessionId, "signup");
        } else if (result.unverifiedFields.includes("email_address")) {
          await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
          setCode("");
          setStep({ kind: "code", purpose: "signup", strategy: "email_code", destination: email.trim() });
        } else {
          setError("A few more details are needed to finish creating your account.");
        }
      }
    } catch (err) {
      haptic.error();
      setError(clerkMessage(err, "Authentication failed."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    setError(null);
    setNotice(null);
    if (!email.trim()) {
      setError("Enter your email above, then tap Forgot password.");
      return;
    }
    if (!signInLoaded) return;
    setIsSubmitting(true);
    try {
      await signIn.create({ strategy: "reset_password_email_code", identifier: email.trim() });
      setCode("");
      setNewPassword("");
      setStep({ kind: "code", purpose: "reset", strategy: "email_code", destination: email.trim() });
    } catch (err) {
      haptic.error();
      setError(clerkMessage(err, "Couldn't send a reset code."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifyCode = async (value: string) => {
    if (step.kind !== "code" || isSubmitting) return;
    if (step.purpose === "reset" && newPassword.length < 8) {
      setError("Choose a new password with at least 8 characters.");
      return;
    }
    setError(null);
    setNotice(null);
    setIsSubmitting(true);
    try {
      if (step.purpose === "signup") {
        const result = await signUp!.attemptEmailAddressVerification({ code: value });
        if (result.status === "complete") await finish(result.createdSessionId, "signup");
        else setError("That code didn't finish sign-up. Request a new one and try again.");
      } else if (step.purpose === "reset") {
        const result = await signIn!.attemptFirstFactor({
          strategy: "reset_password_email_code",
          code: value,
          password: newPassword,
        });
        if (result.status === "complete") await finish(result.createdSessionId, "signin");
        else if (result.status === "needs_second_factor") await startSecondFactor(result.supportedSecondFactors);
        else setError("Couldn't reset your password. Please try again.");
      } else {
        const result = await signIn!.attemptSecondFactor({ strategy: step.strategy, code: value });
        if (result.status === "complete") await finish(result.createdSessionId, "signin");
        else setError("That code didn't work. Please try again.");
      }
    } catch (err) {
      haptic.error();
      setCode("");
      setError(clerkMessage(err, "That code didn't work. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resendCode = async () => {
    if (step.kind !== "code" || step.strategy === "totp") return;
    setError(null);
    try {
      if (step.purpose === "signup") {
        await signUp!.prepareEmailAddressVerification({ strategy: "email_code" });
      } else if (step.purpose === "reset") {
        await signIn!.create({ strategy: "reset_password_email_code", identifier: email.trim() });
      } else {
        await startSecondFactor(signIn!.supportedSecondFactors);
      }
      haptic.tap();
      setNotice("New code sent.");
    } catch (err) {
      setError(clerkMessage(err, "Couldn't resend the code."));
    }
  };

  const onCodeChange = (text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, CODE_LENGTH);
    setCode(digits);
    if (digits.length === CODE_LENGTH && (step.kind !== "code" || step.purpose !== "reset")) {
      void verifyCode(digits);
    }
  };

  if (step.kind === "code") {
    const isReset = step.purpose === "reset";
    const title = step.strategy === "totp" ? "Enter your code" : isReset ? "Reset password" : "Check your inbox";
    const subtitle =
      step.strategy === "totp"
        ? "Open your authenticator app and enter the 6-digit code."
        : `We sent a 6-digit code to ${step.destination ?? "you"}.${step.purpose === "signin" ? " This keeps your account safe on a new device." : ""}`;
    return (
      <>
        <Stack.Screen options={{ title: "", headerLeft: HeaderClose }} />
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: token.bg }}>
          <ScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.content}>
              <View style={styles.codeIcon}>
                <Icon name={step.strategy === "email_code" ? "doc" : "info"} size={22} color={token.accent} />
              </View>
              <Text style={styles.pageTitle}>{title}</Text>
              <Text style={styles.pageSubtitle} selectable>{subtitle}</Text>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Verification code</Text>
                <View style={styles.fieldWrap}>
                  <TextInput
                    style={[styles.fieldInput, styles.codeInput]}
                    value={code}
                    onChangeText={onCodeChange}
                    placeholder="••••••"
                    placeholderTextColor={COLORS.textTertiary}
                    keyboardType="number-pad"
                    textContentType="oneTimeCode"
                    autoComplete="one-time-code"
                    maxLength={CODE_LENGTH}
                    autoFocus
                    accessibilityLabel="Verification code"
                  />
                </View>
              </View>

              {isReset ? (
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>New password</Text>
                  <View style={styles.fieldWrap}>
                    <TextInput
                      style={styles.fieldInput}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      placeholder="At least 8 characters"
                      placeholderTextColor={COLORS.textTertiary}
                      secureTextEntry
                      autoCapitalize="none"
                      textContentType="newPassword"
                    />
                  </View>
                </View>
              ) : null}

              {error ? <Text style={styles.error} selectable>{error}</Text> : null}
              {notice ? <Text style={styles.notice}>{notice}</Text> : null}

              <Pressable
                style={[styles.submitButton, (isSubmitting || code.length < CODE_LENGTH) && styles.submitButtonDisabled]}
                onPress={() => void verifyCode(code)}
                disabled={isSubmitting || code.length < CODE_LENGTH}
                accessibilityRole="button"
              >
                {isSubmitting ? (
                  <ActivityIndicator color={token.accentInk} />
                ) : (
                  <Text style={styles.submitButtonText}>{isReset ? "Reset & sign in" : "Verify"}</Text>
                )}
              </Pressable>

              <View style={styles.codeLinks}>
                {step.strategy !== "totp" ? (
                  <Pressable onPress={() => void resendCode()} hitSlop={8} accessibilityRole="button">
                    <Text style={styles.forgotLink}>Resend code</Text>
                  </Pressable>
                ) : <View />}
                <Pressable
                  onPress={() => { setStep({ kind: "form" }); setError(null); setNotice(null); }}
                  hitSlop={8}
                  accessibilityRole="button"
                >
                  <Text style={styles.codeBackLink}>Use a different email</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          // The page heading already says what this is; a second native title
          // just repeats it.
          title: "",
          headerLeft: HeaderClose,
        }}
      />
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: token.bg }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
        <Text style={styles.pageTitle}>{content.title}</Text>
        <Text style={styles.pageSubtitle}>{content.subtitle}</Text>

        <View style={styles.authTabs}>
          <Pressable
            style={[styles.authTab, mode === "signin" ? styles.authTabActive : null]}
            onPress={() => { setMode("signin"); setError(null); }}
          >
            <Text style={[styles.authTabText, mode === "signin" ? styles.authTabTextActive : null]}>
              Sign In
            </Text>
          </Pressable>
          <Pressable
            style={[styles.authTab, mode === "signup" ? styles.authTabActive : null]}
            onPress={() => { setMode("signup"); setError(null); }}
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
                textContentType="name"
                autoComplete="name"
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
              autoCorrect={false}
              textContentType={mode === "signup" ? "emailAddress" : "username"}
              autoComplete="email"
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
              textContentType={mode === "signup" ? "newPassword" : "password"}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              returnKeyType="go"
              onSubmitEditing={() => void handleSubmit()}
            />
            <Pressable
              style={styles.toggleButton}
              onPress={() => setSecure((prev) => !prev)}
              accessibilityRole="button"
              accessibilityLabel={secure ? "Show password" : "Hide password"}
            >
              <EyeGlyph secure={secure} />
            </Pressable>
          </View>
          {mode === "signup" ? (
            <Text style={styles.fieldHint}>Must be at least 8 characters</Text>
          ) : (
            <Pressable onPress={() => void handleForgotPassword()} disabled={isSubmitting} accessibilityRole="button">
              <Text style={styles.forgotLink}>Forgot password?</Text>
            </Pressable>
          )}
        </View>

        {error ? <Text style={styles.error} selectable>{error}</Text> : null}

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
                onPress={() => { setMode((prev) => (prev === "signin" ? "signup" : "signin")); setError(null); }}
              >
                {content.switchLink}
              </Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
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
    borderCurve: "continuous",
    padding: 4,
    marginBottom: 28,
  },
  authTab: {
    flex: 1,
    borderRadius: 10,
    borderCurve: "continuous",
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
    borderCurve: "continuous",
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
    borderCurve: "continuous",
    backgroundColor: token.accent,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontFamily: font.sans[700],
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
    color: token.accentInk,
  },
  notice: {
    fontFamily: font.sans[600],
    color: token.accent,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 12,
  },
  codeIcon: {
    width: 48,
    height: 48,
    borderRadius: rad.sm,
    borderCurve: "continuous",
    backgroundColor: token.accentTintBg,
    borderWidth: 1,
    borderColor: token.accentTintBorder,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  codeInput: {
    fontFamily: font.mono[500],
    fontSize: 22,
    letterSpacing: 8,
  },
  codeLinks: {
    marginTop: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  codeBackLink: {
    fontFamily: font.sans[500],
    fontSize: 13,
    color: token.textSoft,
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

import { useScreenTiming } from "@/hooks/use-screen-timing";
import { getCoachSession } from "@/lib/coach-session";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Modal, StyleSheet, View } from "react-native";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import Reanimated, { useAnimatedStyle } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { Chat, useChat } from "@ai-sdk/react";
import { TimedCoachTransport } from "@/lib/timed-chat-transport";
import { AssistantRuntimeProvider } from "@assistant-ui/react-native";
import { useAISDKRuntime } from "@assistant-ui/react-ai-sdk";
import type { CoachUIMessage } from "@voicefit/contracts/coach";
import { fetch as expoFetch } from "expo/fetch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";
import { CoachProfileForm } from "@/components/CoachProfileForm";
import {
  CoachComposer,
  CoachHeader,
  CoachMessageList,
  ErrorBubble,
} from "@/components/coach";
import { useCoachProfile } from "@/hooks/use-coach-profile";
import { color as token } from "@/lib/tokens";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? "";

const STARTER_PROMPTS = [
  "How am I doing this week?",
  "How is my squat progressing?",
  "Compare my last two Mondays",
  "Am I on track for my goal?",
];

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function CoachScreen() {
  const { getToken, userId, isSignedIn } = useAuth();
  const historyKey = ["coach-messages", userId] as const;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showMenu, setShowMenu] = useState(false);
  const {
    profile,
    showProfileModal,
    openProfileModal,
    closeProfileModal,
    dismissProfileModal,
    handleProfileSave,
    profileSaving,
    profileSaveError,
  } = useCoachProfile();

  // ---- useChat ----
  const session = useMemo(() => getCoachSession(queryClient, () => new Chat<CoachUIMessage>({
    transport: new TimedCoachTransport({
      fetch: expoFetch as unknown as typeof globalThis.fetch,
      api: `${API_BASE}/api/coach/chat`,
      headers: async (): Promise<Record<string, string>> => {
        const token = await getToken();
        if (token) return { Authorization: `Bearer ${token}` };
        return {};
      },
      body: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    }),
    onError: (err) => console.error("Coach chat error:", err),
    onFinish: ({ messages }) => { queryClient.setQueryData(["coach-messages", userId], messages); },
  })), [queryClient, userId, getToken]);
  const chat = useChat<CoachUIMessage>({ chat: session.chat });
  const [historyReady, setHistoryReady] = useState(session.hydrated);
  // ---- Initial messages from server ----
  const {
    data: serverMessages,
    isFetchedAfterMount,
    error: historyError,
    refetch: retryHistory,
  } = useQuery<CoachUIMessage[]>({
    queryKey: historyKey,
    enabled: !!isSignedIn && !historyReady,
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      const result = await apiRequest<{ messages: CoachUIMessage[] }>(
        "/api/coach/messages",
        { token }
      );
      return result.messages;
    },
    staleTime: 0,
    refetchOnMount: "always",
  });


  const { setMessages, error: chatError, regenerate } = chat;

  // assistant-ui runtime bridged from the useChat instance we keep owning
  // (preserves the custom transport, setMessages hydration, error/regenerate).
  const runtime = useAISDKRuntime(chat);

  // Wait for the current server history before enabling any send action.
  // Cached history alone may predate messages sent during the last visit.
  useEffect(() => {
    if (isFetchedAfterMount && !historyError && serverMessages && !historyReady) {
      setMessages(serverMessages);
      session.hydrated = true;
      setHistoryReady(true);
    }
  }, [isFetchedAfterMount, historyError, serverMessages, historyReady, setMessages, session]);

  useEffect(() => {
    if (historyReady) queryClient.setQueryData(["coach-messages", userId], chat.messages);
  }, [historyReady, chat.messages, queryClient, userId]);

  useScreenTiming("coach", historyReady, !!historyError);

  // ---- Clear conversation ----
  const clearMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      await apiRequest("/api/coach/clear", {
        method: "POST",
        token,
        body: JSON.stringify({}),
      });
    },
    onSuccess: () => {
      setMessages([]);
      queryClient.setQueryData(historyKey, []);
    },
  });

  // Keyboard avoidance is driven directly by the keyboard's animated height
  // instead of a KeyboardAvoidingView. KAV measures layout (onLayout) to size
  // its padding, but the composer's safe-area padding animates DURING the
  // keyboard transition and the multiline input grows while typing — each
  // re-measure made KAV re-adjust, which showed up as an end-of-animation
  // bump and per-keystroke bouncing. Padding straight off the keyboard frame
  // gives one source of truth, perfectly in sync with the composer's own
  // inset collapse (same animated value underneath).
  const { height: keyboardHeight } = useReanimatedKeyboardAnimation();
  const keyboardLift = useAnimatedStyle(() => ({
    // height runs 0 → -keyboardHeight as the keyboard opens
    paddingBottom: -keyboardHeight.value,
  }));

  const handleClear = useCallback(() => {
    if (!historyReady || clearMutation.isPending) return;
    if (chat.status === "streaming" || chat.status === "submitted") {
      Alert.alert("Coach is replying", "Wait for the reply to finish before clearing the conversation.");
      return;
    }
    Alert.alert(
      "Clear conversation",
      "This will delete the chat history. Your coach profile and saved facts are kept.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => clearMutation.mutate(),
        },
      ]
    );
  }, [clearMutation, historyReady, chat.status]);

  return (
    // Coach keeps its rich custom header (CoachHeader: sparkle orb + menu dropdown),
    // which the native Stack header can't replicate — so the native header stays off
    // (global default) and SafeAreaView covers the top inset. (NUI-5 / NUI-10)
    <AssistantRuntimeProvider runtime={runtime}>
      <SafeAreaView style={styles.root} edges={["top"]}>
        <Reanimated.View style={[styles.flex, keyboardLift]}>
          <CoachHeader
            showMenu={showMenu}
            onBackPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/dashboard")}
            onMenuPress={() => setShowMenu((visible) => !visible)}
            onDismissMenu={() => setShowMenu(false)}
            onEditProfilePress={openProfileModal}
            onClearConversationPress={handleClear}
          />

          <CoachMessageList
            loadingHistory={!historyReady}
            starterPrompts={STARTER_PROMPTS}
          />

          {historyError && !historyReady ? (
            <ErrorBubble message="Couldn't load your conversation." onRetry={() => void retryHistory()} />
          ) : null}
          {clearMutation.error ? (
            <ErrorBubble message="Couldn't clear your conversation." onRetry={handleClear} />
          ) : null}
          {chatError != null ? (
            <ErrorBubble
              message={chatError.message || "Something went wrong."}
              onRetry={regenerate}
            />
          ) : null}

          <View>
            {historyReady && !clearMutation.isPending ? <CoachComposer /> : null}
          </View>

          <Modal
            visible={showProfileModal}
            animationType="slide"
            presentationStyle="formSheet"
            onRequestClose={closeProfileModal}
          >
            <CoachProfileForm
              initialData={profile}
              onSave={handleProfileSave}
              onSkip={dismissProfileModal}
              isSaving={profileSaving}
              errorMessage={profileSaveError?.message}
            />
          </Modal>
        </Reanimated.View>
      </SafeAreaView>
    </AssistantRuntimeProvider>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: token.bg,
  },
  flex: {
    flex: 1,
  },
});

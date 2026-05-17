import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { CoachUIMessage } from "@voicefit/contracts/coach";
import { fetch as expoFetch } from "expo/fetch";
import type { LegendListRef } from "@legendapp/list";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../lib/api-client";
import { CoachProfileForm } from "../../components/CoachProfileForm";
import {
  CoachComposer,
  CoachHeader,
  CoachMessageList,
  ErrorBubble,
} from "../../components/coach";
import { useCoachProfile } from "../../hooks/use-coach-profile";
import { useCoachVoiceInput } from "../../hooks/use-coach-voice-input";
import { color as token } from "../../lib/tokens";

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
  const { getToken } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [historyHydrated, setHistoryHydrated] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const listRef = useRef<LegendListRef>(null);
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
  const handleTranscript = useCallback((transcript: string) => {
    setDraft(transcript);
  }, []);
  const focusComposer = useCallback(() => {
    inputRef.current?.focus();
  }, []);
  const {
    isRecordingMic,
    isTranscribing,
    handleMicPress,
  } = useCoachVoiceInput({
    onTranscript: handleTranscript,
    onTranscriptFocus: focusComposer,
  });

  // Re-pin the list to the latest message when the keyboard comes up.
  // LegendList's `maintainScrollAtEnd` only triggers on data updates, not on
  // viewport changes — so without this the user lands mid-thread when they
  // tap the composer.
  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const sub = Keyboard.addListener(showEvent, () => {
      listRef.current?.scrollToEnd({ animated: true });
    });
    return () => sub.remove();
  }, []);

  // Android `behavior="height"` shrinks the view by the keyboard's reported
  // height but doesn't account for the bottom tab bar, so the last message
  // ends up behind the keyboard. `padding` with the status-bar offset is
  // reliable on both platforms.
  const kbOffset = Platform.OS === "ios" ? 0 : (StatusBar.currentHeight ?? 0);

  // ---- Initial messages from server ----
  const {
    data: serverMessages,
    isLoading: loadingHistory,
  } = useQuery<CoachUIMessage[]>({
    queryKey: ["coach-messages"],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      const result = await apiRequest<{ messages: CoachUIMessage[] }>(
        "/api/coach/messages",
        { token }
      );
      return result.messages;
    },
    staleTime: Infinity,
  });

  // ---- useChat ----
  const {
    messages,
    sendMessage,
    setMessages,
    status,
    error: chatError,
    regenerate,
  } = useChat<CoachUIMessage>({
    transport: new DefaultChatTransport<CoachUIMessage>({
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
  });

  // Hydrate useChat from server-persisted messages once loaded
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (serverMessages != null && !hydratedRef.current) {
      hydratedRef.current = true;
      setMessages(serverMessages);
      setHistoryHydrated(true);
    }
  }, [serverMessages, setMessages]);

  const isStreaming = status === "streaming" || status === "submitted";

  // `setMessages(serverMessages)` updates useChat before LegendList has
  // measured the hydrated rows. `initialScrollIndex` handles the remount, and
  // this fallback catches late markdown/tool layout on physical devices.
  const didAutoScrollHistoryRef = useRef(false);
  useEffect(() => {
    if (
      !historyHydrated ||
      didAutoScrollHistoryRef.current ||
      messages.length === 0
    ) {
      return;
    }

    didAutoScrollHistoryRef.current = true;
    const timeout = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: false });
    }, 80);

    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: false });
    });

    return () => clearTimeout(timeout);
  }, [historyHydrated, messages.length]);

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
      queryClient.setQueryData(["coach-messages"], []);
    },
  });

  const handleClear = useCallback(() => {
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
  }, [clearMutation]);

  // ---- Send ----
  const handleSend = useCallback(() => {
    const text = draft.trim();
    if (!text || isStreaming) return;
    Keyboard.dismiss();
    sendMessage({ text });
    setDraft("");
  }, [draft, isStreaming, sendMessage]);

  const handleStarterPress = useCallback(
    (text: string) => {
      if (isStreaming) return;
      Keyboard.dismiss();
      sendMessage({ text });
    },
    [isStreaming, sendMessage]
  );

  // ---- Render ----
  const canSend = draft.trim().length > 0 && !isStreaming;

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
        keyboardVerticalOffset={kbOffset}
      >
        <CoachHeader
          showMenu={showMenu}
          onBackPress={() => router.back()}
          onMenuPress={() => setShowMenu((visible) => !visible)}
          onDismissMenu={() => setShowMenu(false)}
          onEditProfilePress={openProfileModal}
          onClearConversationPress={handleClear}
        />

        <CoachMessageList
          ref={listRef}
          messages={messages}
          loadingHistory={loadingHistory}
          historyHydrated={historyHydrated}
          starterPrompts={STARTER_PROMPTS}
          onStarterPress={handleStarterPress}
        />

        {chatError != null ? (
          <ErrorBubble
            message={chatError.message || "Something went wrong."}
            onRetry={regenerate}
          />
        ) : null}

        <CoachComposer
          ref={inputRef}
          value={draft}
          canSend={canSend}
          isStreaming={isStreaming}
          isRecordingMic={isRecordingMic}
          isTranscribing={isTranscribing}
          onChangeText={setDraft}
          onMicPress={handleMicPress}
          onSendPress={handleSend}
        />

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
      </KeyboardAvoidingView>
    </SafeAreaView>
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

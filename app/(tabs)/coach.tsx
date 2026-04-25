import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Audio } from "expo-av";
import { useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart, getToolName } from "ai";
import type { UIMessage } from "ai";
import { fetch as expoFetch } from "expo/fetch";
import { LegendList } from "@legendapp/list";
import Markdown from "react-native-markdown-display";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Svg, { Path } from "react-native-svg";
import { apiRequest, apiFormRequest } from "../../lib/api-client";
import {
  CoachProfileForm,
  type CoachProfileData,
} from "../../components/CoachProfileForm";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? "";

import { color as token, font, radius as rad } from "../../lib/tokens";

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
  error: token.negative,
};

const STARTER_PROMPTS = [
  "How am I doing this week?",
  "How is my squat progressing?",
  "Compare my last two Mondays",
  "Am I on track for my goal?",
];

// ---------------------------------------------------------------------------
// Glyphs
// ---------------------------------------------------------------------------

function MicGlyph({ color = COLORS.textSecondary }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3.5C10.067 3.5 8.5 5.067 8.5 7V12C8.5 13.933 10.067 15.5 12 15.5C13.933 15.5 15.5 13.933 15.5 12V7C15.5 5.067 13.933 3.5 12 3.5Z"
        stroke={color}
        strokeWidth={2}
      />
      <Path
        d="M5.5 11.5C5.5 15.09 8.41 18 12 18C15.59 18 18.5 15.09 18.5 11.5"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path
        d="M12 18V21"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function SendGlyph({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3.5 20L20 12L3.5 4L6.2 10.4L13 12L6.2 13.6L3.5 20Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function SparkleGlyph() {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2L14.2 8.2L20.4 10.4L14.2 12.6L12 18.8L9.8 12.6L3.6 10.4L9.8 8.2L12 2Z"
        fill={COLORS.accent}
      />
    </Svg>
  );
}

function SparkleInkGlyph() {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
      <Path
        d="M7 1L8.2 5.3L12.5 6.5L8.2 7.7L7 12L5.8 7.7L1.5 6.5L5.8 5.3L7 1Z"
        fill={COLORS.accentInk}
      />
    </Svg>
  );
}

function BackChevronGlyph() {
  return (
    <Svg width={10} height={16} viewBox="0 0 10 16" fill="none">
      <Path
        d="M9 1L1 8L9 15"
        stroke={COLORS.textPrimary}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CheckGlyph() {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 13L9 17L19 7"
        stroke={token.positive}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function MoreGlyph() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 13C12.5523 13 13 12.5523 13 12C13 11.4477 12.5523 11 12 11C11.4477 11 11 11.4477 11 12C11 12.5523 11.4477 13 12 13Z"
        fill={COLORS.textPrimary}
        stroke={COLORS.textPrimary}
        strokeWidth={2}
      />
      <Path
        d="M19 13C19.5523 13 20 12.5523 20 12C20 11.4477 19.5523 11 19 11C18.4477 11 18 11.4477 18 12C18 12.5523 18.4477 13 19 13Z"
        fill={COLORS.textPrimary}
        stroke={COLORS.textPrimary}
        strokeWidth={2}
      />
      <Path
        d="M5 13C5.55228 13 6 12.5523 6 12C6 11.4477 5.55228 11 5 11C4.44772 11 4 11.4477 4 12C4 12.5523 4.44772 13 5 13Z"
        fill={COLORS.textPrimary}
        stroke={COLORS.textPrimary}
        strokeWidth={2}
      />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Markdown styles
// ---------------------------------------------------------------------------

const markdownStyles = {
  body: {
    fontFamily: font.sans[400],
    fontSize: 14.5,
    lineHeight: 22,
    color: token.text,
    letterSpacing: -0.07,
  },
  strong: {
    fontFamily: font.sans[600],
    fontWeight: "600" as const,
    color: token.text,
  },
  bullet_list_icon: { fontSize: 14, color: token.text },
  heading2: {
    fontFamily: font.sans[600],
    fontSize: 17,
    fontWeight: "600" as const,
    marginTop: 8,
    color: token.text,
  },
  heading3: {
    fontFamily: font.sans[600],
    fontSize: 16,
    fontWeight: "600" as const,
    marginTop: 6,
    color: token.text,
  },
  paragraph: { marginTop: 0, marginBottom: 8 },
};

// ---------------------------------------------------------------------------
// Tool Activity Line
// ---------------------------------------------------------------------------

function ToolActivityLine({
  label,
  state,
}: {
  label: string;
  state: string;
}) {
  const isRunning =
    state === "input-streaming" || state === "input-available";
  const isDone = state === "output-available";

  return (
    <View style={toolStyles.row}>
      {isDone ? (
        <CheckGlyph />
      ) : isRunning ? (
        <ActivityIndicator size="small" color={COLORS.accent} />
      ) : (
        <ActivityIndicator size="small" color={COLORS.textTertiary} />
      )}
      <Text
        style={[
          toolStyles.label,
          isDone ? toolStyles.labelDone : null,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const toolStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 3,
  },
  label: {
    fontFamily: font.sans[500],
    fontSize: 12.5,
    color: token.textSoft,
    fontWeight: "500",
    flex: 1,
  },
  labelDone: { color: token.textMute },
});

// ---------------------------------------------------------------------------
// Memoized Bubble Components
// ---------------------------------------------------------------------------

type UserBubbleProps = { text: string };
const UserBubble = memo(function UserBubble({ text }: UserBubbleProps) {
  return (
    <View style={bubbleStyles.userGroup}>
      <View style={bubbleStyles.userBubble}>
        <Text style={bubbleStyles.userText}>{text}</Text>
      </View>
    </View>
  );
});

type AssistantBubbleProps = {
  messageId: string;
  parts: UIMessage["parts"];
};
const AssistantBubble = memo(function AssistantBubble({
  messageId,
  parts,
}: AssistantBubbleProps) {
  // Separate tool parts and text parts
  const toolParts: Array<{ key: string; label: string; state: string }> = [];
  const textParts: Array<{ key: string; text: string }> = [];

  parts.forEach((part, i) => {
    if (part.type === "text") {
      if (part.text.trim()) {
        textParts.push({ key: `${messageId}-t-${i}`, text: part.text });
      }
    } else if (isToolUIPart(part)) {
      const label =
        (part.state === "input-available" || part.state === "output-available")
          ? (part.input as Record<string, unknown>)?.label as string | undefined
          : undefined;
      const name = getToolName(part);
      toolParts.push({
        key: `${messageId}-tool-${i}`,
        label: label ?? name.replace(/_/g, " "),
        state: part.state,
      });
    }
  });

  const hasContent = toolParts.length > 0 || textParts.length > 0;

  return (
    <View style={bubbleStyles.assistantGroup}>
      <View style={bubbleStyles.metaRow}>
        <SparkleGlyph />
        <Text style={bubbleStyles.coachLabel}>Coach</Text>
      </View>
      {hasContent ? (
        <View style={bubbleStyles.assistantBubble}>
          {toolParts.length > 0 ? (
            <View style={bubbleStyles.toolSection}>
              {toolParts.map((tp) => (
                <ToolActivityLine
                  key={tp.key}
                  label={tp.label}
                  state={tp.state}
                />
              ))}
            </View>
          ) : null}
          {textParts.map((tp) => (
            <Markdown key={tp.key} style={markdownStyles}>
              {tp.text}
            </Markdown>
          ))}
        </View>
      ) : (
        <View style={bubbleStyles.assistantBubble}>
          <ActivityIndicator
            size="small"
            color={COLORS.accent}
            style={{ alignSelf: "flex-start" }}
          />
        </View>
      )}
    </View>
  );
});

const bubbleStyles = StyleSheet.create({
  userGroup: { alignItems: "flex-end" },
  userBubble: {
    maxWidth: "85%",
    backgroundColor: token.accent,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 4,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  userText: {
    fontFamily: font.sans[500],
    fontSize: 14.5,
    lineHeight: 22,
    color: token.accentInk,
    fontWeight: "500",
    letterSpacing: -0.07,
  },
  assistantGroup: {},
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  coachLabel: {
    fontFamily: font.sans[600],
    fontSize: 10.5,
    fontWeight: "600",
    color: token.accent,
    textTransform: "uppercase",
    letterSpacing: 1.47,
  },
  assistantBubble: {
    maxWidth: "92%",
    backgroundColor: token.surface,
    borderWidth: 1,
    borderColor: token.line,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  toolSection: {
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: token.line,
  },
});

// ---------------------------------------------------------------------------
// Error Bubble
// ---------------------------------------------------------------------------

function ErrorBubble({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View style={errorStyles.container}>
      <Text style={errorStyles.text}>{message}</Text>
      {onRetry != null ? (
        <Pressable style={errorStyles.retry} onPress={onRetry}>
          <Text style={errorStyles.retryText}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const errorStyles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: token.surface,
    borderWidth: 1,
    borderColor: token.negative,
  },
  text: {
    fontFamily: font.sans[400],
    fontSize: 13.5,
    lineHeight: 20,
    color: token.negative,
  },
  retry: { marginTop: 8, alignSelf: "flex-start" },
  retryText: {
    fontFamily: font.sans[600],
    fontSize: 13,
    fontWeight: "600",
    color: token.accent,
  },
});

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function CoachScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [isRecordingMic, setIsRecordingMic] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const inputRef = useRef<TextInput>(null);

  // ---- Initial messages from server ----
  const {
    data: serverMessages,
    isLoading: loadingHistory,
  } = useQuery<UIMessage[]>({
    queryKey: ["coach-messages"],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      const result = await apiRequest<{ messages: UIMessage[] }>(
        "/api/coach/messages",
        { token }
      );
      return result.messages;
    },
    staleTime: Infinity,
  });

  // ---- Profile check (first-visit modal) ----
  const {
    data: profile,
    isLoading: loadingProfile,
  } = useQuery<CoachProfileData | null>({
    queryKey: ["coach-profile"],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      return apiRequest<CoachProfileData | null>("/api/coach/profile", {
        token,
      });
    },
  });

  // Show first-visit modal when profile comes back null (not loading, not undefined)
  const profileChecked = !loadingProfile && profile !== undefined;
  const needsProfile = profileChecked && profile === null;

  useEffect(() => {
    if (needsProfile && !showProfileModal) {
      setShowProfileModal(true);
    }
  }, [needsProfile, showProfileModal]);

  // ---- useChat ----
  const {
    messages,
    sendMessage,
    setMessages,
    status,
    error: chatError,
    regenerate,
  } = useChat({
    transport: new DefaultChatTransport({
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
    if (serverMessages && serverMessages.length > 0 && !hydratedRef.current) {
      hydratedRef.current = true;
      setMessages(serverMessages);
    }
  }, [serverMessages, setMessages]);

  const isStreaming = status === "streaming" || status === "submitted";

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

  // ---- Profile save ----
  const handleProfileSave = useCallback(
    async (data: CoachProfileData) => {
      setProfileSaving(true);
      try {
        const token = await getToken();
        if (!token) throw new Error("Not signed in");
        const updated = await apiRequest<CoachProfileData>(
          "/api/coach/profile",
          {
            method: "PUT",
            token,
            body: JSON.stringify(data),
          }
        );
        queryClient.setQueryData(["coach-profile"], updated);
        setShowProfileModal(false);
      } finally {
        setProfileSaving(false);
      }
    },
    [getToken, queryClient]
  );

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

  // ---- Mic: record → transcribe → fill input ----
  const handleMicPress = useCallback(async () => {
    if (isTranscribing) return;

    // If already recording, stop and transcribe
    if (isRecordingMic && recordingRef.current) {
      const activeRecording = recordingRef.current;
      recordingRef.current = null;
      setIsRecordingMic(false);
      setIsTranscribing(true);

      try {
        activeRecording.setOnRecordingStatusUpdate(null);
        await activeRecording.stopAndUnloadAsync();
        const status = await activeRecording.getStatusAsync();
        const uri = activeRecording.getURI();

        if (!uri || (status.durationMillis ?? 0) < 500) {
          setIsTranscribing(false);
          return; // too short, silently ignore
        }

        const token = await getToken();
        if (!token) throw new Error("Not signed in");

        const formData = new FormData();
        formData.append("audio", {
          uri,
          name: `coach-${Date.now()}.m4a`,
          type: "audio/m4a",
        } as unknown as Blob);

        const { transcript } = await apiFormRequest<{ transcript: string }>(
          "/api/transcribe",
          formData,
          { token }
        );

        const cleaned = transcript.trim();
        if (cleaned) {
          setDraft(cleaned);
          inputRef.current?.focus();
        }
      } catch (err) {
        console.error("Transcription error:", err);
      } finally {
        setIsTranscribing(false);
      }
      return;
    }

    // Start recording
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Microphone", "Microphone permission is required to use voice input.");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const nextRecording = new Audio.Recording();
      await nextRecording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await nextRecording.startAsync();
      recordingRef.current = nextRecording;
      setIsRecordingMic(true);
    } catch (err) {
      console.error("Recording error:", err);
      setIsRecordingMic(false);
    }
  }, [isRecordingMic, isTranscribing, getToken]);

  // ---- Render items ----
  const renderItem = useCallback(
    ({ item }: { item: UIMessage }) => {
      if (item.role === "user") {
        const text =
          item.parts
            .filter((p): p is { type: "text"; text: string } => p.type === "text")
            .map((p) => p.text)
            .join("\n") || "";
        return <UserBubble text={text} />;
      }
      return <AssistantBubble messageId={item.id} parts={item.parts} />;
    },
    []
  );

  const keyExtractor = useCallback((item: UIMessage) => item.id, []);

  // ---- Empty state ----
  const ListEmpty = useCallback(() => {
    if (loadingHistory) {
      return (
        <View style={styles.emptyCenter}>
          <ActivityIndicator color={COLORS.accent} />
        </View>
      );
    }
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>
          Ask me anything about your training, food, or progress.
        </Text>
        <Text style={styles.emptyBody}>
          I can look at your meals, workouts, steps, and weight to give you
          personalized insights.
        </Text>
        <View style={styles.starterGrid}>
          {STARTER_PROMPTS.map((prompt) => (
            <Pressable
              key={prompt}
              style={styles.starterChip}
              onPress={() => handleStarterPress(prompt)}
            >
              <Text style={styles.starterChipText}>{prompt}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }, [loadingHistory, handleStarterPress]);

  // ---- Render ----
  const canSend = draft.trim().length > 0 && !isStreaming;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.headerCircleButton}
          hitSlop={8}
          onPress={() => router.back()}
        >
          <BackChevronGlyph />
        </Pressable>
        <View style={styles.headerCenter}>
          <View style={styles.headerSparkleOrb}>
            <SparkleInkGlyph />
          </View>
          <View>
            <Text style={styles.headerTitle}>Coach</Text>
            <View style={styles.headerStatusRow}>
              <View style={styles.headerStatusDot} />
              <Text style={styles.headerStatusText}>Online</Text>
            </View>
          </View>
        </View>
        <View>
          <Pressable
            style={styles.headerCircleButton}
            hitSlop={8}
            onPress={() => setShowMenu((v) => !v)}
          >
            <MoreGlyph />
          </Pressable>
          {showMenu ? (
            <View style={styles.menuDropdown}>
              <Pressable
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  setShowProfileModal(true);
                }}
              >
                <Text style={styles.menuItemText}>Edit profile</Text>
              </Pressable>
              <View style={styles.menuDivider} />
              <Pressable
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  handleClear();
                }}
              >
                <Text style={[styles.menuItemText, styles.menuItemDestructive]}>
                  Clear conversation
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>

      {/* Menu backdrop */}
      {showMenu ? (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setShowMenu(false)}
        />
      ) : null}

      {/* Message List */}
      <LegendList
        data={messages}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        estimatedItemSize={120}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={ListSeparator}
        ListEmptyComponent={ListEmpty}
        maintainScrollAtEnd
      />

      {/* Error */}
      {chatError != null ? (
        <ErrorBubble
          message={chatError.message || "Something went wrong."}
          onRetry={regenerate}
        />
      ) : null}

      {/* Composer */}
      <View style={styles.composer}>
        <View style={styles.composerRow}>
          <TextInput
            ref={inputRef}
            style={styles.composerInput}
            value={draft}
            onChangeText={setDraft}
            placeholder="Ask your coach..."
            placeholderTextColor={COLORS.textTertiary}
            multiline
            editable={!isStreaming}
            textAlignVertical="center"
            returnKeyType="default"
          />
          <Pressable
            style={[
              styles.micButton,
              isRecordingMic ? styles.micButtonRecording : null,
            ]}
            onPress={handleMicPress}
            disabled={isTranscribing}
          >
            {isTranscribing ? (
              <ActivityIndicator size="small" color={token.accent} />
            ) : (
              <MicGlyph color={isRecordingMic ? token.accent : token.textSoft} />
            )}
          </Pressable>
          <Pressable
            style={[
              styles.sendButton,
              !canSend ? styles.sendButtonDisabled : null,
            ]}
            disabled={!canSend}
            onPress={handleSend}
          >
            {isStreaming ? (
              <ActivityIndicator color={token.accentInk} size="small" />
            ) : (
              <SendGlyph color={token.accentInk} />
            )}
          </Pressable>
        </View>
      </View>

      {/* Profile Modal */}
      <Modal
        visible={showProfileModal}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setShowProfileModal(false)}
      >
        <CoachProfileForm
          initialData={profile}
          onSave={handleProfileSave}
          onSkip={() => setShowProfileModal(false)}
          isSaving={profileSaving}
        />
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function ListSeparator() {
  return <View style={{ height: 16 }} />;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: token.bg,
  },
  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 58 : 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: token.line,
    backgroundColor: token.bg,
  },
  headerCircleButton: {
    width: 32,
    height: 32,
    borderRadius: rad.pill,
    backgroundColor: token.surface,
    borderWidth: 1,
    borderColor: token.line,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerSparkleOrb: {
    width: 32,
    height: 32,
    borderRadius: rad.pill,
    backgroundColor: token.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: token.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  headerTitle: {
    fontFamily: font.sans[600],
    fontSize: 15,
    fontWeight: "600",
    color: token.text,
    letterSpacing: -0.15,
  },
  headerStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  headerStatusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: token.accent,
  },
  headerStatusText: {
    fontFamily: font.sans[500],
    fontSize: 10.5,
    fontWeight: "500",
    color: token.accent,
    letterSpacing: 1.05,
  },
  menuDropdown: {
    position: "absolute",
    top: 40,
    right: 0,
    width: 200,
    backgroundColor: token.surface,
    borderRadius: rad.sm,
    borderWidth: 1,
    borderColor: token.line2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 40,
    elevation: 12,
    zIndex: 100,
    overflow: "hidden",
  },
  menuItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuItemText: {
    fontFamily: font.sans[500],
    fontSize: 14,
    color: token.text,
  },
  menuItemDestructive: {
    color: token.negative,
  },
  menuDivider: {
    height: 1,
    backgroundColor: token.line,
  },
  // List
  listContent: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexGrow: 1,
    justifyContent: "flex-end" as const,
    gap: 10,
  },
  // Empty state
  emptyCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyState: {
    paddingHorizontal: 16,
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyTitle: {
    fontFamily: font.sans[600],
    fontSize: 22,
    fontWeight: "600",
    color: token.text,
    textAlign: "center",
    letterSpacing: -0.55,
  },
  emptyBody: {
    marginTop: 10,
    fontFamily: font.sans[400],
    fontSize: 14,
    lineHeight: 21,
    color: token.textSoft,
    textAlign: "center",
    maxWidth: 300,
  },
  starterGrid: {
    marginTop: 24,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  starterChip: {
    borderWidth: 1,
    borderColor: token.line,
    borderRadius: rad.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "transparent",
  },
  starterChipText: {
    fontFamily: font.sans[600],
    fontSize: 12,
    color: token.textSoft,
    fontWeight: "600",
    letterSpacing: 0.24,
  },
  // Composer
  composer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 34 : 12,
    backgroundColor: token.bg,
    borderTopWidth: 1,
    borderTopColor: token.line,
  },
  composerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  composerInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: rad.sm,
    backgroundColor: token.surface,
    borderWidth: 1,
    borderColor: token.line,
    color: token.text,
    fontFamily: font.sans[400],
    fontSize: 14.5,
    letterSpacing: -0.07,
  },
  micButton: {
    width: 40,
    height: 40,
    borderRadius: rad.pill,
    backgroundColor: token.surface,
    borderWidth: 1,
    borderColor: token.line,
    alignItems: "center",
    justifyContent: "center",
  },
  micButtonRecording: {
    backgroundColor: token.accentTintBg,
    borderColor: token.accentTintBorder,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: rad.pill,
    backgroundColor: token.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    backgroundColor: token.surface2,
    opacity: 0.6,
  },
});

import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import type { AssistantChatResponse } from "@voicefit/contracts/types";
import { useCommandCenter } from "../../components/command-center";
import { apiRequest } from "../../lib/api-client";

const COLORS = {
  bg: "#FFFFFF",
  surface: "#F8F8F8",
  border: "#E8E8E8",
  textPrimary: "#1A1A1A",
  textSecondary: "#8E8E93",
  textTertiary: "#AEAEB2",
  coachPurple: "#AF52DE",
  weight: "#007AFF",
};

const starterPrompts = [
  "Summarize my last 7 days",
  "How are my calories trending?",
  "Any changes in my weight this week?",
  "How consistent were my workouts?",
];

type CoachMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: "pending" | "error";
  followups?: string[];
};

const SAMPLE_MESSAGES: CoachMessage[] = [
  {
    id: "sample-user-1",
    role: "user",
    content: "Summarize my last 7 days",
  },
  {
    id: "sample-assistant-1",
    role: "assistant",
    content:
      "Pretty solid week overall! You averaged about 2,180 cal/day, which is just slightly above your 2,100 goal, so nothing alarming.\n\nSteps were great at 8.2k avg, above your 8k target, and you logged 3 workouts which matches last week. The main flag is that your calories have been creeping up a bit compared to the week before.",
    followups: ["What should I focus on next?", "Show my weight trend"],
  },
  {
    id: "sample-user-2",
    role: "user",
    content: "How are my calories trending?",
  },
];

const MOCK_RESPONSES: Record<string, { headline: string; highlights?: string[] }> = {
  "Summarize my last 7 days": {
    headline:
      "Pretty solid week overall! You averaged about 2,180 cal/day, which is just slightly above your 2,100 goal.\n\nSteps were strong at 8.2k/day and you logged 3 workouts, which matches last week. The one thing to tighten is your late-evening snacking, because that's where most of the calorie drift came from.",
    highlights: ["What should I focus on next?", "Show my weight trend"],
  },
  "How are my calories trending?": {
    headline:
      "Calories are up slightly versus the prior 7 days. You are averaging 1,651 kcal/day in the current window, about 3% lower than the previous week, so the trend is actually moving in the right direction after a brief spike mid-week.",
    highlights: ["What changed mid-week?", "How does that compare to goal?"],
  },
  "Any changes in my weight this week?": {
    headline:
      "Weight is down 0.8 kg versus your recent average. The trend is moving toward your 70 kg goal, but the change is still within a normal weekly fluctuation band.",
    highlights: ["Show the 30-day trend", "Any correlation with workouts?"],
  },
  "How consistent were my workouts?": {
    headline:
      "You logged 3 workouts in the last 7 days, which is consistent with your prior week. The cadence is solid; the main opportunity is reducing the gap between your second and third sessions.",
    highlights: ["Which day did I miss?", "Summarize volume"],
  },
};

const createId = () => `coach-${Date.now()}-${Math.random().toString(16).slice(2)}`;

// Module-level cache so messages survive navigation within the same app session
let cachedMessages: CoachMessage[] | null = null;

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Coach couldn’t respond right now.";
}

function BackGlyph() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 5L8 12L15 19"
        stroke={COLORS.textPrimary}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CoachSparkle() {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2L14.2 8.2L20.4 10.4L14.2 12.6L12 18.8L9.8 12.6L3.6 10.4L9.8 8.2L12 2Z"
        fill={COLORS.coachPurple}
      />
    </Svg>
  );
}

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
      <Path d="M12 18V21" stroke={color} strokeWidth={2} strokeLinecap="round" />
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

export default function CoachScreen() {
  const cc = useCommandCenter();
  const router = useRouter();
  const { getToken } = useAuth();
  const insets = useSafeAreaInsets();
  const isWebPreview = __DEV__ && Platform.OS === "web";
  const scrollRef = useRef<ScrollView>(null);
  const [messages, setMessagesRaw] = useState<CoachMessage[]>(() =>
    isWebPreview ? SAMPLE_MESSAGES : cachedMessages ?? []
  );
  const setMessages: typeof setMessagesRaw = (update) => {
    setMessagesRaw((prev) => {
      const next = typeof update === "function" ? update(prev) : update;
      cachedMessages = next;
      return next;
    });
  };
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);

  const scrollToBottom = (animated = true) => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated }));
  };

  const hasMessages = useMemo(() => messages.length > 0, [messages.length]);

  const sendMessage = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || isSending) return;

    const userMessage: CoachMessage = {
      id: createId(),
      role: "user",
      content: trimmed,
    };
    const assistantId = createId();
    const pendingAssistant: CoachMessage = {
      id: assistantId,
      role: "assistant",
      content: "Thinking...",
      status: "pending",
    };

    setMessages((prev) => [...prev, userMessage, pendingAssistant]);
    setDraft("");
    setIsSending(true);

    try {
      if (isWebPreview) {
        await new Promise((resolve) => setTimeout(resolve, 420));
        const mock = MOCK_RESPONSES[trimmed] ?? {
          headline:
            "Coach thinks this looks broadly on track. Calories are close to target, workouts are reasonably consistent, and the next best step is tightening one habit rather than changing everything at once.",
          highlights: ["Give me one next action", "Show the weekly trend"],
        };
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  content: mock.headline,
                  followups: mock.highlights,
                  status: undefined,
                }
              : message
          )
        );
        return;
      }

      const token = await getToken();
      if (!token) {
        throw new Error("Not signed in");
      }
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const result = await apiRequest<AssistantChatResponse>("/api/assistant/chat", {
        method: "POST",
        token,
        body: JSON.stringify({ message: trimmed, timezone }),
      });

      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                content: result.headline,
                followups: result.highlights?.slice(0, 2),
                status: undefined,
              }
            : message
        )
      );
    } catch (error) {
      const message = getErrorMessage(error);
      setMessages((prev) =>
        prev.map((item) =>
          item.id === assistantId
            ? {
                ...item,
                content: message,
                status: "error",
              }
            : item
        )
      );
    } finally {
      setIsSending(false);
      scrollToBottom(true);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.keyboardRoot}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
      >
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
                return;
              }
              router.replace("/(tabs)/dashboard");
            }}
          >
            <BackGlyph />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Coach</Text>
            <Text style={styles.subtitle}>Insights from your logs</Text>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          onContentSizeChange={() => scrollToBottom(false)}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.starterRow}
          >
            {starterPrompts.map((prompt) => (
              <Pressable
                key={prompt}
                style={styles.starterChip}
                onPress={() => sendMessage(prompt)}
                disabled={isSending}
              >
                <Text style={styles.starterChipText}>{prompt}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {!hasMessages ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Ask Coach anything about your recent patterns.</Text>
              <Text style={styles.emptyBody}>
                Start with calories, weight, workout consistency, or one of the starter prompts above.
              </Text>
            </View>
          ) : null}

          {messages.map((message) => {
            const isUser = message.role === "user";
            return (
              <View
                key={message.id}
                style={[styles.messageGroup, isUser ? styles.userGroup : styles.assistantGroup]}
              >
                <View style={styles.messageMeta}>
                  {isUser ? null : <CoachSparkle />}
                  <Text style={[styles.senderLabel, !isUser ? styles.coachLabel : null]}>
                    {isUser ? "You" : "Coach"}
                  </Text>
                </View>
                <View
                  style={[
                    styles.bubble,
                    isUser ? styles.userBubble : styles.assistantBubble,
                    message.status === "error" ? styles.errorBubble : null,
                  ]}
                >
                  <Text style={[styles.bubbleText, isUser ? styles.userBubbleText : null]}>
                    {message.content}
                  </Text>
                </View>
                {!isUser && message.followups?.length ? (
                  <View style={styles.followupRow}>
                    {message.followups.map((followup) => (
                      <Pressable
                        key={followup}
                        style={styles.followupChip}
                        onPress={() => sendMessage(followup)}
                      >
                        <Text style={styles.followupText}>{followup}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>

        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <View style={styles.composerRow}>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="Ask about your trends..."
              placeholderTextColor={COLORS.textTertiary}
              multiline
              editable={!isSending}
              textAlignVertical="top"
              onFocus={() => scrollToBottom(false)}
            />
            <Pressable
              style={styles.micButton}
              onPress={() => cc.startRecording()}
            >
              <MicGlyph />
            </Pressable>
            <Pressable
              style={[
                styles.sendButton,
                (!draft.trim() || isSending) ? styles.sendButtonDisabled : null,
              ]}
              disabled={!draft.trim() || isSending}
              onPress={() => sendMessage(draft)}
            >
              {isSending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <SendGlyph color="#FFFFFF" />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  keyboardRoot: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: 1,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 16,
  },
  starterRow: {
    gap: 8,
    paddingBottom: 8,
  },
  starterChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: COLORS.surface,
  },
  starterChipText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  emptyState: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 18,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.textSecondary,
  },
  messageGroup: {
    gap: 4,
  },
  userGroup: {
    alignItems: "flex-end",
  },
  assistantGroup: {
    alignItems: "flex-start",
  },
  messageMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 4,
  },
  senderLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  coachLabel: {
    color: COLORS.coachPurple,
  },
  bubble: {
    maxWidth: "90%",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  userBubble: {
    backgroundColor: COLORS.textPrimary,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 4,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  assistantBubble: {
    backgroundColor: COLORS.surface,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.coachPurple,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  errorBubble: {
    borderColor: "#FFB4AE",
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 23,
    color: COLORS.textPrimary,
  },
  userBubbleText: {
    color: "#FFFFFF",
  },
  followupRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingTop: 6,
  },
  followupChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.bg,
  },
  followupText: {
    fontSize: 12,
    fontWeight: "500",
    color: COLORS.weight,
  },
  composer: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 8,
    backgroundColor: COLORS.bg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  composerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 88,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    color: COLORS.textPrimary,
    fontSize: 15,
    textAlignVertical: "center",
  },
  micButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.textPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#D6D6DB",
  },
});

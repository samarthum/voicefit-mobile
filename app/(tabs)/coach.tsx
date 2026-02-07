import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import type { AssistantChatMessage, AssistantChatResponse } from "@voicefit/contracts/types";
import { apiRequest } from "../../lib/api-client";

const starterPrompts = [
  "Summarize my last 7 days",
  "How are my calories trending?",
  "Any changes in my weight this week?",
  "How consistent were my workouts?",
];

const createId = () => `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`;

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Failed to respond. Please try again.";
}

export default function CoachScreen() {
  const { getToken } = useAuth();
  const [messages, setMessages] = useState<AssistantChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const listRef = useRef<FlatList<AssistantChatMessage>>(null);

  const hasMessages = useMemo(() => messages.length > 0, [messages.length]);

  const sendMessage = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || isSending) return;

    const userMessage: AssistantChatMessage = {
      id: createId(),
      role: "user",
      content: trimmed,
    };
    const assistantId = createId();
    const pendingAssistant: AssistantChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "Thinking...",
      status: "pending",
    };

    setMessages((prev) => [...prev, userMessage, pendingAssistant]);
    setDraft("");
    setIsSending(true);

    try {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
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
                highlights: result.highlights ?? [],
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
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Coach</Text>
      <Text style={styles.subtitle}>Read-only insights from your recent logs.</Text>

      {!hasMessages ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Try a starter prompt</Text>
          {starterPrompts.map((prompt) => (
            <Pressable
              key={prompt}
              style={[styles.starterButton, isSending ? styles.disabledButton : null]}
              onPress={() => sendMessage(prompt)}
              disabled={isSending}
            >
              <Text style={styles.starterButtonText}>{prompt}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View
            style={[
              styles.messageBubble,
              item.role === "user" ? styles.userBubble : styles.assistantBubble,
              item.status === "error" ? styles.errorBubble : null,
            ]}
          >
            <Text style={styles.messageRole}>{item.role === "user" ? "You" : "Coach"}</Text>
            <Text style={styles.messageText}>{item.content}</Text>
            {item.role === "assistant" && item.highlights && item.highlights.length > 0 ? (
              <View style={styles.highlightList}>
                {item.highlights.map((highlight) => (
                  <Text key={highlight} style={styles.highlightText}>
                    - {highlight}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        )}
        ListFooterComponent={<View style={styles.footerSpace} />}
      />

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Ask Coach about your trends..."
          multiline
          editable={!isSending}
        />
        <Pressable
          style={[
            styles.sendButton,
            (!draft.trim() || isSending) ? styles.disabledButton : null,
          ]}
          onPress={() => sendMessage(draft)}
          disabled={!draft.trim() || isSending}
        >
          {isSending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.sendButtonText}>Send</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#FFFFFF",
    gap: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
  },
  subtitle: {
    fontSize: 14,
    color: "#4B5563",
  },
  emptyCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
  },
  starterButton: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
  },
  starterButtonText: {
    fontSize: 13,
    color: "#111827",
    fontWeight: "600",
  },
  listContent: {
    paddingTop: 6,
    gap: 10,
  },
  messageBubble: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 5,
  },
  userBubble: {
    backgroundColor: "#E5E7EB",
    alignSelf: "flex-end",
    maxWidth: "90%",
  },
  assistantBubble: {
    backgroundColor: "#F3F4F6",
    alignSelf: "flex-start",
    maxWidth: "95%",
  },
  errorBubble: {
    borderWidth: 1,
    borderColor: "#FCA5A5",
    backgroundColor: "#FEE2E2",
  },
  messageRole: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "700",
    textTransform: "uppercase",
  },
  messageText: {
    fontSize: 14,
    color: "#111827",
  },
  highlightList: {
    gap: 4,
    marginTop: 2,
  },
  highlightText: {
    fontSize: 13,
    color: "#374151",
  },
  footerSpace: {
    height: 8,
  },
  composer: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 10,
    gap: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#FFFFFF",
    textAlignVertical: "top",
    minHeight: 70,
    maxHeight: 140,
  },
  sendButton: {
    alignSelf: "flex-end",
    backgroundColor: "#111827",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 84,
  },
  sendButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.6,
  },
});

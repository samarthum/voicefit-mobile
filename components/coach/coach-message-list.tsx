import React, { forwardRef, memo, useCallback } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LegendList, type LegendListRef } from "@legendapp/list";
import { getToolName, isStaticToolUIPart } from "ai";
import type { CoachUIMessage } from "@voicefit/contracts/coach";
import Markdown from "react-native-markdown-display";
import Svg, { Path } from "react-native-svg";
import { color as token, font, radius as rad } from "../../lib/tokens";

type CoachMessageListProps = {
  messages: CoachUIMessage[];
  loadingHistory: boolean;
  historyHydrated: boolean;
  starterPrompts: string[];
  onStarterPress: (text: string) => void;
  onContentSizeChange?: (width: number, height: number) => void;
  bottomSpacerHeight?: number;
};

export const CoachMessageList = forwardRef<
  LegendListRef,
  CoachMessageListProps
>(function CoachMessageList(
  {
    messages,
    loadingHistory,
    historyHydrated,
    starterPrompts,
    onStarterPress,
    onContentSizeChange,
    bottomSpacerHeight = 0,
  },
  ref
) {
  const renderItem = useCallback(({ item }: { item: CoachUIMessage }) => {
    if (item.role === "user") {
      return <UserBubble text={getMessageText(item)} />;
    }

    return <AssistantBubble messageId={item.id} parts={item.parts} />;
  }, []);

  const keyExtractor = useCallback((item: CoachUIMessage) => item.id, []);

  const ListEmpty = useCallback(() => {
    if (loadingHistory) {
      return (
        <View style={styles.emptyCenter}>
          <ActivityIndicator color={token.accent} />
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
          {starterPrompts.map((prompt) => (
            <Pressable
              key={prompt}
              style={styles.starterChip}
              onPress={() => onStarterPress(prompt)}
              accessibilityRole="button"
            >
              <Text style={styles.starterChipText}>{prompt}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }, [loadingHistory, onStarterPress, starterPrompts]);

  return (
    <LegendList
      key={historyHydrated ? "coach-history-ready" : "coach-history-loading"}
      ref={ref}
      data={messages}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      estimatedItemSize={120}
      initialScrollIndex={
        historyHydrated && messages.length > 0
          ? { index: messages.length - 1 }
          : undefined
      }
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      onContentSizeChange={onContentSizeChange}
      contentContainerStyle={styles.listContent}
      ItemSeparatorComponent={ListSeparator}
      ListFooterComponent={
        bottomSpacerHeight > 0 ? (
          <View style={{ height: bottomSpacerHeight }} />
        ) : null
      }
      ListEmptyComponent={ListEmpty}
      alignItemsAtEnd
      maintainScrollAtEnd
    />
  );
});

export function getMessageText(message: CoachUIMessage) {
  return (
    message.parts
      .filter(
        (part): part is { type: "text"; text: string } =>
          part.type === "text"
      )
      .map((part) => part.text)
      .join("\n") || ""
  );
}

type UserBubbleProps = { text: string };

export const UserBubble = memo(function UserBubble({ text }: UserBubbleProps) {
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
  parts: CoachUIMessage["parts"];
};

export const AssistantBubble = memo(function AssistantBubble({
  messageId,
  parts,
}: AssistantBubbleProps) {
  const toolParts: Array<{ key: string; label: string; state: string }> = [];
  const textParts: Array<{ key: string; text: string }> = [];

  parts.forEach((part, index) => {
    if (part.type === "text") {
      if (part.text.trim()) {
        textParts.push({ key: `${messageId}-t-${index}`, text: part.text });
      }
    } else if (isStaticToolUIPart(part)) {
      const label =
        part.state === "input-available" || part.state === "output-available"
          ? part.input.label
          : undefined;
      const name = getToolName(part);
      toolParts.push({
        key: `${messageId}-tool-${index}`,
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
              {toolParts.map((toolPart) => (
                <ToolActivityLine
                  key={toolPart.key}
                  label={toolPart.label}
                  state={toolPart.state}
                />
              ))}
            </View>
          ) : null}
          {textParts.map((textPart) => (
            <Markdown key={textPart.key} style={markdownStyles}>
              {textPart.text}
            </Markdown>
          ))}
        </View>
      ) : (
        <View style={bubbleStyles.assistantBubble}>
          <ActivityIndicator
            size="small"
            color={token.accent}
            style={styles.assistantLoader}
          />
        </View>
      )}
    </View>
  );
});

export function ErrorBubble({
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

function ToolActivityLine({
  label,
  state,
}: {
  label: string;
  state: string;
}) {
  const isRunning = state === "input-streaming" || state === "input-available";
  const isDone = state === "output-available";

  return (
    <View style={toolStyles.row}>
      {isDone ? (
        <CheckGlyph />
      ) : isRunning ? (
        <ActivityIndicator size="small" color={token.accent} />
      ) : (
        <ActivityIndicator size="small" color={token.textMute} />
      )}
      <Text
        style={[toolStyles.label, isDone ? toolStyles.labelDone : null]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

function ListSeparator() {
  return <View style={styles.listSeparator} />;
}

function SparkleGlyph() {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2L14.2 8.2L20.4 10.4L14.2 12.6L12 18.8L9.8 12.6L3.6 10.4L9.8 8.2L12 2Z"
        fill={token.accent}
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

const styles = StyleSheet.create({
  listContent: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 10,
  },
  listSeparator: { height: 16 },
  assistantLoader: { alignSelf: "flex-start" },
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
});

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

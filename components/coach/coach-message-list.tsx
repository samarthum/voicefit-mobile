import React, { useCallback, useEffect, useRef } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import {
  MessagePrimitive,
  ThreadPrimitive,
  useAuiState,
  type EmptyMessagePartProps,
  type TextMessagePartProps,
  type ThreadMessage,
  type ToolCallMessagePartProps,
} from "@assistant-ui/react-native";
import Markdown from "react-native-markdown-display";
import Svg, { Path } from "react-native-svg";
import {
  getCoachToolLabel,
  getToolLineState,
  type ToolLineState,
} from "@/components/coach/coach-tool-line";
import { color as token, font, radius as rad } from "@/lib/tokens";

type CoachMessageListProps = {
  loadingHistory: boolean;
  starterPrompts: string[];
};

export function CoachMessageList({
  loadingHistory,
  starterPrompts,
}: CoachMessageListProps) {
  return (
    <ThreadPrimitive.Root style={styles.flex}>
      {loadingHistory ? (
        <View style={styles.emptyCenter}>
          <ActivityIndicator color={token.accent} />
        </View>
      ) : (
        <>
          <ThreadPrimitive.If empty>
            <EmptyState starterPrompts={starterPrompts} />
          </ThreadPrimitive.If>
          <ThreadPrimitive.If empty={false}>
            <CoachMessages />
          </ThreadPrimitive.If>
        </>
      )}
    </ThreadPrimitive.Root>
  );
}

// ---------------------------------------------------------------------------
// Message list (FlatList via ThreadPrimitive.Messages)
// ---------------------------------------------------------------------------

// ThreadPrimitive.Messages spreads extra props onto its FlatList; with React 19
// `ref` rides along as a regular prop, but the published prop type doesn't
// declare it — this cast adds it. (Needed for scroll pinning below.)
const ThreadMessages = ThreadPrimitive.Messages as React.ComponentType<
  React.ComponentProps<typeof ThreadPrimitive.Messages> & {
    ref?: React.Ref<FlatList<ThreadMessage>>;
  }
>;

// Minimal structural type: the package exports two distinct `MessageState`
// types, and the one ThreadMessages' children receives isn't the re-exported
// one — `role` is all we need here anyway.
const renderMessage = ({ message }: { message: { role: string } }) =>
  message.role === "user" ? <UserMessage /> : <AssistantMessage />;

/** How close to the bottom (px) still counts as "pinned to the end". */
const PIN_THRESHOLD = 80;

function CoachMessages() {
  const listRef = useRef<FlatList<ThreadMessage>>(null);
  // Pin-to-bottom: hydrated history lands scrolled to the latest message and
  // streaming output keeps following it, but scrolling up to read releases
  // the pin until the user returns to the bottom.
  const isPinnedRef = useRef(true);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      const distanceFromEnd =
        contentSize.height - layoutMeasurement.height - contentOffset.y;
      isPinnedRef.current = distanceFromEnd < PIN_THRESHOLD;
    },
    []
  );

  // Fires on every content growth: history hydration batches, streaming
  // tokens, late markdown/tool layout. Re-pinning here replaces the staggered
  // scroll-timeout workarounds the LegendList version needed.
  const handleContentSizeChange = useCallback(() => {
    if (isPinnedRef.current) {
      listRef.current?.scrollToEnd({ animated: false });
    }
  }, []);

  // Re-pin the list to the latest message when the keyboard comes up —
  // without this the user lands mid-thread when they tap the composer.
  // Layout is handled by the keyboard-controller KeyboardAvoidingView.
  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () => {
      listRef.current?.scrollToEnd({ animated: true });
    });
    return () => {
      showSub.remove();
    };
  }, []);

  return (
    <ThreadMessages
      ref={listRef}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      onScroll={handleScroll}
      scrollEventThrottle={32}
      onContentSizeChange={handleContentSizeChange}
      contentContainerStyle={styles.listContent}
      ItemSeparatorComponent={ListSeparator}
    >
      {renderMessage}
    </ThreadMessages>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ starterPrompts }: { starterPrompts: string[] }) {
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
          <ThreadPrimitive.Suggestion
            key={prompt}
            prompt={prompt}
            send
            style={styles.starterChip}
            onPressIn={dismissKeyboard}
            accessibilityRole="button"
          >
            <Text style={styles.starterChipText}>{prompt}</Text>
          </ThreadPrimitive.Suggestion>
        ))}
      </View>
    </View>
  );
}

function dismissKeyboard() {
  Keyboard.dismiss();
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

function UserMessage() {
  const text = useAuiState((s) =>
    s.message.parts
      .map((part) => (part.type === "text" ? part.text : ""))
      .filter(Boolean)
      .join("\n")
  );

  return (
    <MessagePrimitive.Root style={bubbleStyles.userGroup}>
      <View style={bubbleStyles.userBubble}>
        {/* NUI-14: selectable — coach messages are important data */}
        <Text style={bubbleStyles.userText} selectable>
          {text}
        </Text>
      </View>
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root style={bubbleStyles.assistantGroup}>
      <View style={bubbleStyles.metaRow}>
        <SparkleGlyph />
        <Text style={bubbleStyles.coachLabel}>Coach</Text>
      </View>
      <View style={bubbleStyles.assistantBubble}>
        <MessagePrimitive.Parts
          components={assistantPartComponents}
          // Keep the loader exclusively for the "no content yet" state; the
          // default (true) would also render it under running tool lines.
          unstable_showEmptyOnNonTextEnd={false}
        />
      </View>
    </MessagePrimitive.Root>
  );
}

function AssistantTextPart({ text }: TextMessagePartProps) {
  if (!text.trim()) return null;
  // NUI-14: Markdown renders <Text> internally; the `selectable` style key on
  // the body style is the supported path for long-press selection.
  return <Markdown style={markdownStyles}>{text}</Markdown>;
}

function AssistantEmptyPart(_props: EmptyMessagePartProps) {
  return (
    <ActivityIndicator
      size="small"
      color={token.accent}
      style={styles.assistantLoader}
    />
  );
}

function CoachToolPart({ toolName, args, status }: ToolCallMessagePartProps) {
  return (
    <ToolActivityLine
      label={getCoachToolLabel(toolName, args)}
      state={getToolLineState(status.type)}
    />
  );
}

// ToolGroup is deprecated in favor of MessagePrimitive.GroupedParts, but it's
// the lightest way to reproduce the bordered tool section around consecutive
// tool lines; revisit if it's removed.
function ToolSection({ children }: React.PropsWithChildren) {
  return <View style={bubbleStyles.toolSection}>{children}</View>;
}

const assistantPartComponents = {
  Text: AssistantTextPart,
  Empty: AssistantEmptyPart,
  tools: { Fallback: CoachToolPart },
  ToolGroup: ToolSection,
};

// ---------------------------------------------------------------------------
// Error bubble (fed by the useChat instance the screen still owns)
// ---------------------------------------------------------------------------

export function ErrorBubble({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View style={errorStyles.container}>
      {/* NUI-14: selectable on error text */}
      <Text style={errorStyles.text} selectable>
        {message}
      </Text>
      {onRetry != null ? (
        <Pressable style={errorStyles.retry} onPress={onRetry}>
          <Text style={errorStyles.retryText}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Tool activity line
// ---------------------------------------------------------------------------

function ToolActivityLine({
  label,
  state,
}: {
  label: string;
  state: ToolLineState;
}) {
  return (
    <View style={toolStyles.row}>
      {state === "done" ? (
        <CheckGlyph />
      ) : state === "running" ? (
        <ActivityIndicator size="small" color={token.accent} />
      ) : (
        <ActivityIndicator size="small" color={token.textMute} />
      )}
      <Text
        style={[toolStyles.label, state === "done" ? toolStyles.labelDone : null]}
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
  flex: { flex: 1 },
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
    borderCurve: "continuous", // NUI-2
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
    borderCurve: "continuous", // NUI-2
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
    borderCurve: "continuous", // NUI-2
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

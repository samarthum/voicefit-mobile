# Coach Chat → assistant-ui Migration Plan

Status: **proposed** · Branch: `claude/zen-archimedes-ajxjwx` · Date: 2026-06-09

This plan covers migrating the coach chat feature from a hand-rolled UI on top of
the Vercel AI SDK (`useChat` + custom components) to
[assistant-ui](https://www.assistant-ui.com/) using its React Native package
(`@assistant-ui/react-native`) and AI SDK runtime adapter
(`@assistant-ui/react-ai-sdk`).

---

## 1. Why this is a good fit

- **We are already on the exact stack assistant-ui targets.** The coach screen
  uses `ai@^6` + `@ai-sdk/react@^3` with `DefaultChatTransport` — assistant-ui's
  current AI SDK integration requires `ai@^6` and `@ai-sdk/react@^3`, and its
  docs explicitly state the AI SDK runtime setup "transfers directly" to React
  Native. **No backend changes are required** — `/api/coach/chat` keeps
  returning the same UI message stream.
- **The runtime core is shared** between `@assistant-ui/react` and
  `@assistant-ui/react-native` (via `@assistant-ui/core`). We get battle-tested
  chat state management (streaming, send/cancel, tool-call part state,
  composer state, suggestions) and keep full control of the UI layer, since the
  RN package ships *unstyled primitives* (`ThreadPrimitive`, `MessagePrimitive`,
  `ComposerPrimitive`) rather than styled web components.
- **What we get for free** that we currently hand-roll or lack:
  - Composer state machine (disabled-while-streaming, send vs **cancel during
    streaming** — which we don't support today)
  - Tool-call part rendering pipeline with status tracking
  - Empty-state starter prompts (`ThreadPrimitive.Suggestion` with
    `prompt`/`send` props)
  - A future path to dictation as a first-class adapter, message editing,
    regeneration UI, and multi-thread support

## 2. Current state (what we're migrating)

| Concern | Today | File |
| --- | --- | --- |
| Chat state | `useChat<CoachUIMessage>` + `DefaultChatTransport` (expo fetch, Clerk bearer header, `{ timezone }` body) | `app/coach.tsx:120-139` |
| History hydration | TanStack Query `GET /api/coach/messages` → `setMessages(serverMessages)` once | `app/coach.tsx:101-150` |
| Clear conversation | Mutation `POST /api/coach/clear` → `setMessages([])` | `app/coach.tsx:211-241` |
| Message list | `LegendList` + custom `UserBubble` / `AssistantBubble` / `ErrorBubble`, manual scroll-pinning workarounds | `components/coach/coach-message-list.tsx` |
| Tool UI | `isStaticToolUIPart(part)` + `ToolActivityLine` (spinner → checkmark), label from `part.input.label` ?? tool name | `coach-message-list.tsx:150-264` |
| Markdown | `react-native-markdown-display` with hardcoded `markdownStyles` | `coach-message-list.tsx` |
| Composer | Controlled `TextInput` (`draft` state in screen), mic + send buttons | `components/coach/coach-composer.tsx` |
| Voice input | `useCoachVoiceInput` (expo-audio → `POST /api/transcribe`) writes transcript into `draft` | `hooks/use-coach-voice-input.ts` |
| Starter prompts | 4 hardcoded chips in empty state → `sendMessage({ text })` | `app/coach.tsx:38-43` |
| Types | `CoachUIMessage = UIMessage<unknown, UIDataTypes, CoachUITools>` from `@voicefit/contracts` | vendor tarball |

Out of scope / unchanged: `CoachHeader`, `CoachProfileForm`, `useCoachProfile`,
the backend, the transcribe endpoint, design tokens.

## 3. Target architecture

```
app/coach.tsx
  useChat<CoachUIMessage>({ transport: DefaultChatTransport(...) })   ← unchanged
        │
  useAISDKRuntime(chat)                 ← @assistant-ui/react-ai-sdk
        │
  <AssistantRuntimeProvider runtime>    ← @assistant-ui/react-native
        │
  ├─ CoachHeader                        ← unchanged
  ├─ CoachThread (new)
  │    ThreadPrimitive.Root / .Messages (FlatList-based)
  │      ├─ UserMessage     → MessagePrimitive.Root + bubble styles (ported)
  │      └─ AssistantMessage→ MessagePrimitive.Root + MessagePrimitive.Parts
  │            ├─ text      → <Markdown> (react-native-markdown-display, kept)
  │            └─ tool-call → ToolActivityLine (ported, reads part.status)
  │    AuiIf(thread.isEmpty) → starter prompts via ThreadPrimitive.Suggestion
  ├─ ErrorBubble (kept, fed by chat.error / chat.regenerate)
  └─ CoachComposerV2 (new)
       ComposerPrimitive.Root / .Input / .Send / .Cancel
       + custom mic button (useCoachVoiceInput, transcript via aui.composer().setText)
```

**Key decision — `useAISDKRuntime` over `useChatRuntime`:** we keep owning the
`useChat` instance. This preserves, with zero rework:

- the custom `DefaultChatTransport` (expo `fetch`, async Clerk auth headers,
  `timezone` body),
- the TanStack Query → `setMessages()` history hydration flow,
- `chat.error` / `chat.regenerate` for the error bubble,
- the clear-conversation mutation (`setMessages([])`).

`useChatRuntime` (the higher-level hook) would force history through a
`ThreadHistoryAdapter` with `withFormat` and a row format
(`{ id, parent_id, format, content }`) our backend doesn't speak. That's a fine
future step (see §7), not a prerequisite.

## 4. Dependencies

```sh
bun add @assistant-ui/react-native @assistant-ui/react-ai-sdk
```

- `ai@^6.0.154`, `@ai-sdk/react@^3.0.156` already satisfy the peer ranges.
- **Not needed:** `@assistant-ui/metro` (`withAui`) — only required for
  `"use generative"` toolkit files. All 8 coach tools execute on the backend;
  the client only *renders* tool calls, which needs no compiler plugin.
- **Not needed:** `@assistant-ui/react`, Tailwind, shadcn registry — those are
  web-only. RN uses primitives + our own `StyleSheet`s.

## 5. Phased migration

Each phase is a separate commit and leaves the coach screen fully functional.

### Phase 0 — Install & smoke test (~0.5 day)

1. Add the two packages, run `bun expo start` on iOS/Android/web, confirm the
   app builds with the new deps (RN 0.81.5 / React 19.1 / Expo 54).
2. No code changes beyond `package.json`.

**Exit criteria:** clean build, no Metro resolution errors.

### Phase 1 — Runtime bridge, no visual change (~0.5 day)

In `app/coach.tsx`:

```tsx
import { AssistantRuntimeProvider } from "@assistant-ui/react-native";
import { useAISDKRuntime } from "@assistant-ui/react-ai-sdk";

const chat = useChat<CoachUIMessage>({ transport: /* unchanged */ });
const runtime = useAISDKRuntime(chat);

return (
  <AssistantRuntimeProvider runtime={runtime}>
    {/* existing tree, untouched */}
  </AssistantRuntimeProvider>
);
```

Everything still renders from the `chat` object directly; the provider just
makes runtime context available for the next phases.

**Exit criteria:** behavior identical to `main` (send, stream, hydrate,
clear, retry, mic).

### Phase 2 — Composer (~1 day)

Replace `CoachComposer`'s controlled-input plumbing with
`ComposerPrimitive`, keeping the exact visual design:

```tsx
// components/coach/coach-composer.tsx (rewritten internals)
<ComposerPrimitive.Root>            {/* View wrapper, existing row styles */}
  <ComposerPrimitive.Input
    placeholder="Ask your coach..."
    multiline
    style={existingInputStyles}     {/* RN Input = TextInput wrapper */}
  />
  <MicButton />                     {/* custom, unchanged visuals */}
  <AuiIf condition={(s) => !s.thread.isRunning}>
    <ComposerPrimitive.Send>{/* existing send pill */}</ComposerPrimitive.Send>
  </AuiIf>
  <AuiIf condition={(s) => s.thread.isRunning}>
    <ComposerPrimitive.Cancel>{/* stop square — new capability */}</ComposerPrimitive.Cancel>
  </AuiIf>
</ComposerPrimitive.Root>
```

Required adjustments:

- **Draft state moves into the runtime.** Delete `draft`/`setDraft` from
  `coach.tsx`. The voice hook writes via the runtime instead:
  ```tsx
  const aui = useAui();
  const handleTranscript = useCallback(
    (t: string) => aui.composer().setText(t),
    [aui],
  );
  ```
- **`handleSend` goes away** — `ComposerPrimitive.Send` handles
  trim/empty/disabled logic. Keep `Keyboard.dismiss()` via an `onPress`
  side-effect or the composer's send event (`useAuiEvent("composer.send", ...)`).
- Keep `isTranscribing` / `isRecordingMic` UI exactly as-is on the mic button.
- Note: assistant-ui no longer disables the *input* while streaming (only
  Send). That's a deliberate UX upgrade (type the next message while the
  coach replies) — flag in QA so it's not mistaken for a bug.

**Exit criteria:** send, mic→transcript→send, keyboard behavior, disabled
states all work; cancel-while-streaming works (new).

### Phase 3 — Message list (~1.5–2 days)

Rewrite `coach-message-list.tsx` on primitives, porting all existing styles:

```tsx
<ThreadPrimitive.Root style={styles.flex}>
  <AuiIf condition={(s) => s.thread.isEmpty}>
    <EmptyState>                       {/* existing visuals */}
      {STARTER_PROMPTS.map((p) => (
        <ThreadPrimitive.Suggestion key={p} prompt={p} send>
          {/* existing chip */}
        </ThreadPrimitive.Suggestion>
      ))}
    </EmptyState>
  </AuiIf>
  <ThreadPrimitive.Messages
    contentContainerStyle={existingListStyles}
    maintainVisibleContentPosition={{ minIndexForVisible: 0, autoscrollToTopThreshold: 10 }}
  >
    {({ message }) =>
      message.role === "user" ? <UserMessage /> : <AssistantMessage />
    }
  </ThreadPrimitive.Messages>
</ThreadPrimitive.Root>
```

`AssistantMessage` keeps the sparkle/“Coach” meta row and bubble container,
with parts rendered through the runtime:

```tsx
<MessagePrimitive.Root>
  <MetaRow />                          {/* sparkle + "Coach", ported */}
  <View style={bubbleStyles.assistantBubble}>
    <MessagePrimitive.Parts>
      {({ part }) => {
        if (part.type === "text")
          return <Markdown style={markdownStyles}>{part.text}</Markdown>;
        if (part.type === "tool-call")
          return (
            <ToolActivityLine
              label={(part.args as { label?: string }).label ?? part.toolName.replace(/_/g, " ")}
              running={part.status.type === "running"}
              done={part.status.type === "complete"}
            />
          );
        return null;
      }}
    </MessagePrimitive.Parts>
  </View>
</MessagePrimitive.Root>
```

Mapping notes:

- **Tool state translation.** AI SDK part states map to assistant-ui statuses:
  `input-streaming`/`input-available` → `status.type === "running"`,
  `output-available` → `"complete"`, errors → `"incomplete"`. The
  `isStaticToolUIPart`/`getToolName` imports from `ai` are deleted.
- **Type caveat:** assistant-ui types `part.args` as `ReadonlyJSONObject`, so
  the `CoachUITools`-inferred typing of `input.label` is lost at this boundary.
  Add a small typed helper (`getToolLabel(part)`) that narrows against the
  contract types so the cast lives in one place.
- **Loading shimmer:** the "no content yet" `ActivityIndicator` is reproduced
  by checking `parts` length via `useAuiState((s) => s.message)` or rendering
  it from the synthetic empty-text part assistant-ui emits while running.
- **Error + retry:** keep `ErrorBubble` exactly as-is, fed by `chat.error` and
  `chat.regenerate` from the `useChat` instance we still own.
- **Markdown selectable behavior (NUI-14)** ports unchanged — we keep
  `react-native-markdown-display` and `markdownStyles`.

**LegendList → FlatList tradeoff.** `ThreadPrimitive.Messages` is
FlatList-based. Two options, in order of preference:

1. **Adopt FlatList** (default). The thread is single-conversation and
   moderate length; FlatList + `maintainVisibleContentPosition` likely lets us
   delete the brittle scroll-pinning workarounds in `coach.tsx:155-209`
   (staggered timeouts, `shouldPinInitialHistoryRef`, `onContentSizeChange`
   settling). Keep the `keyboardDidShow` → scrollToEnd listener.
2. **Fallback: keep LegendList.** If history-hydration pinning or long-thread
   perf regresses, render LegendList ourselves over
   `useAuiState((s) => s.thread.messages)` and wrap each row in
   `MessageByIndexProvider` so `MessagePrimitive.*` still works inside rows.
   This is a supported escape hatch in the RN package.

**Exit criteria:** visual parity screenshot-diff vs `main` (user bubble,
assistant bubble, tool lines, markdown, empty state); history hydration lands
scrolled to the latest message on a physical device; streaming auto-scrolls.

### Phase 4 — Cleanup & wiring polish (~0.5 day)

- Delete dead code: `draft` state, `handleSend`, `handleStarterPress`,
  `canSend`, scroll-pinning refs/effects made obsolete in Phase 3,
  `isStaticToolUIPart`/`getToolName` imports.
- Clear conversation: keep the mutation; on success call `chat.setMessages([])`
  (unchanged — we still own the chat instance).
- Update `components/coach/index.ts` exports.
- Add a basic Bun test for the tool-label/status mapping helper (currently the
  coach feature has zero tests).

**Exit criteria:** `bun tsc --noEmit` clean, no unused exports, test passing.

## 6. Risk register

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| `@assistant-ui/react-native` is newer than the web package; primitive API gaps on RN | Medium | Phase 0/1 are throwaway-cheap; validate `ThreadPrimitive.Messages` + `ComposerPrimitive.Input` on device before committing to Phase 3. Escape hatch: `useAuiState` + custom rendering everywhere a primitive falls short. |
| Scroll/hydration regressions moving off LegendList | Medium | Explicit fallback path (§5 Phase 3, option 2). Test on physical iOS + Android with a long hydrated history. |
| `useAISDKRuntime` + RN provider type friction (runtime built by web-adapter package, provider from RN package) | Low | Both share `@assistant-ui/core`; the official Expo example uses exactly this pairing (`useChatRuntime` variant). Verify in Phase 1. |
| `setMessages()` hydration racing the runtime's view of the thread | Low | Same mechanism as today; hydration happens before first render of messages (gated by `historyHydrated`). Verify branch/edit features stay unused (we don't enable them). |
| Loss of `CoachUITools` static typing on tool parts | Certain (minor) | Single typed helper narrowing `part.args`; contracts package remains source of truth. |
| `react-native-keyboard-controller` interplay with composer auto-focus behaviors | Low | RN `ComposerPrimitive.Input` is a thin TextInput wrapper; keep our `KeyboardAvoidingView` setup unchanged. |
| Library churn (assistant-ui pre-1.0 in places, `unstable_`/`AuiIf` APIs) | Medium | Pin exact versions; avoid `unstable_*` APIs; we only depend on stable primitives + `useAui`/`useAuiState`. |

## 7. Deferred / follow-up opportunities (not in this migration)

- **DictationAdapter:** wrap `useCoachVoiceInput` (expo-audio +
  `/api/transcribe`) in assistant-ui's `DictationAdapter` interface to get
  `ComposerPrimitive.Dictate`/`StopDictation` + live transcript preview.
  Requires `useChatRuntime` (adapter slot) or local runtime — revisit after
  the base migration.
- **`useChatRuntime` + `ThreadHistoryAdapter`:** move history off the manual
  `setMessages` flow into the adapter (`withFormat`) once/if the backend can
  serve `{ id, parent_id, format, content }` rows. Unlocks message editing,
  regeneration UI, and branching.
- **Multi-thread / AssistantCloud:** the coach is single-thread today; the
  runtime makes threads a config change later, not a rewrite.
- **Suggestions from the runtime:** server-driven follow-up suggestions via
  the `suggestions` field once the backend emits them.
- **Markdown upgrade:** assistant-ui's RN markdown package
  (`@assistant-ui/react-native-markdown` / Ink variants) if we ever want
  streaming-aware markdown; current library is fine.

## 8. Verification plan

Per-phase exit criteria above, plus a final pass on physical iOS + Android:

1. Cold start with existing history → lands scrolled to latest message.
2. Send a message → user bubble appears instantly, assistant streams in,
   markdown renders, auto-scroll follows.
3. Ask a tool-triggering question ("How am I doing this week?") → tool
   activity lines show spinner → checkmark → answer text.
4. Cancel mid-stream (new) → stream stops cleanly, can send again.
5. Mic → record → transcript fills composer → send.
6. Empty state → tap starter prompt → sends immediately.
7. Force a network error → ErrorBubble with working Retry.
8. Clear conversation → empty state with starter prompts; server history gone
   on reload.
9. Keyboard open/close → composer stays visible, list re-pins to bottom.
10. Web target (`expo start --web`) still builds and functions.

## 9. Estimate & rollback

- **Total: ~4–5 dev-days** including device QA.
- Phases land as independent commits on this branch; any phase can be reverted
  in isolation. Phase 1 alone (provider + runtime, no UI change) is safe to
  merge early to de-risk the dependency addition.

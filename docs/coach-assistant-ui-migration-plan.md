# Coach Chat → assistant-ui (React Native) Migration Plan

**Status:** Proposal / pre-implementation
**Date:** 2026-06-09
**Branch:** `claude/focused-bardeen-83hlo4`
**Target library:** [`@assistant-ui/react-native`](https://www.assistant-ui.com/docs/react-native?platform=rn) (`v0.1.22`, published 2026-06-08)

---

## 1. Goal

Replace the hand-rolled coach chat UI (built on `@ai-sdk/react`'s `useChat` +
custom `LegendList`/bubble/composer components) with assistant-ui's React Native
primitives, while preserving the existing backend contract, design language, and
the coach-specific features (voice input, profile, tool-activity display,
history hydration, clear-conversation).

---

## 2. What assistant-ui RN actually gives us

Findings from the docs and package metadata (the docs site blocks automated
fetches, so this is corroborated from the npm registry, the package source, and
the official blog/landing page):

- **Package:** `@assistant-ui/react-native` — a *separate* native package, not a
  wrapper around the web `@assistant-ui/react`. Real native primitives
  (`View`, `Pressable`, `Text`, `FlatList`), no WebView.
- **Maturity:** `0.1.22`, first published **2026-06-08** (one day before this
  plan). It is pre-1.0 and brand new. **This is the single biggest risk in the
  migration** — see §7.
- **Core building blocks:**
  - `AssistantRuntimeProvider` — context provider that owns chat state.
  - `useLocalRuntime(adapter)` with a `ChatModelAdapter` (`async *run({ messages })`)
    for client-driven runtimes.
  - Native primitives: `Thread`, `Composer`, `Message`, `ThreadList`.
- **Runtime architecture is shared with web:** built on `@assistant-ui/core`,
  `@assistant-ui/store`, `@assistant-ui/tap`, `assistant-stream`, `zustand`.
  Adapters (incl. AI SDK / LangGraph) are designed to be portable across the
  web / RN / Ink renderers.
- **Advertised features:** streaming, tool calls, message branching, thread
  management, attachments. Full Expo support.
- **Peer deps:** `react ^18 || ^19`, `react-native *` — compatible with our
  React 19.1 / RN 0.81.5.

### The critical unknown: AI SDK v6 wiring in RN

Our backend is an **AI SDK v6 data-stream** endpoint (`/api/coach/chat`) and our
message type is an AI SDK v6 `UIMessage` (`CoachUIMessage`). On the web,
assistant-ui consumes AI SDK via `@assistant-ui/react-ai-sdk`
(`useChatRuntime`). However:

- `@assistant-ui/react-ai-sdk` (`v1.3.x`) declares a peer dependency on
  **`@assistant-ui/react`** (the web package, `^0.5.56`) and **`ai ^3.2.x`** —
  *not* on `@assistant-ui/react-native` (`0.1.x` / core `0.2.x`) or `ai ^6`.
- It is therefore **unconfirmed** that `useChatRuntime` runs unchanged under the
  RN runtime, and the version ranges do not obviously line up.

**Implication:** we cannot assume drop-in AI SDK v6 support. The two realistic
integration paths are:

- **Path A — official AI SDK adapter** *(if it works under RN at compatible
  versions)*: use `@assistant-ui/react-ai-sdk`'s runtime hook, point its
  transport at `/api/coach/chat`, inject Clerk auth + `expo/fetch` like today.
- **Path B — custom `ChatModelAdapter`** *(fallback, most likely needed)*: write
  a thin adapter whose `run()` calls our existing streaming transport (reusing
  the `expo/fetch` + Clerk-bearer + AI-SDK-stream-parsing we already have via
  `ai`/`@ai-sdk/react`) and yields assistant-ui message chunks. This keeps the
  backend untouched and isolates assistant-ui from the network layer.

**A spike to determine A vs. B is the first task of this migration (§5, Phase 0)
and gates everything else.**

---

## 3. Current implementation inventory (what we're replacing / keeping)

| Area | Current implementation | Migration disposition |
|---|---|---|
| Chat state | `useChat<CoachUIMessage>` (`@ai-sdk/react`) + `DefaultChatTransport` (`expo/fetch`, Clerk bearer header, `body.timezone`) → `/api/coach/chat` | **Replace** with assistant-ui runtime (Path A or B) |
| Message type | `CoachUIMessage` = AI SDK v6 `UIMessage` w/ 9 typed tools (`query_meals`, `compare_periods`, `save_user_fact`, … each with `input.label`) — `@voicefit/contracts/coach` | **Keep contract**; map to assistant-ui message shape at the adapter boundary |
| History load | react-query `["coach-messages"]` → `/api/coach/messages`, hydrated via `setMessages` | **Keep fetch**; feed into runtime as initial messages |
| Clear convo | react-query mutation → `/api/coach/clear`, then `setMessages([])` | **Keep**; call runtime reset instead of `setMessages([])` |
| Message list | `CoachMessageList` — `LegendList`, custom user/assistant bubbles, **tool-activity lines** (spinner/check + `input.label`), markdown via `react-native-markdown-display`, empty state w/ starter prompts, scroll-pinning + keyboard re-pin logic | **Rebuild** on `Thread`/`Message` primitives + custom render slots; **port tool-activity + markdown rendering** |
| Composer | `CoachComposer` — `TextInput`, mic button, send button, haptics, streaming/disabled states | **Rebuild** on `Composer` primitive, keep mic affordance + haptics |
| Voice input | `useCoachVoiceInput` (expo-audio → `/api/transcribe`) fills the draft text | **Keep hook as-is**; wire its transcript into the assistant-ui composer's input value |
| Header | `CoachHeader` — bespoke sparkle-orb header + dropdown menu (Edit profile / Clear) | **Keep unchanged** (not a chat primitive) |
| Profile | `CoachProfileForm` in a `Modal`, `useCoachProfile` | **Keep unchanged** |
| Theming | `@/lib/tokens`, `font`, `radius`, NUI design-system rules (continuous corners, boxShadow, haptics, selectable text) | **Keep**; assistant-ui RN uses `StyleSheet`, so re-apply our tokens to its primitives |
| Error UI | `ErrorBubble` with retry → `regenerate()` | **Rebuild** on assistant-ui error/reload affordance |

Files in scope:
- `app/coach.tsx` (orchestrator)
- `components/coach/coach-message-list.tsx`
- `components/coach/coach-composer.tsx`
- `components/coach/coach-header.tsx` *(keep)*
- `components/coach/index.ts`
- `hooks/use-coach-voice-input.ts` *(keep)*
- `hooks/use-coach-profile.ts` *(keep)*

---

## 4. Risks & open questions

1. **Library maturity (high).** `0.1.x`, one day old. Expect API churn, gaps,
   and bugs. Pin the exact version. Be ready to fall back to the current
   implementation.
2. **AI SDK v6 integration (high).** See §2. Unconfirmed that the official
   adapter works under RN at our versions; Path B (custom adapter) is the likely
   reality and adds work.
3. **Tool-call rendering (medium).** Our UX shows a live "tool activity" line
   using the tool's typed `input.label`. We must confirm assistant-ui surfaces
   in-progress tool parts with their input, and that we can render them with our
   styling.
4. **Message-shape mapping (medium).** `CoachUIMessage` `parts[]` (text +
   typed tool parts) must map cleanly to assistant-ui's message model and back,
   without losing tool state (`input-streaming` → `output-available`).
5. **List virtualization & scroll (medium).** assistant-ui's `Thread` uses
   `FlatList`; our current `LegendList` carries a lot of hard-won scroll-pinning
   / keyboard-re-pin / history-hydration behavior. We may lose or have to
   re-implement that polish.
6. **Markdown (low/medium).** Confirm whether assistant-ui RN ships a markdown
   renderer or if we keep `react-native-markdown-display` inside a custom message
   slot.
7. **Streaming on RN (low).** Already solved today via `expo/fetch` +
   `@stardazed/streams-text-encoding`; reuse it under the adapter.
8. **Bundle / dependency tree (low).** Adds `@assistant-ui/*` + `zustand` +
   `assistant-stream`. We already pull `@tanstack/react-query`; no conflict
   expected.

---

## 5. Phased migration plan

### Phase 0 — De-risking spike (gate) ⛏️
Goal: answer "Path A or Path B?" and "can it render our tools + markdown + our
theme?" **before** committing to the rewrite.
- Add `@assistant-ui/react-native` (pin `0.1.22`). Attempt to add
  `@assistant-ui/react-ai-sdk` and check whether it resolves/runs against the RN
  runtime + `ai ^6` (Path A). If not, prototype a custom `ChatModelAdapter`
  (Path B).
- Stand up a throwaway screen (`app/coach-aui-spike.tsx`, dev-only) that:
  streams one real `/api/coach/chat` turn with Clerk auth, renders a tool call,
  renders markdown, and applies one of our design tokens.
- **Exit criteria:** streaming + a tool-activity line + markdown render on a
  device/simulator with our auth. Decide Path A vs B. If neither works
  acceptably, **stop and report** rather than proceeding.

### Phase 1 — Runtime + provider behind a feature flag
- Introduce the chosen runtime (`useLocalRuntime` w/ adapter, or AI SDK runtime)
  and wrap the coach screen in `AssistantRuntimeProvider`.
- Wire: Clerk bearer header, `expo/fetch`, `body.timezone`, `/api/coach/chat`.
- Feed history from the existing react-query `/api/coach/messages` query as the
  runtime's initial messages; wire `/api/coach/clear` to a runtime reset.
- Gate the new screen behind a flag (e.g. `EXPO_PUBLIC_COACH_AUI` /
  remote/dev flag) so the current screen stays the default until parity is met.

### Phase 2 — Thread + Message UI parity
- Rebuild the message list on `Thread`/`Message` primitives.
- Port: user/assistant bubble styling (tokens, continuous corners), the
  **tool-activity line** (spinner/check + `input.label`), markdown rendering,
  the empty state + starter prompts, the assistant "thinking" loader.
- Re-establish auto-scroll-to-latest + keyboard re-pin + initial-history pin
  behavior (or accept the primitive's built-in behavior if good enough).

### Phase 3 — Composer + voice + errors
- Rebuild the composer on the `Composer` primitive: mic button, send button,
  haptics (`@/lib/haptics`), streaming/disabled states, multiline, placeholder.
- Wire `useCoachVoiceInput` transcript into the composer's input value + focus.
- Port error display + retry/reload affordance (replacing `ErrorBubble` +
  `regenerate`).

### Phase 4 — Keep-as-is integration
- Re-attach the existing `CoachHeader` (orb + dropdown menu), the profile
  `Modal` + `CoachProfileForm`, and `useCoachProfile` around the new chat body.
- Verify SafeArea + `KeyboardAvoidingView` (keyboard-controller) layout still
  holds with the new `Thread`.

### Phase 5 — Validation & cutover
- `bun run typecheck` clean; manual device test matrix below.
- A/B against the current screen via the flag; confirm visual + behavioral
  parity (esp. tool streaming, history hydration, clear, voice, scroll).
- Flip the flag default → new screen. Keep old components for one release as a
  rollback path, then delete in a follow-up.

---

## 6. Test / acceptance matrix

- [ ] Fresh thread: empty state + starter prompts render; tapping a prompt sends.
- [ ] Streaming: assistant text streams token-by-token; loader shows before first token.
- [ ] Tool calls: activity line shows `input.label`, transitions spinner → check.
- [ ] Markdown: bold/headings/lists/paragraphs match current styling; text selectable (NUI-14).
- [ ] History: prior messages hydrate from `/api/coach/messages` and the list pins to latest.
- [ ] Clear conversation: empties thread + clears cache; profile/facts retained.
- [ ] Voice: record → transcribe → fills composer → focus; haptics fire.
- [ ] Keyboard: opening composer re-pins to latest; layout doesn't jump.
- [ ] Error path: backend error shows message + working retry/reload.
- [ ] Auth: Clerk token attached on every turn; `timezone` body present.
- [ ] iOS + Android, light theme/tokens; typecheck passes.

---

## 7. Recommendation

Proceed **only through Phase 0 first**, behind a feature flag, treating the
result as a go/no-go gate. The library is genuinely promising and architecturally
aligned (shared runtime, real native primitives, AI-SDK-oriented), but it is
**one day old at `0.1.x`**, and the **AI SDK v6 ↔ RN integration path is
unverified**. Do not delete any current coach code until the new screen reaches
full parity behind the flag and ships one release cleanly.

If the Phase 0 spike shows the AI SDK adapter doesn't work under RN and the
custom-adapter path is awkward, the pragmatic call may be to **wait for a more
mature release** and revisit — that outcome should be reported, not worked
around.

---

## 8. Sources

- assistant-ui React Native docs (referenced; site blocks automated fetch):
  <https://www.assistant-ui.com/docs/react-native?platform=rn>
- assistant-ui for React Native (landing): <https://www.assistant-ui.com/native>
- Launch Week — multi-platform: <https://www.assistant-ui.com/blog/2026-03-launch-week>
- AI SDK v6 runtime docs: <https://www.assistant-ui.com/docs/runtimes/ai-sdk/v6>
- `@assistant-ui/react-native` on npm (v0.1.22): <https://www.npmjs.com/package/@assistant-ui/react-native>
- `@assistant-ui/react-ai-sdk` on npm: <https://www.npmjs.com/package/@assistant-ui/react-ai-sdk>

import type { Chat } from "@ai-sdk/react";
import type { CoachUIMessage } from "@voicefit/contracts/coach";

type CoachSession = { chat: Chat<CoachUIMessage>; hydrated: boolean };
const sessions = new WeakMap<object, CoachSession>();

// The account-scoped QueryClient owns this session. Navigating away keeps a
// streamed reply alive; changing accounts creates an entirely separate chat.
export function getCoachSession(owner: object, create: () => Chat<CoachUIMessage>) {
  let session = sessions.get(owner);
  if (!session) {
    session = { chat: create(), hydrated: false };
    sessions.set(owner, session);
  }
  return session;
}

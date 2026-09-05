import { expect, test } from "bun:test";
import { Chat } from "@ai-sdk/react";
import type { UIMessageChunk } from "ai";
import type { CoachUIMessage } from "@voicefit/contracts/coach";
import { getCoachSession } from "../coach-session";

test("returning to coach keeps the ongoing reply; another account has a separate session", async () => {
  const owner = {};
  let stream!: ReadableStreamDefaultController<UIMessageChunk>;
  const session = getCoachSession(owner, () => new Chat<CoachUIMessage>({
    transport: {
      sendMessages: async () => new ReadableStream<UIMessageChunk>({ start(controller) { stream = controller; } }),
      reconnectToStream: async () => null,
    },
  }));
  session.hydrated = true;
  const sending = session.chat.sendMessage({ text: "Audit test" });
  // Allow the SDK to start the transport before delivering server chunks.
  await new Promise((resolve) => setTimeout(resolve, 0));
  stream.enqueue({ type: "start", messageId: "reply-1" });
  stream.enqueue({ type: "text-start", id: "text-1" });
  stream.enqueue({ type: "text-delta", id: "text-1", delta: "Hello" });
  const reopened = getCoachSession(owner, () => { throw new Error("Must reuse the chat"); });
  expect(reopened).toBe(session);
  expect(reopened.hydrated).toBe(true);
  stream.enqueue({ type: "text-delta", id: "text-1", delta: " again" });
  stream.enqueue({ type: "text-end", id: "text-1" });
  stream.enqueue({ type: "finish" });
  stream.close();
  await sending;
  expect(reopened.chat.messages[1].parts).toContainEqual({ type: "text", text: "Hello again", state: "done" });
  const other = getCoachSession({}, () => new Chat<CoachUIMessage>({}));
  expect(other.chat.messages.length).toBe(0);
  expect(other.hydrated).toBe(false);
});

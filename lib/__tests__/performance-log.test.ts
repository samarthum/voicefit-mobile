import { expect, test } from "bun:test";
import { getTimings, recordTiming, timingRoute } from "../performance-log";
import { TimedCoachTransport } from "../timed-chat-transport";

test("timings redact host, identifiers, search text and query secrets", () => {
  expect(timingRoute("https://private.example/api/meals/private-user-id?token=secret&text=private")).toBe("/api/meals/:id");
  expect(timingRoute("/api/workout-sessions/private-session-id")).toBe("/api/workout-sessions/:id");
});

test("coach timing wrapper preserves the stream and records no message text", async () => {
  const oldDev = globalThis.__DEV__;
  const oldInfo = console.info;
  globalThis.__DEV__ = true;
  console.info = () => undefined;
  const before = getTimings().length;
  const chunks = [
    { type: "start", messageId: "private-id" },
    { type: "text-start", id: "private-part" },
    { type: "text-delta", id: "private-part", delta: "private workout context" },
    { type: "text-end", id: "private-part" },
    { type: "finish" },
  ];
  try {
    const transport = new TimedCoachTransport({
      api: "https://example.invalid/api/coach/chat",
      fetch: (async () => new Response(chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("") + "data: [DONE]\n\n", { headers: { "Content-Type": "text/event-stream" } })) as typeof fetch,
    });
    const stream = await transport.sendMessages({ trigger: "submit-message", chatId: "private-id", messageId: undefined, messages: [], abortSignal: new AbortController().signal });
    const reader = stream.getReader();
    const received = [];
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      received.push(next.value);
    }
    expect(received).toEqual(chunks);
    const records = getTimings().slice(before);
    expect(records.map((record) => record.kind)).toEqual(["coach-first-text", "coach-complete"]);
    expect(JSON.stringify(records).includes("private")).toBe(false);
    recordTiming({ kind: "api", route: "/api/meals/private-id", method: "GET", outcome: "success", durationMs: 1, ...{ unexpectedPayload: "private context" } });
    expect(JSON.stringify(getTimings().slice(before)).includes("private")).toBe(false);
  } finally { globalThis.__DEV__ = oldDev; console.info = oldInfo; }
});

test("release diagnostics are opt-in and preserve token results without recording them", async () => {
  const { measureToken } = await import("../performance-log");
  const oldDev = globalThis.__DEV__;
  const oldFlag = process.env.EXPO_PUBLIC_DIAGNOSTICS;
  globalThis.__DEV__ = false;
  try {
    delete process.env.EXPO_PUBLIC_DIAGNOSTICS;
    const before = getTimings().length;
    expect(await measureToken("/api/dashboard", async () => "private-token")).toBe("private-token");
    expect(getTimings().length).toBe(before);
    process.env.EXPO_PUBLIC_DIAGNOSTICS = "1";
    expect(await measureToken("/api/dashboard", async () => "private-token")).toBe("private-token");
    expect(getTimings().at(-1)?.kind).toBe("auth-token");
    expect(getTimings().at(-1)?.outcome).toBe("success");
    expect(JSON.stringify(getTimings()).includes("private-token")).toBe(false);
    const failure = new Error("private failure detail");
    const caught = await measureToken("/api/dashboard", async () => { throw failure; }).catch((error) => error);
    expect(caught).toBe(failure);
    expect(getTimings().at(-1)?.outcome).toBe("error");
    expect(JSON.stringify(getTimings()).includes("private failure detail")).toBe(false);
  } finally {
    globalThis.__DEV__ = oldDev;
    if (oldFlag === undefined) delete process.env.EXPO_PUBLIC_DIAGNOSTICS;
    else process.env.EXPO_PUBLIC_DIAGNOSTICS = oldFlag;
  }
});

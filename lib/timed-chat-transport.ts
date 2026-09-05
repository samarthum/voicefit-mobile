import { DefaultChatTransport, type UIMessageChunk } from "ai";
import type { CoachUIMessage } from "@voicefit/contracts/coach";
import { monotonicNow, recordTiming } from "@/lib/performance-log";

export class TimedCoachTransport extends DefaultChatTransport<CoachUIMessage> {
  async sendMessages(options: Parameters<DefaultChatTransport<CoachUIMessage>["sendMessages"]>[0]) {
    if (typeof __DEV__ === "undefined" || !__DEV__) return super.sendMessages(options);
    const started = monotonicNow();
    let firstText = false;
    let finished = false;
    const finish = (outcome: "success" | "error" | "cancelled") => {
      if (finished) return;
      finished = true;
      recordTiming({ kind: "coach-complete", route: "/api/coach/chat", method: "POST", outcome, durationMs: monotonicNow() - started });
    };
    try {
      const upstream = await super.sendMessages(options);
      const reader = upstream.getReader();
      return new ReadableStream<UIMessageChunk>({
        async pull(controller) {
          try {
            const next = await reader.read();
            if (next.done) { finish("success"); controller.close(); return; }
            if (!firstText && next.value.type === "text-delta" && next.value.delta.length > 0) {
              firstText = true;
              recordTiming({ kind: "coach-first-text", route: "/api/coach/chat", method: "POST", outcome: "success", durationMs: monotonicNow() - started });
            }
            if (next.value.type === "error") finish("error");
            controller.enqueue(next.value);
          } catch (error) {
            finish(options.abortSignal?.aborted ? "cancelled" : "error");
            controller.error(error);
          }
        },
        async cancel(reason) { finish("cancelled"); await reader.cancel(reason); },
      });
    } catch (error) {
      finish(options.abortSignal?.aborted ? "cancelled" : "error");
      throw error;
    }
  }
}

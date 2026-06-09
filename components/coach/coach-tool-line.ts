// Pure mapping helpers between assistant-ui tool-call parts and the coach
// ToolActivityLine UI. assistant-ui types tool args as ReadonlyJSONObject, so
// the CoachUITools-inferred typing of `input.label` is lost at that boundary —
// this is the one place that narrows it back.

export type ToolLineState = "running" | "done" | "pending";

/**
 * Human-readable label for a coach tool call. The backend puts a friendly
 * `label` into every tool's input; fall back to the tool name otherwise.
 */
export function getCoachToolLabel(toolName: string, args: unknown): string {
  if (typeof args === "object" && args !== null) {
    const label = (args as { label?: unknown }).label;
    if (typeof label === "string" && label.trim().length > 0) {
      return label;
    }
  }
  return toolName.replace(/_/g, " ");
}

/**
 * Maps an assistant-ui part status (`running` | `complete` | `incomplete` |
 * `requires-action`) onto the three visual states of ToolActivityLine:
 * accent spinner, checkmark, or muted spinner.
 */
export function getToolLineState(statusType: string): ToolLineState {
  if (statusType === "complete") return "done";
  if (statusType === "running") return "running";
  return "pending";
}

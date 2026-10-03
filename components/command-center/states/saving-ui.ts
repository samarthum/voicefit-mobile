import type { CommandCenterSnapshot, CommandState } from "@/components/command-center/types";

export function isSavingState(state: CommandState) {
  return state === "cc_saving" || state === "cc_auto_saving" || state === "cc_quick_add_saving";
}

// Frozen uncertain writes remain read-only until the original is reconciled.
// Pre-write validation failures still offer the controller's Edit entry action.
export function isReviewLocked(snapshot: CommandCenterSnapshot) {
  return isSavingState(snapshot.state) || snapshot.state === "cc_saved" ||
    (snapshot.state === "cc_error" && snapshot.error.subtype === "auto_save_failure");
}

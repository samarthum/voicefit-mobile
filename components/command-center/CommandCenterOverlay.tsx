import type { ReactNode } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetFooter,
  type BottomSheetFooterProps,
  BottomSheetModal,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { useCommandCenterOverlay } from "@/components/command-center/CommandCenterProvider";
import { SheetShell } from "@/components/command-center/states/SheetShell";
import { IdleState } from "@/components/command-center/states/IdleState";
import { PhotoState } from "@/components/command-center/states/PhotoState";
import { PhotoSourceState } from "@/components/command-center/states/PhotoSourceState";
import { RecordingState } from "@/components/command-center/states/RecordingState";
import { InterpretingState } from "@/components/command-center/states/InterpretingState";
import { WorkoutReviewState } from "@/components/command-center/states/WorkoutReviewState";
import { ReviewActionsFooter } from "@/components/command-center/states/ReviewActionsFooter";
import { isSavingState } from "@/components/command-center/states/saving-ui";

import { ErrorState } from "@/components/command-center/states/ErrorState";

import { color as t, font } from "@/lib/tokens";

// ---------------------------------------------------------------------------
// Main Overlay Component
// ---------------------------------------------------------------------------

// Saving stays in the action surface; the review never changes detent.
const REVIEW_SNAP_POINTS = ["92%"];
// Recording and the voice hand-off are a single focused moment; a short sheet
// keeps the dashboard visible behind it instead of a mostly-empty 92% panel.
const VOICE_SHEET_CONTENT_HEIGHT = 452;
// The hand-off after Done is only a status line and the transcript.
const VOICE_PROGRESS_SHEET_HEIGHT = 300;
// The photo source choice is two rows; size the sheet to them.
const PHOTO_SOURCE_SHEET_HEIGHT = 292;
// How long the "Got it" check stays up before the sheet slides away.
const VOICE_SUCCESS_HOLD_MS = 900;

export function CommandCenterOverlay() {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  const { snapshot, dispatch, showSavedFeedback, photoSourceChoice } = useCommandCenterOverlay();

  const { state: commandState, review: reviewDraft, error, toast, input } = snapshot;
  const isSaving = isSavingState(commandState);
  // A voice capture with nothing left for the user to decide: no review draft,
  // no photo, and the words came from the transcript rather than the keyboard.
  const isVoiceCapture = !reviewDraft && !input.selectedMealPhoto && !input.text.trim() && !!input.voiceTranscript.trim();
  const isVoiceProgress =
    commandState === "cc_transcribing_voice" ||
    commandState === "cc_interpreting_voice" ||
    ((isSaving || commandState === "cc_saved") && isVoiceCapture);
  const compactHeight = photoSourceChoice
    ? PHOTO_SOURCE_SHEET_HEIGHT
    : commandState === "cc_recording"
    ? VOICE_SHEET_CONTENT_HEIGHT
    : isVoiceProgress
    ? VOICE_PROGRESS_SHEET_HEIGHT
    : null;
  const snapPoints = compactHeight
    ? [Math.min(Math.round(windowHeight * 0.92), compactHeight + insets.bottom)]
    : REVIEW_SNAP_POINTS;
  const isVisible = commandState !== "cc_collapsed";
  const canCloseViaBackdrop =
    commandState === "cc_expanded_empty" || commandState === "cc_expanded_typing";
  const isReview = commandState === "cc_review_workout" ||
    (!!reviewDraft && (isSaving || (commandState === "cc_error" && error.subtype === "auto_save_failure")));
  const closeCommandCenter = useCallback(() => dispatch({ type: "close" }), [dispatch]);

  // gorhom owns presentation now. We drive it imperatively from the command
  // state machine: present the sheet for every "open" state except cc_saved
  // (which renders a nonmodal toast after dismissal), dismiss it otherwise. The
  // `programmaticDismissRef` flag lets `onDismiss` distinguish OUR dismiss()
  // calls (state transitions) from a user swipe/backdrop dismiss — only the
  // latter should reset the command state back to collapsed.
  const sheetRef = useRef<BottomSheetModal>(null);
  const lastSheetContent = useRef<ReactNode>(null);
  const [sheetDismissed, setSheetDismissed] = useState(true);
  const programmaticDismissRef = useRef(false);
  // Tracks whether we've actually presented the sheet so we never dismiss()
  // before the first present(). Without this, the effect's else-branch runs on
  // the initial collapsed mount and sets programmaticDismissRef = true; the
  // first real swipe/backdrop dismiss then gets treated as programmatic and
  // never syncs state back to collapsed, leaving the app "open" while the sheet
  // is closed (so later taps can't re-open it).
  const hasPresentedRef = useRef(false);
  // Voice saves hold the sheet open briefly on a success check so the hand-off
  // lands ("Got it") before the sheet slides away to the toast.
  // Tracked as "elapsed" (false by default) so the very first cc_saved render
  // already keeps the sheet up; a "holding" flag set from an effect would let
  // that first render dismiss the sheet before the hold began.
  const [voiceSuccessElapsed, setVoiceSuccessElapsed] = useState(false);
  const voiceSaved = commandState === "cc_saved" && isVoiceCapture;
  useEffect(() => {
    if (!voiceSaved) {
      setVoiceSuccessElapsed(false);
      return;
    }
    const timer = setTimeout(() => setVoiceSuccessElapsed(true), VOICE_SUCCESS_HOLD_MS);
    return () => clearTimeout(timer);
  }, [voiceSaved]);
  const shouldPresentSheet = isVisible && (commandState !== "cc_saved" || (voiceSaved && !voiceSuccessElapsed));
  // Match retained content and actions through acknowledgement dismissal.
  const lastSheetSnapPoints = useRef(snapPoints);
  const presentedSnapPoints = shouldPresentSheet
    ? (lastSheetSnapPoints.current = snapPoints)
    : lastSheetSnapPoints.current;
  const lastSheetHasFooter = useRef(false);
  const showReviewFooter = shouldPresentSheet
    ? (lastSheetHasFooter.current = isReview)
    : !sheetDismissed && lastSheetHasFooter.current;

  useEffect(() => {
    if (shouldPresentSheet) {
      setSheetDismissed(false);
      hasPresentedRef.current = true;
      sheetRef.current?.present();
    } else if (hasPresentedRef.current) {
      hasPresentedRef.current = false;
      programmaticDismissRef.current = true;
      sheetRef.current?.dismiss();
    }
  }, [shouldPresentSheet]);

  const handleSheetDismiss = useCallback(() => {
    hasPresentedRef.current = false;
    setSheetDismissed(true);
    showSavedFeedback?.();
    // Programmatic dismiss (state transition) — already handled by the reducer.
    if (programmaticDismissRef.current) {
      programmaticDismissRef.current = false;
      return;
    }
    // User-initiated swipe/backdrop dismiss — keep app state in sync.
    closeCommandCenter();
  }, [closeCommandCenter, showSavedFeedback]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.55}
        pressBehavior={canCloseViaBackdrop ? "close" : "none"}
      />
    ),
    [canCloseViaBackdrop],
  );

  // Pinned DISCARD / Save footer for the review states. Lives in the sheet's
  // footer layer (not the scrolling body) so the actions never scroll out of
  // reach and always sit above the keyboard + safe area.
  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) =>
      showReviewFooter ? (
        <BottomSheetFooter {...props}>
          <ReviewActionsFooter />
        </BottomSheetFooter>
      ) : null,
    [showReviewFooter],
  );

  const renderContent = (): ReactNode => {
    if (photoSourceChoice) return <PhotoSourceState choose={photoSourceChoice.choose} onClose={closeCommandCenter} />;
    if (commandState === "cc_expanded_empty" || commandState === "cc_expanded_typing") {
      return (
        <SheetShell title="Log anything" onClose={closeCommandCenter} scrollable>
          <IdleState />
        </SheetShell>
      );
    }

    if (commandState === "cc_photo_context" || (!reviewDraft && !!snapshot.input.selectedMealPhoto &&
      (isSaving || (commandState === "cc_error" && error.subtype === "auto_save_failure")))) {
      return <PhotoState onClose={closeCommandCenter} />;
    }

    if (isVoiceProgress) {
      return <InterpretingState />;
    }

    // Typed entries stay in the editor while they send, with the busy state
    // on the send button, instead of swapping to a separate screen.
    if (commandState === "cc_submitting_typed") {
      return (
        <SheetShell title="Log anything" onClose={closeCommandCenter} showCloseButton={false} scrollable>
          <IdleState />
        </SheetShell>
      );
    }

    if (commandState === "cc_recording") {
      return <RecordingState onClose={closeCommandCenter} />;
    }

    if (isReview && reviewDraft?.kind === "workout") {
      return <WorkoutReviewState />;
    }

    if (isSaving || (commandState === "cc_error" && error.subtype === "auto_save_failure" && !reviewDraft)) {
      return (
        <SheetShell title="Log anything" onClose={closeCommandCenter} showCloseButton={false} scrollable>
          <IdleState />
        </SheetShell>
      );
    }

    if (commandState === "cc_error" && error.copy) {
      return <ErrorState onClose={closeCommandCenter} />;
    }

    // No active content (collapsed / cc_saved while the sheet animates closed).
    // Render a minimal BottomSheetView so dynamic sizing always has a measurable
    // child instead of a bare `null`.
    return (
      <BottomSheetView style={styles.sheetEmpty}>
        <View />
      </BottomSheetView>
    );
  };

  const toastNode = toast.message ? (
    <View style={styles.toastWrap} pointerEvents="none" testID="cc-toast">
      <Text style={styles.toastText}>{toast.message}</Text>
    </View>
  ) : null;

  return (
    <>
      <BottomSheetModal
        ref={sheetRef}
        topInset={insets.top}
        accessible={false}
        accessibilityRole="none"
        onDismiss={handleSheetDismiss}
        enableDynamicSizing={false}
        snapPoints={presentedSnapPoints}
        enablePanDownToClose={canCloseViaBackdrop}
        backdropComponent={renderBackdrop}
        footerComponent={renderFooter}
        backgroundStyle={styles.sheetBackground}
        handleStyle={styles.sheetHandleRow}
        handleIndicatorStyle={styles.sheetHandle}
        // Expand within the top safe-area boundary when the keyboard opens.
        // Interactive lift clips the title/close row on the fixed 92% sheet.
        keyboardBehavior="fillParent"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
      >
        {shouldPresentSheet ? (lastSheetContent.current = renderContent()) : lastSheetContent.current}
      </BottomSheetModal>
      {commandState !== "cc_saved" ? toastNode : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles (gorhom sheet chrome + inline toast only — all per-state styles
// have moved to their respective state files under states/)
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // gorhom-owned sheet chrome. The rounded top + border live on the
  // backgroundStyle; the handle row/indicator match the old hand-rolled look.
  sheetBackground: {
    backgroundColor: t.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderCurve: "continuous",
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: t.line,
  },
  sheetEmpty: { height: 1 },
  sheetHandleRow: { alignItems: "center", paddingTop: 10, paddingBottom: 14 },
  sheetHandle: { width: 40, height: 4, borderRadius: 999, backgroundColor: t.line2 },
  toastWrap: {
    position: "absolute",
    bottom: 136,
    alignSelf: "center",
    backgroundColor: t.accent,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  toastText: { fontFamily: font.sans[700], fontSize: 13, color: t.accentInk, fontWeight: "700" },
});

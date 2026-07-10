import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MealIngredient } from "@voicefit/contracts/types";
import {
  Alert,
  Modal,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
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
import { type IngredientEditorMode } from "@/components/command-center/IngredientEditor";
import { IngredientEditorSheet } from "@/components/command-center/IngredientEditorSheet";
import type { MealReviewIngredient } from "@/components/command-center/types";
import { SheetShell } from "@/components/command-center/states/SheetShell";
import { IdleState } from "@/components/command-center/states/IdleState";
import { PhotoState } from "@/components/command-center/states/PhotoState";
import { RecordingState } from "@/components/command-center/states/RecordingState";
import { InterpretingState } from "@/components/command-center/states/InterpretingState";
import { MealReviewState } from "@/components/command-center/states/MealReviewState";
import { WorkoutReviewState } from "@/components/command-center/states/WorkoutReviewState";
import { ReviewActionsFooter } from "@/components/command-center/states/ReviewActionsFooter";
import { SavingState } from "@/components/command-center/states/SavingState";
import { ErrorState } from "@/components/command-center/states/ErrorState";
import { SavedToastState } from "@/components/command-center/states/SavedToastState";
import { color as t, font } from "@/lib/tokens";

// ---------------------------------------------------------------------------
// Main Overlay Component
// ---------------------------------------------------------------------------

// Review states present at a fixed tall snap so the ingredient/set list scrolls
// within bounds and the action footer pins above the safe area. Every other
// state hugs its content via dynamic sizing.
const REVIEW_SNAP_POINTS = ["92%"];

export function CommandCenterOverlay() {
  const { snapshot, dispatch } = useCommandCenterOverlay();
  const { height: windowHeight } = useWindowDimensions();

  const { state: commandState, review: reviewDraft, error, toast } = snapshot;
  const isVisible = commandState !== "cc_collapsed";
  const canCloseViaBackdrop =
    commandState === "cc_expanded_empty" || commandState === "cc_expanded_typing";
  const isReview = commandState === "cc_review_meal" || commandState === "cc_review_workout";
  const closeCommandCenter = useCallback(() => dispatch({ type: "close" }), [dispatch]);

  // gorhom owns presentation now. We drive it imperatively from the command
  // state machine: present the sheet for every "open" state except cc_saved
  // (which renders its own RN-Modal toast), dismiss it otherwise. The
  // `programmaticDismissRef` flag lets `onDismiss` distinguish OUR dismiss()
  // calls (state transitions) from a user swipe/backdrop dismiss — only the
  // latter should reset the command state back to collapsed.
  const sheetRef = useRef<BottomSheetModal>(null);
  const programmaticDismissRef = useRef(false);
  // Tracks whether we've actually presented the sheet so we never dismiss()
  // before the first present(). Without this, the effect's else-branch runs on
  // the initial collapsed mount and sets programmaticDismissRef = true; the
  // first real swipe/backdrop dismiss then gets treated as programmatic and
  // never syncs state back to collapsed, leaving the app "open" while the sheet
  // is closed (so later taps can't re-open it).
  const hasPresentedRef = useRef(false);
  const shouldPresentSheet = isVisible && commandState !== "cc_saved";

  useEffect(() => {
    if (shouldPresentSheet) {
      hasPresentedRef.current = true;
      sheetRef.current?.present();
    } else if (hasPresentedRef.current) {
      hasPresentedRef.current = false;
      programmaticDismissRef.current = true;
      sheetRef.current?.dismiss();
    }
  }, [shouldPresentSheet]);

  const handleSheetDismiss = useCallback(() => {
    // Programmatic dismiss (state transition) — already handled by the reducer.
    if (programmaticDismissRef.current) {
      programmaticDismissRef.current = false;
      return;
    }
    // User-initiated swipe/backdrop dismiss — keep app state in sync.
    closeCommandCenter();
  }, [closeCommandCenter]);

  // Dynamic sizing capped near the old `maxHeight: "92%"` so short states
  // (idle/listening/interpreting/saving/error) hug their content while tall
  // review states scroll inside the cap.
  const maxDynamicContentSize = windowHeight * 0.92;

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
      isReview ? (
        <BottomSheetFooter {...props}>
          <ReviewActionsFooter />
        </BottomSheetFooter>
      ) : null,
    [isReview],
  );

  // Ingredient editor sheet state — local to the overlay because nothing else
  // needs to read it. The editor mounts as a second gorhom sheet on top of the
  // meal review so the user keeps the meal context visible behind a darkened
  // backdrop.
  const [ingredientEditor, setIngredientEditor] = useState<IngredientEditorMode | null>(null);

  // Auto-dismiss the editor if the review sheet itself goes away (user
  // discarded, navigated, etc.) so we don't leave a stale editor mounted.
  useEffect(() => {
    if (commandState !== "cc_review_meal" && ingredientEditor) {
      setIngredientEditor(null);
    }
  }, [commandState, ingredientEditor]);

  const openAddIngredientEditor = () => setIngredientEditor({ kind: "add" });
  const openEditIngredientEditor = (ingredient: MealReviewIngredient) =>
    setIngredientEditor({ kind: "edit", ingredient });
  const closeIngredientEditor = () => setIngredientEditor(null);

  const handleLongPressIngredient = (ingredient: MealReviewIngredient) => {
    Alert.alert(
      "Delete ingredient?",
      `Remove "${ingredient.name}" from this meal.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => dispatch({ type: "ingredient.remove", id: ingredient.id }),
        },
      ],
    );
  };

  const renderContent = (): ReactNode => {
    if (commandState === "cc_expanded_empty" || commandState === "cc_expanded_typing") {
      return (
        <SheetShell title="Log anything" onClose={closeCommandCenter} scrollable>
          <IdleState />
        </SheetShell>
      );
    }

    if (commandState === "cc_photo_context") {
      return <PhotoState onClose={closeCommandCenter} />;
    }

    if (
      commandState === "cc_submitting_typed" ||
      commandState === "cc_submitting_photo" ||
      commandState === "cc_transcribing_voice" ||
      commandState === "cc_interpreting_voice"
    ) {
      return <InterpretingState />;
    }

    if (commandState === "cc_recording") {
      return <RecordingState onClose={closeCommandCenter} />;
    }

    if (commandState === "cc_review_meal" && reviewDraft?.kind === "meal") {
      return (
        <MealReviewState
          onAddIngredient={openAddIngredientEditor}
          onEditIngredient={openEditIngredientEditor}
          onLongPressIngredient={handleLongPressIngredient}
        />
      );
    }

    if (commandState === "cc_review_workout" && reviewDraft?.kind === "workout") {
      return <WorkoutReviewState />;
    }

    if (
      commandState === "cc_saving" ||
      commandState === "cc_auto_saving" ||
      commandState === "cc_quick_add_saving"
    ) {
      return <SavingState onClose={closeCommandCenter} />;
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
        onDismiss={handleSheetDismiss}
        enableDynamicSizing={!isReview}
        maxDynamicContentSize={maxDynamicContentSize}
        snapPoints={isReview ? REVIEW_SNAP_POINTS : undefined}
        enablePanDownToClose={canCloseViaBackdrop}
        backdropComponent={renderBackdrop}
        footerComponent={renderFooter}
        backgroundStyle={styles.sheetBackground}
        handleStyle={styles.sheetHandleRow}
        handleIndicatorStyle={styles.sheetHandle}
        // Only the photo state needs fillParent: its input sits below a tall
        // image, so the sheet must fill the parent on keyboard to bring the
        // field above it. Every other state keeps the gentle interactive lift —
        // idle's input is already near the top, and fillParent there expands
        // the whole sheet to full height, which is jarring.
        keyboardBehavior={commandState === "cc_photo_context" ? "fillParent" : "interactive"}
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
      >
        {renderContent()}
      </BottomSheetModal>

      {/* The SavedToastState keeps its own RN Modal — it shows AFTER the bottom
          sheet dismisses, so there's no z-order conflict, and converting it
          is out of scope. */}
      {commandState === "cc_saved" ? (
        <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={closeCommandCenter}>
          <SavedToastState />
        </Modal>
      ) : null}

      {/* Ingredient editor — a gorhom sheet stacked over the meal review,
          shared with the meal-edit screen via IngredientEditorSheet. */}
      <IngredientEditorSheet
        mode={ingredientEditor}
        fetchInterpreted={(name, grams) =>
          dispatch({ type: "ingredient.lookup", name, grams }) as Promise<MealIngredient>
        }
        onSubmitAdd={(ingredient) => {
          dispatch({ type: "ingredient.add", ingredient });
          closeIngredientEditor();
        }}
        onSubmitEdit={(replacement) => {
          if (ingredientEditor?.kind !== "edit") return;
          const id = ingredientEditor.ingredient.id;
          // grams-only edit returns a MealReviewIngredient (already scaled
          // locally); rename returns an authoritative MealIngredient from the
          // LLM. Either works as a replacement input.
          dispatch({ type: "ingredient.replace", id, replacement });
          closeIngredientEditor();
        }}
        onClose={closeIngredientEditor}
      />
      {toastNode}
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

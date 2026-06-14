import { useCallback, useEffect, useRef } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import type { MealIngredient } from "@voicefit/contracts/types";
import { IngredientEditor, type IngredientEditorMode } from "@/components/command-center/IngredientEditor";
import type { MealReviewIngredient } from "@/components/command-center/types";
import { color as t } from "@/lib/tokens";

interface IngredientEditorSheetProps {
  /** Non-null presents the sheet; null dismisses it. */
  mode: IngredientEditorMode | null;
  fetchInterpreted: (name: string, grams?: number) => Promise<MealIngredient>;
  onSubmitAdd: (ingredient: MealIngredient) => void;
  onSubmitEdit: (replacement: MealIngredient | MealReviewIngredient) => void;
  /** Called when the editor should close (submit, cancel, swipe, backdrop). */
  onClose: () => void;
}

/**
 * The single host for `IngredientEditor`. Both the command-center meal review
 * and the meal-edit screen present the editor through this — so the editor
 * always lives inside a gorhom sheet (which is what `BottomSheetTextInput`
 * requires) instead of being hand-rolled into an RN Modal in each place.
 *
 * Presentation is driven by `mode`: set it to open, clear it to close.
 */
export function IngredientEditorSheet({
  mode,
  fetchInterpreted,
  onSubmitAdd,
  onSubmitEdit,
  onClose,
}: IngredientEditorSheetProps) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const { height } = useWindowDimensions();

  useEffect(() => {
    if (mode) sheetRef.current?.present();
    else sheetRef.current?.dismiss();
  }, [mode]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.55}
        pressBehavior="close"
      />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      onDismiss={onClose}
      enableDynamicSizing
      maxDynamicContentSize={height * 0.92}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.background}
      handleStyle={styles.handleRow}
      handleIndicatorStyle={styles.handle}
      // Short form (name + grams): interactive lifts the small sheet above the
      // keyboard without expanding it to full height.
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
    >
      {mode ? (
        <IngredientEditor
          mode={mode}
          fetchInterpreted={fetchInterpreted}
          onSubmitAdd={onSubmitAdd}
          onSubmitEdit={onSubmitEdit}
          onCancel={onClose}
        />
      ) : (
        <BottomSheetView style={styles.empty}>
          <View />
        </BottomSheetView>
      )}
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: t.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderCurve: "continuous",
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: t.line,
  },
  handleRow: { alignItems: "center", paddingTop: 10, paddingBottom: 14 },
  handle: { width: 40, height: 4, borderRadius: 999, backgroundColor: t.line2 },
  empty: { height: 1 },
});

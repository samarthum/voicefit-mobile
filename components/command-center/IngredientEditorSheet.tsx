import { useEffect, useRef } from "react";
import { Keyboard, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { KeyboardController } from "react-native-keyboard-controller";
import type { MealIngredient } from "@voicefit/contracts/types";
import { IngredientEditor, type IngredientEditorMode } from "@/components/command-center/IngredientEditor";
import type { EditableIngredient } from "@/components/command-center/ingredient-edit";
import type { MealReviewIngredient } from "@/components/command-center/types";
import { color as t, font } from "@/lib/tokens";

interface IngredientEditorModalProps<T extends EditableIngredient> {
  mode: IngredientEditorMode<T> | null;
  fetchInterpreted: (name: string, grams?: number) => Promise<MealIngredient>;
  onSubmitAdd: (ingredient: MealIngredient) => void;
  onSubmitEdit: (replacement: MealIngredient | T) => void;
  onClose: () => void;
}

/**
 * Full-screen native editor. The legacy export name keeps both callers and
 * saving-only seams compatible; this host has no bottom-sheet dependencies.
 * Each new mode object owns one consumed session, including its native Modal.
 */
export function IngredientEditorModal<T extends EditableIngredient = MealReviewIngredient>({
  mode, fetchInterpreted, onSubmitAdd, onSubmitEdit, onClose,
}: IngredientEditorModalProps<T>) {
  const sessionRef = useRef({ id: 0, mode, active: !!mode });
  if (sessionRef.current.mode !== mode) {
    sessionRef.current.active = false;
    sessionRef.current = { id: sessionRef.current.id + 1, mode, active: !!mode };
  }
  const session = sessionRef.current;
  const isSessionActive = () => session.active && sessionRef.current === session;
  useEffect(() => () => { sessionRef.current.active = false; }, []);

  const closeEditor = () => {
    if (!isSessionActive()) return;
    session.active = false;
    Keyboard.dismiss();
    onClose();
  };
  const requestClose = () => {
    if (!isSessionActive()) return;
    // Android routes Modal Back here, not to BackHandler. If the OS has not
    // already hidden the IME, only hide it; never close from a hide completion.
    if (KeyboardController.isVisible() || Keyboard.isVisible()) {
      Keyboard.dismiss();
      return;
    }
    closeEditor();
  };

  if (!mode) return null;
  return (
    <Modal key={session.id} visible animationType="none" presentationStyle="fullScreen"
      transparent={false} onRequestClose={requestClose} testID="cc-ingredient-editor-modal">
      <SafeAreaProvider>
        <SafeAreaView style={styles.screen}>
          <View style={styles.header}>
            <Pressable onPress={closeEditor} style={styles.close} accessibilityRole="button"
              accessibilityLabel="Cancel ingredient edit" testID="cc-ingredient-editor-close">
              <Text style={styles.closeText}>Cancel</Text>
            </Pressable>
            <Text style={styles.title} accessibilityRole="header">
              {mode.kind === "add" ? "Add ingredient" : "Edit ingredient"}
            </Text>
          </View>
          <IngredientEditor key={session.id} mode={mode} isSessionActive={isSessionActive}
            fetchInterpreted={fetchInterpreted}
            onSubmitAdd={(ingredient) => {
              if (!isSessionActive()) return;
              session.active = false;
              Keyboard.dismiss();
              onSubmitAdd(ingredient);
            }}
            onSubmitEdit={(replacement) => {
              if (!isSessionActive()) return;
              session.active = false;
              Keyboard.dismiss();
              onSubmitEdit(replacement);
            }}
            onCancel={closeEditor} />
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

// Compatibility alias only; there is no sheet wrapper or Gorhom lifecycle.
export { IngredientEditorModal as IngredientEditorSheet };

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 22,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: t.line },
  close: { minWidth: 60, minHeight: 44, justifyContent: "center" },
  closeText: { fontFamily: font.sans[500], fontSize: 16, color: t.textSoft },
  title: { flex: 1, fontFamily: font.sans[600], fontSize: 20, color: t.text },
});

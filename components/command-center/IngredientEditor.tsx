import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { MealIngredient } from "@voicefit/contracts/types";
import { color as t, font } from "../../lib/tokens";
import type { MealReviewIngredient } from "./types";
import { getErrorMessage, scaleIngredientByGrams } from "./helpers";

export type IngredientEditorMode =
  | { kind: "add" }
  | { kind: "edit"; ingredient: MealReviewIngredient };

interface IngredientEditorProps {
  mode: IngredientEditorMode;
  /**
   * Hits POST /api/interpret/ingredient. Used when the name changes (or when
   * we add a new ingredient). Returns authoritative macros for the row.
   */
  fetchInterpreted: (name: string, grams?: number) => Promise<MealIngredient>;
  /** Persists an edit-by-rename or scale-by-grams to the parent draft. */
  onSubmitEdit: (replacement: MealIngredient | MealReviewIngredient) => void;
  /** Persists a fresh row to the parent draft (add mode only). */
  onSubmitAdd: (ingredient: MealIngredient) => void;
  onCancel: () => void;
}

/**
 * Bottom sheet (rendered as a modal overlay by the parent) for editing or
 * adding a single ingredient row in the meal review draft. Dual-purpose:
 *
 *  - Add: blank fields, calls the LLM to fetch macros for the entered name.
 *  - Edit: pre-fills name + grams. If only grams changed we scale locally
 *    (no network); if the name changed (case-insensitive trim diff) we hit
 *    /api/interpret/ingredient.
 *
 * Stays open on error with an inline message + Retry. Closes only on success
 * or explicit Cancel.
 */
export function IngredientEditor({
  mode,
  fetchInterpreted,
  onSubmitEdit,
  onSubmitAdd,
  onCancel,
}: IngredientEditorProps) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(mode.kind === "edit" ? mode.ingredient.name : "");
  const [gramsText, setGramsText] = useState(
    mode.kind === "edit" ? String(Math.round(mode.ingredient.grams)) : "",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Clear stale errors when the user types again so they don't see an outdated
  // failure from the previous attempt.
  useEffect(() => {
    if (errorMessage) setErrorMessage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, gramsText]);

  const trimmedName = name.trim();
  const parsedGrams = gramsText.trim() ? Number(gramsText.trim()) : null;
  const gramsValid =
    parsedGrams === null || (Number.isFinite(parsedGrams) && parsedGrams > 0);

  const isEdit = mode.kind === "edit";
  const isNameChanged =
    isEdit && trimmedName.toLowerCase() !== mode.ingredient.name.trim().toLowerCase();
  const isGramsChanged =
    isEdit && parsedGrams !== null && parsedGrams !== mode.ingredient.grams;

  const canSubmit =
    !isSaving &&
    !!trimmedName &&
    gramsValid &&
    (mode.kind === "add" || isNameChanged || isGramsChanged);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setErrorMessage(null);

    // Edit, grams-only: skip the network and apply local scaling. The parent
    // recomputes totals on receive.
    if (mode.kind === "edit" && !isNameChanged && isGramsChanged && parsedGrams !== null) {
      onSubmitEdit(scaleIngredientByGrams(mode.ingredient, parsedGrams));
      return;
    }

    setIsSaving(true);
    try {
      const gramsArg = parsedGrams ?? undefined;
      const result = await fetchInterpreted(trimmedName, gramsArg);
      if (mode.kind === "add") {
        onSubmitAdd(result);
      } else {
        onSubmitEdit(result);
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const submitLabel = mode.kind === "add" ? "Add ingredient" : "Save";
  const title = mode.kind === "add" ? "Add ingredient" : "Edit ingredient";

  return (
    <View style={styles.root}>
      <Pressable
        style={styles.backdrop}
        onPress={() => {
          if (!isSaving) onCancel();
        }}
        testID="cc-ingredient-editor-backdrop"
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.kav}
      >
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 22 }]}>
          <View style={styles.handleRow}>
            <View style={styles.handle} />
          </View>

          <Text style={styles.title}>{title}</Text>

          <View style={styles.fieldRow}>
            <Text style={styles.label}>NAME</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Paneer"
              placeholderTextColor={t.textMute}
              autoFocus
              autoCapitalize="sentences"
              autoCorrect
              editable={!isSaving}
              testID="cc-ingredient-editor-name"
            />
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.label}>GRAMS</Text>
            <TextInput
              style={[styles.input, !gramsValid ? styles.inputError : null]}
              value={gramsText}
              onChangeText={(v) => setGramsText(v.replace(/[^0-9.]/g, ""))}
              placeholder="Optional"
              placeholderTextColor={t.textMute}
              keyboardType="decimal-pad"
              editable={!isSaving}
              testID="cc-ingredient-editor-grams"
            />
          </View>

          {errorMessage ? (
            <Text style={styles.errorText} testID="cc-ingredient-editor-error">
              {errorMessage}
            </Text>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              style={styles.cancelButton}
              onPress={onCancel}
              disabled={isSaving}
              testID="cc-ingredient-editor-cancel"
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.submitButton, !canSubmit ? styles.submitButtonDisabled : null]}
              onPress={() => void handleSubmit()}
              disabled={!canSubmit}
              testID="cc-ingredient-editor-submit"
            >
              {isSaving ? (
                <ActivityIndicator color={t.accentInk} />
              ) : (
                <Text style={styles.submitText}>
                  {errorMessage ? "Retry" : submitLabel}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  kav: {
    width: "100%",
  },
  sheet: {
    backgroundColor: t.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: t.line2,
  },
  handleRow: {
    alignItems: "center",
    paddingTop: 6,
    paddingBottom: 14,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: t.line2,
  },
  title: {
    fontFamily: font.sans[600],
    fontSize: 20,
    fontWeight: "600",
    color: t.text,
    letterSpacing: -0.4,
    marginBottom: 18,
  },
  fieldRow: {
    marginBottom: 14,
  },
  label: {
    fontFamily: font.sans[600],
    fontSize: 10.5,
    fontWeight: "600",
    color: t.textMute,
    letterSpacing: 1.68,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  input: {
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 14 : 10,
    fontFamily: font.sans[400],
    fontSize: 16,
    color: t.text,
  },
  inputError: {
    borderColor: t.negative,
  },
  errorText: {
    fontFamily: font.sans[400],
    fontSize: 13,
    color: t.negative,
    marginTop: -4,
    marginBottom: 12,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  cancelButton: {
    width: 110,
    height: 52,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    fontFamily: font.sans[600],
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.52,
    textTransform: "uppercase",
    color: t.textSoft,
  },
  submitButton: {
    flex: 1,
    height: 52,
    backgroundColor: t.accent,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitText: {
    fontFamily: font.sans[700],
    fontSize: 14,
    fontWeight: "700",
    color: t.accentInk,
    letterSpacing: 0.28,
  },
});

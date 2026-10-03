import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import type { MealIngredient } from "@voicefit/contracts/types";
import { color as t, font } from "@/lib/tokens";
import type { MealReviewIngredient } from "@/components/command-center/types";
import { getErrorMessage } from "@/components/command-center/helpers";
import { scaleEditedIngredient, type EditableIngredient } from "@/components/command-center/ingredient-edit";

export type IngredientEditorMode<T extends EditableIngredient = MealReviewIngredient> =
  | { kind: "add" }
  | { kind: "edit"; ingredient: T };

interface IngredientEditorProps<T extends EditableIngredient> {
  mode: IngredientEditorMode<T>;
  /**
   * Hits POST /api/interpret/ingredient. Used when the name changes (or when
   * we add a new ingredient). Returns authoritative macros for the row.
   */
  fetchInterpreted: (name: string, grams?: number) => Promise<MealIngredient>;
  /** Persists an edit-by-rename or scale-by-grams to the parent draft. */
  onSubmitEdit: (replacement: MealIngredient | T) => void;
  /** Persists a fresh row to the parent draft (add mode only). */
  onSubmitAdd: (ingredient: MealIngredient) => void;
  onCancel: () => void;
  /** Host-owned session guard: a mounted body may already be closing/replaced. */
  isSessionActive?: () => boolean;
}

/**
 * Scrollable form in the full-screen native ingredient editor. Plain RN inputs
 * use the installed keyboard-controller's focused-input scrolling. Dual-purpose:
 *
 *  - Add: blank fields, calls the LLM to fetch macros for the entered name.
 *  - Edit: pre-fills name + grams. If only grams changed we scale locally
 *    (no network); if the name changed (case-insensitive trim diff) we hit
 *    /api/interpret/ingredient.
 *
 * Stays open on error with an inline message + Retry. Closes only on success
 * or explicit Cancel / native Back.
 */
export function IngredientEditor<T extends EditableIngredient = MealReviewIngredient>({
  mode,
  fetchInterpreted,
  onSubmitEdit,
  onSubmitAdd,
  onCancel,
  isSessionActive = () => true,
}: IngredientEditorProps<T>) {

  const [name, setName] = useState(mode.kind === "edit" ? mode.ingredient.name : "");
  const [gramsText, setGramsText] = useState(
    mode.kind === "edit" ? String(mode.ingredient.grams ?? "") : "",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Guard cancelled/unmounted lookups and consume a Save before React commits
  // disabled state, so two callbacks in the same event cannot issue two lookups.
  const submittingRef = useRef(false);
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Clear stale errors when the user types again so they don't see an outdated
  // failure from the previous attempt.
  useEffect(() => {
    if (errorMessage) setErrorMessage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, gramsText]);

  const trimmedName = name.trim();
  const parsedGrams = gramsText.trim() ? Number(gramsText.trim()) : null;
  const gramsValid = parsedGrams === null
    ? mode.kind === "add"
    : /^\d*(?:\.\d+)?$/.test(gramsText.trim()) && Number.isFinite(parsedGrams) && parsedGrams > 0;

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
    if (!canSubmit || submittingRef.current || !isMountedRef.current || !isSessionActive()) return;
    submittingRef.current = true;
    setErrorMessage(null);

    // Edit, grams-only: skip the network and apply local scaling. The parent
    // recomputes totals on receive.
    if (mode.kind === "edit" && !isNameChanged && isGramsChanged && parsedGrams !== null && typeof mode.ingredient.grams === "number" && mode.ingredient.grams > 0) {
      onSubmitEdit(scaleEditedIngredient(mode.ingredient, parsedGrams));
      return;
    }

    setIsSaving(true);
    try {
      const gramsArg = parsedGrams ?? undefined;
      const result = await fetchInterpreted(trimmedName, gramsArg);
      if (!isMountedRef.current || !isSessionActive()) return;
      if (mode.kind === "add") {
        onSubmitAdd(result);
      } else {
        onSubmitEdit(result);
      }
    } catch (error) {
      if (isMountedRef.current && isSessionActive()) setErrorMessage(getErrorMessage(error));
    } finally {
      if (isMountedRef.current && isSessionActive()) {
        submittingRef.current = false;
        setIsSaving(false);
      }
    }
  };

  const portionPreview = mode.kind === "edit" && !isNameChanged && gramsValid && parsedGrams !== null && typeof mode.ingredient.grams === "number" && mode.ingredient.grams > 0
    ? scaleEditedIngredient(mode.ingredient, parsedGrams) : null;
  const formatNutrition = (value: number | null) => value === null ? "Unknown" : String(Number(value.toFixed(3)));

  const submitLabel = mode.kind === "add" ? "Add ingredient" : "Save";


  return (
    <KeyboardAwareScrollView
      testID="cc-ingredient-editor-scroll"
      style={styles.scroll}
      contentContainerStyle={styles.form}
      keyboardShouldPersistTaps="handled"
      bottomOffset={16}
    >

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
          accessibilityLabel="Ingredient name"
        />
      </View>

      <View style={styles.fieldRow}>
        <Text style={styles.label}>GRAMS</Text>
        <TextInput
          style={[styles.input, !gramsValid ? styles.inputError : null]}
          value={gramsText}
          onChangeText={setGramsText}
          placeholder="Optional"
          placeholderTextColor={t.textMute}
          keyboardType="decimal-pad"
          editable={!isSaving}
          testID="cc-ingredient-editor-grams"
          accessibilityLabel="Grams"
        />
      </View>

      {portionPreview ? <View testID="cc-ingredient-editor-nutrition-preview" style={styles.fieldRow}>
        <Text style={styles.label}>SAME FOOD · PROPORTIONAL PORTION</Text>
        <Text style={styles.previewText}>{formatNutrition(portionPreview.calories)} kcal · P {formatNutrition(portionPreview.proteinG)} g · C {formatNutrition(portionPreview.carbsG)} g · F {formatNutrition(portionPreview.fatG)} g</Text>
      </View> : mode.kind === "edit" ? <Text style={styles.previewText}>Nutrition will be re-estimated when you save a changed food name or unknown original portion.</Text> : null}

      {errorMessage ? (
        <Text style={styles.errorText} testID="cc-ingredient-editor-error" selectable>
          {errorMessage}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          style={styles.cancelButton}
          onPress={() => {
            if (!isMountedRef.current || !isSessionActive()) return;
            isMountedRef.current = false;
            onCancel();
          }}
          accessibilityRole="button"
          accessibilityLabel="Cancel ingredient edit"
          testID="cc-ingredient-editor-cancel"
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[styles.submitButton, !canSubmit ? styles.submitButtonDisabled : null]}
          onPress={() => void handleSubmit()}
          disabled={!canSubmit}
          testID="cc-ingredient-editor-submit"
          accessibilityRole="button"
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
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  previewText: { fontFamily: font.sans[400], fontSize: 13, color: t.textSoft, marginBottom: 12 },
  scroll: { flex: 1 },
  form: {
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 22,
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
    minHeight: 48,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 12,
    borderCurve: "continuous",
    paddingHorizontal: 14,
    paddingVertical: process.env.EXPO_OS === "ios" ? 14 : 10,
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
    minHeight: 52,
    paddingVertical: 14,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 14,
    borderCurve: "continuous",
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
    minHeight: 52,
    paddingVertical: 14,
    backgroundColor: t.accent,
    borderRadius: 14,
    borderCurve: "continuous",
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

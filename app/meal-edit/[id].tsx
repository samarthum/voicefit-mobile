import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import type { MealIngredient } from "@voicefit/contracts/types";
import { apiRequest } from "../../lib/api-client";
import { fetchInterpretedIngredient } from "../../lib/api/ingredient";
import {
  type AsyncMealStatus,
  formatNullableCalories,
  isFiniteNumber,
  normalizeMealStatus,
  roundNullable,
} from "../../lib/meal-status";
import { color as t, font, radius as r } from "../../lib/tokens";
import { IngredientEditor, type IngredientEditorMode } from "../../components/command-center/IngredientEditor";
import {
  generateIngredientId,
  recalculateMealTotals,
  scaleIngredientByGrams,
} from "../../components/command-center/helpers";
import type { MealReviewIngredient, MealReviewDraft } from "../../components/command-center/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MealType = "breakfast" | "lunch" | "dinner" | "snack";

interface MealIngredientRow {
  id: string;
  position: number;
  name: string;
  grams: number | null;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

interface MealDetail {
  id: string;
  userId: string;
  eatenAt: string;
  mealType: MealType;
  description: string;
  transcriptRaw: string | null;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  totalGrams: number | null;
  interpretationStatus?: AsyncMealStatus | "pending" | "error" | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  ingredients: MealIngredientRow[];
}

// ---------------------------------------------------------------------------
// Helpers (local to this screen)
// ---------------------------------------------------------------------------

function CloseGlyph() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Path
        d="M3 3L15 15M15 3L3 15"
        stroke={t.text}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function formatMealTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function nutritionNumber(value: number | null | undefined) {
  return isFiniteNumber(value) ? value : 0;
}

function toReviewIngredients(rows: MealIngredientRow[]): MealReviewIngredient[] {
  // Position-ordered → freshly-keyed for React. Server-side IDs are intentionally
  // not reused — the editor only needs locally-stable keys, and a brand-new ID
  // makes accidental ID collisions impossible across remount.
  return rows
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((row) => ({
      id: generateIngredientId(),
      name: row.name,
      grams: nutritionNumber(row.grams),
      calories: nutritionNumber(row.calories),
      proteinG: nutritionNumber(row.proteinG),
      carbsG: nutritionNumber(row.carbsG),
      fatG: nutritionNumber(row.fatG),
    }));
}

function toServerIngredients(rows: MealReviewIngredient[]): MealIngredient[] {
  return rows.map(({ id: _id, ...rest }) => rest);
}

/**
 * Recomputes meal totals from a list of ingredient rows. We can't reuse
 * `recalculateMealTotals` directly because it operates on a `MealReviewDraft`
 * (which carries an `interpreted` payload we don't have for already-saved
 * meals) — so we wrap it with a synthetic minimal draft.
 */
function computeTotals(ingredients: MealReviewIngredient[]) {
  const stub: MealReviewDraft = {
    kind: "meal",
    interpreted: {
      intent: "meal",
      payload: {
        mealType: "lunch",
        description: "",
        totalGrams: 0,
        calories: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
        ingredients: [],
      },
    },
    transcript: "",
    source: "text",
    eatenAtLabel: "",
    totalGrams: 0,
    ingredients,
    macros: { protein: 0, carbs: 0, fat: 0 },
  };
  const next = recalculateMealTotals(stub);
  return {
    totalGrams: next.totalGrams,
    calories: next.interpreted.payload.calories,
    macros: next.macros,
  };
}

function scalarTotals(meal: MealDetail) {
  return {
    totalGrams: roundNullable(meal.totalGrams),
    calories: roundNullable(meal.calories),
    macros: {
      protein: roundNullable(meal.proteinG),
      carbs: roundNullable(meal.carbsG),
      fat: roundNullable(meal.fatG),
    },
  };
}

function StatusNotice({ status, message }: { status: AsyncMealStatus; message?: string | null }) {
  if (status === "reviewed") return null;
  const title =
    status === "interpreting"
      ? "Estimating nutrition"
      : status === "needs_review"
      ? "Review estimate"
      : "Estimate failed";
  const body =
    status === "interpreting"
      ? "This meal is still being interpreted. Nutrition will appear when it finishes."
      : status === "needs_review"
      ? "Check the estimate, adjust anything that looks off, then confirm it."
      : message || "The estimate could not be completed. You can delete this meal or try logging it again.";
  return (
    <View
      style={[
        styles.statusNotice,
        status === "failed" ? styles.statusNoticeFailed : null,
      ]}
    >
      <View style={styles.statusNoticeTitleRow}>
        {status === "interpreting" ? (
          <ActivityIndicator size="small" color={t.textMute} />
        ) : null}
        <Text
          style={[
            styles.statusNoticeTitle,
            status === "failed" ? styles.statusNoticeTitleFailed : null,
          ]}
        >
          {title}
        </Text>
      </View>
      <Text style={styles.statusNoticeBody}>{body}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function MealEditScreen() {
  const router = useRouter();
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = typeof rawId === "string" ? rawId : "";
  const { getToken, isSignedIn } = useAuth();
  const queryClient = useQueryClient();

  const [ingredients, setIngredients] = useState<MealReviewIngredient[]>([]);
  const [editedMealType, setEditedMealType] = useState<MealType | null>(null);
  const [seeded, setSeeded] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [editorMode, setEditorMode] = useState<IngredientEditorMode | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mealQuery = useQuery({
    queryKey: ["meal", id],
    enabled: !!id && !!isSignedIn,
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      return apiRequest<MealDetail>(`/api/meals/${id}`, { token });
    },
    refetchInterval: (query) => {
      return query.state.data?.interpretationStatus === "interpreting" ? 2000 : false;
    },
    refetchOnMount: "always",
  });

  // Seed local ingredient state once when the meal first arrives in a
  // non-interpreting state. Skipping interpreting data avoids seeding empty
  // ingredients before Claude finishes; the seeded flag then prevents
  // clobbering unsaved edits on later refetches.
  useEffect(() => {
    if (seeded || !mealQuery.data) return;
    if (mealQuery.data.interpretationStatus === "interpreting") return;
    setIngredients(toReviewIngredients(mealQuery.data.ingredients ?? []));
    setEditedMealType(mealQuery.data.mealType);
    setSeeded(true);
  }, [seeded, mealQuery.data]);

  const ingredientTotals = useMemo(() => computeTotals(ingredients), [ingredients]);

  type MealUpdatePayload = {
    mealType?: MealType;
    interpretationStatus?: AsyncMealStatus;
  };

  const updateMealMetadata = async (
    token: string,
    body: MealUpdatePayload,
    options: { ignoreStatusOnlyFailure?: boolean } = {},
  ) => {
    const fallback = { ...body };
    delete fallback.interpretationStatus;
    const hasFallback = Object.keys(fallback).length > 0;

    try {
      return await apiRequest<MealDetail>(`/api/meals/${id}`, {
        method: "PUT",
        token,
        body: JSON.stringify(body),
      });
    } catch (error) {
      if (body.interpretationStatus && hasFallback) {
        return apiRequest<MealDetail>(`/api/meals/${id}`, {
          method: "PUT",
          token,
          body: JSON.stringify(fallback),
        });
      }
      if (body.interpretationStatus && options.ignoreStatusOnlyFailure) {
        return null;
      }
      throw error;
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");

      const requests: Promise<unknown>[] = [
        apiRequest<MealDetail>(`/api/meals/${id}/ingredients`, {
          method: "PUT",
          token,
          body: JSON.stringify({ ingredients: toServerIngredients(ingredients) }),
        }),
      ];

      // mealType lives on the meal scalar, not the ingredient list — sent via
      // the generic update endpoint when changed.
      const originalMealType = mealQuery.data?.mealType ?? null;
      const metadataPayload: MealUpdatePayload = { interpretationStatus: "reviewed" };
      if (editedMealType && editedMealType !== originalMealType) {
        metadataPayload.mealType = editedMealType;
      }
      requests.push(updateMealMetadata(token, metadataPayload, { ignoreStatusOnlyFailure: true }));

      await Promise.all(requests);
    },
    onSuccess: async () => {
      setErrorMessage(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["meals"] }),
        queryClient.invalidateQueries({ queryKey: ["meal", id] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      router.back();
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save meal.");
    },
  });

  const confirmReviewMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      return updateMealMetadata(token, { interpretationStatus: "reviewed" });
    },
    onSuccess: async () => {
      setErrorMessage(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["meals"] }),
        queryClient.invalidateQueries({ queryKey: ["meal", id] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      router.back();
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : "Failed to confirm meal.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      return apiRequest<{ deleted: boolean }>(`/api/meals/${id}`, {
        method: "DELETE",
        token,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["meals"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      router.back();
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : "Failed to delete meal.");
    },
  });

  const handleClose = () => {
    if (isDirty && !saveMutation.isPending) {
      Alert.alert(
        "Discard changes?",
        "Your edits to this meal will be lost.",
        [
          { text: "Keep editing", style: "cancel" },
          { text: "Discard", style: "destructive", onPress: () => router.back() },
        ],
      );
      return;
    }
    router.back();
  };

  const handleDelete = () => {
    Alert.alert("Delete meal", "This will permanently delete the meal.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void deleteMutation.mutateAsync() },
    ]);
  };

  const handleLongPressIngredient = (ingredient: MealReviewIngredient) => {
    Alert.alert("Delete ingredient?", `Remove "${ingredient.name}" from this meal.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          setIngredients((prev) => prev.filter((ing) => ing.id !== ingredient.id));
          setIsDirty(true);
        },
      },
    ]);
  };

  const editorFetch = async (name: string, grams?: number): Promise<MealIngredient> => {
    const token = await getToken();
    return fetchInterpretedIngredient(token, name, grams);
  };

  const onSubmitAdd = (ingredient: MealIngredient) => {
    setIngredients((prev) => [
      ...prev,
      {
        id: generateIngredientId(),
        name: ingredient.name,
        grams: ingredient.grams,
        calories: ingredient.calories,
        proteinG: ingredient.proteinG,
        carbsG: ingredient.carbsG,
        fatG: ingredient.fatG,
      },
    ]);
    setIsDirty(true);
    setEditorMode(null);
  };

  const onSubmitEdit = (replacement: MealIngredient | MealReviewIngredient) => {
    if (editorMode?.kind !== "edit") return;
    const targetId = editorMode.ingredient.id;
    setIngredients((prev) =>
      prev.map((ing) =>
        ing.id === targetId
          ? {
              id: ing.id,
              name: replacement.name,
              grams: replacement.grams,
              calories: replacement.calories,
              proteinG: replacement.proteinG,
              carbsG: replacement.carbsG,
              fatG: replacement.fatG,
            }
          : ing,
      ),
    );
    setIsDirty(true);
    setEditorMode(null);
  };

  const meal = mealQuery.data;
  const mealStatus = meal ? normalizeMealStatus(meal.interpretationStatus, meal.calories) : "reviewed";
  const displayTotals = meal && ingredients.length === 0 && !isDirty
    ? scalarTotals(meal)
    : ingredientTotals;
  const displayCalories = formatNullableCalories(displayTotals.calories);
  const isPendingEstimate = mealStatus === "interpreting";
  const canConfirmReview = mealStatus === "needs_review" && !isDirty;
  const primaryActionLabel = isDirty ? "Save" : canConfirmReview ? "Looks good" : "Saved";
  const primaryActionPending = saveMutation.isPending || confirmReviewMutation.isPending;
  const primaryActionDisabled =
    primaryActionPending || isPendingEstimate || (!isDirty && !canConfirmReview);

  const handlePrimaryAction = () => {
    if (isDirty) {
      void saveMutation.mutateAsync();
      return;
    }
    if (canConfirmReview) {
      void confirmReviewMutation.mutateAsync();
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={handleClose}
          hitSlop={12}
          style={styles.closeButton}
          testID="meal-edit-close"
        >
          <CloseGlyph />
        </Pressable>
        <Text style={styles.headerTitle}>Edit meal</Text>
        <View style={styles.headerSpacer} />
      </View>

      {mealQuery.isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={t.accent} />
        </View>
      ) : null}

      {mealQuery.isError ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorTitle}>Couldn’t load meal</Text>
          <Text style={styles.errorBody}>
            {mealQuery.error instanceof Error ? mealQuery.error.message : "Please try again."}
          </Text>
          <Pressable style={styles.retryButton} onPress={() => void mealQuery.refetch()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {meal ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          <StatusNotice status={mealStatus} message={meal.errorMessage} />

          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryLeft}>
                <Text style={styles.eyebrow}>
                  {(editedMealType ?? meal.mealType).toUpperCase()}
                </Text>
                <Text style={styles.mealName} numberOfLines={2}>{meal.description}</Text>
                <Text style={styles.mealTime}>{formatMealTime(meal.eatenAt)}</Text>
              </View>
              <View style={styles.summaryRight}>
                {isPendingEstimate || displayCalories == null ? (
                  <>
                    <Text style={styles.kcalPending}>--</Text>
                    <Text style={styles.kcalUnit}>KCAL</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.kcalNum}>{displayCalories}</Text>
                    <Text style={styles.kcalUnit}>KCAL</Text>
                  </>
                )}
              </View>
            </View>

            <View style={styles.mealTypeRow}>
              {(["breakfast", "lunch", "dinner", "snack"] as const).map((type) => {
                const selected = (editedMealType ?? meal.mealType) === type;
                return (
                  <Pressable
                    key={type}
                    onPress={() => {
                      setEditedMealType(type);
                      if (type !== meal.mealType) setIsDirty(true);
                    }}
                    style={[styles.mealTypePill, selected && styles.mealTypePillSelected]}
                  >
                    <Text
                      style={[
                        styles.mealTypePillText,
                        selected && styles.mealTypePillTextSelected,
                      ]}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.macrosGrid}>
              <View style={styles.macroCell}>
                <Text style={styles.macroLabel}>PROTEIN</Text>
                <View style={styles.macroValueRow}>
                  <Text style={[styles.macroValue, styles.macroValueAccent]}>
                    {displayTotals.macros.protein ?? "--"}
                  </Text>
                  <Text style={styles.macroUnit}>g</Text>
                </View>
              </View>
              <View style={styles.macroCell}>
                <Text style={styles.macroLabel}>CARBS</Text>
                <View style={styles.macroValueRow}>
                  <Text style={[styles.macroValue, styles.macroValueSoft]}>
                    {displayTotals.macros.carbs ?? "--"}
                  </Text>
                  <Text style={styles.macroUnit}>g</Text>
                </View>
              </View>
              <View style={styles.macroCell}>
                <Text style={styles.macroLabel}>FAT</Text>
                <View style={styles.macroValueRow}>
                  <Text style={[styles.macroValue, styles.macroValueSoft]}>
                    {displayTotals.macros.fat ?? "--"}
                  </Text>
                  <Text style={styles.macroUnit}>g</Text>
                </View>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.ingredientsHeader}>
              <Text style={styles.ingredientsTitle}>INGREDIENTS</Text>
              <Pressable
                onPress={() => setEditorMode({ kind: "add" })}
                disabled={isPendingEstimate}
                testID="meal-edit-add-ingredient"
              >
                <Text style={[styles.addLink, isPendingEstimate ? styles.addLinkDisabled : null]}>+ ADD</Text>
              </Pressable>
            </View>

            {isPendingEstimate ? (
              <Text style={styles.emptyHint}>
                Nutrition details are still being estimated.
              </Text>
            ) : ingredients.length === 0 ? (
              <Text style={styles.emptyHint}>
                No ingredients on this meal yet. Tap + ADD to start.
              </Text>
            ) : (
              ingredients.map((ingredient, index) => (
                <Pressable
                  key={ingredient.id}
                  onPress={() => {
                    if (!isPendingEstimate) setEditorMode({ kind: "edit", ingredient });
                  }}
                  onLongPress={() => {
                    if (!isPendingEstimate) handleLongPressIngredient(ingredient);
                  }}
                  delayLongPress={400}
                  style={[
                    styles.ingredientRow,
                    index === 0 ? null : styles.ingredientRowDivider,
                  ]}
                  testID={`meal-edit-ingredient-${index}`}
                >
                  <Text style={styles.ingredientName}>{ingredient.name}</Text>
                  <Text style={styles.ingredientQty}>{`${Math.round(ingredient.grams)} g`}</Text>
                  <Text style={styles.ingredientCal}>{ingredient.calories}</Text>
                </Pressable>
              ))
            )}
          </View>

          <Text style={styles.hint}>
            Tap a row to edit · Long-press to delete
          </Text>

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <View style={styles.actions}>
            <Pressable
              style={styles.deleteButton}
              onPress={handleDelete}
              disabled={deleteMutation.isPending}
              testID="meal-edit-delete"
            >
              <Text style={styles.deleteButtonText}>
                {deleteMutation.isPending ? "Deleting…" : "Delete meal"}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.saveButton,
                primaryActionDisabled ? styles.saveButtonDisabled : null,
              ]}
              onPress={handlePrimaryAction}
              disabled={primaryActionDisabled}
              testID="meal-edit-save"
            >
              {primaryActionPending ? (
                <ActivityIndicator color={t.accentInk} />
              ) : (
                <Text style={styles.saveButtonText}>{primaryActionLabel}</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      ) : null}

      {editorMode ? (
        <Modal
          visible
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => setEditorMode(null)}
        >
          <IngredientEditor
            mode={editorMode}
            fetchInterpreted={editorFetch}
            onSubmitAdd={onSubmitAdd}
            onSubmitEdit={onSubmitEdit}
            onCancel={() => setEditorMode(null)}
          />
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: t.bg,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: t.line,
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontFamily: font.sans[600],
    fontSize: 16,
    fontWeight: "600",
    color: t.text,
    letterSpacing: -0.16,
  },
  headerSpacer: {
    width: 36,
  },
  loadingWrap: {
    paddingVertical: 48,
    alignItems: "center",
  },
  errorWrap: {
    padding: 24,
    alignItems: "center",
    gap: 10,
  },
  errorTitle: {
    fontFamily: font.sans[600],
    fontSize: 16,
    fontWeight: "600",
    color: t.text,
  },
  errorBody: {
    fontFamily: font.sans[400],
    fontSize: 13,
    color: t.textSoft,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.line,
  },
  retryButtonText: {
    fontFamily: font.sans[600],
    fontSize: 13,
    fontWeight: "600",
    color: t.text,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 64,
    gap: 12,
  },
  statusNotice: {
    borderRadius: r.md,
    borderWidth: 1,
    borderColor: t.line,
    backgroundColor: t.surface,
    padding: 14,
    gap: 6,
  },
  statusNoticeFailed: {
    borderColor: t.negative,
  },
  statusNoticeTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusNoticeTitle: {
    fontFamily: font.sans[600],
    fontSize: 13,
    fontWeight: "600",
    color: t.text,
  },
  statusNoticeTitleFailed: {
    color: t.negative,
  },
  statusNoticeBody: {
    fontFamily: font.sans[400],
    fontSize: 12.5,
    lineHeight: 18,
    color: t.textSoft,
  },
  summaryCard: {
    backgroundColor: t.surface,
    borderRadius: r.md,
    borderWidth: 1,
    borderColor: t.line,
    padding: 16,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  summaryLeft: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  summaryRight: {
    alignItems: "flex-end",
    width: 96,
  },
  eyebrow: {
    fontFamily: font.sans[600],
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 1.68,
    color: t.textMute,
  },
  mealName: {
    fontFamily: font.sans[600],
    fontSize: 18,
    fontWeight: "600",
    color: t.text,
    letterSpacing: -0.36,
  },
  mealTime: {
    fontFamily: font.mono[400],
    fontSize: 11,
    color: t.textMute,
    marginTop: 2,
  },
  kcalNum: {
    fontFamily: font.mono[500],
    fontSize: 28,
    fontWeight: "500",
    letterSpacing: -0.84,
    color: t.text,
  },
  kcalPending: {
    fontFamily: font.mono[500],
    fontSize: 28,
    fontWeight: "500",
    letterSpacing: -0.84,
    color: t.textMute,
  },
  kcalUnit: {
    fontFamily: font.sans[600],
    fontSize: 9.5,
    fontWeight: "600",
    letterSpacing: 1.52,
    color: t.textMute,
    marginTop: 2,
  },
  mealTypeRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  mealTypePill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: r.pill,
    borderWidth: 1,
    borderColor: t.line,
    alignItems: "center",
  },
  mealTypePillSelected: {
    backgroundColor: t.accent,
    borderColor: t.accent,
  },
  mealTypePillText: {
    fontFamily: font.sans[600],
    fontSize: 12,
    fontWeight: "600",
    color: t.textSoft,
    letterSpacing: 0.4,
  },
  mealTypePillTextSelected: {
    color: t.accentInk,
  },
  macrosGrid: {
    flexDirection: "row",
    gap: 16,
    marginTop: 16,
  },
  macroCell: {
    flex: 1,
  },
  macroLabel: {
    fontFamily: font.sans[600],
    fontSize: 9.5,
    fontWeight: "600",
    letterSpacing: 1.52,
    color: t.textMute,
  },
  macroValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 4,
  },
  macroValue: {
    fontFamily: font.mono[500],
    fontSize: 18,
    letterSpacing: -0.36,
  },
  macroValueAccent: { color: t.accent },
  macroValueSoft: { color: t.textSoft },
  macroUnit: {
    fontFamily: font.sans[400],
    fontSize: 10,
    color: t.textMute,
    marginLeft: 2,
  },
  divider: {
    height: 1,
    backgroundColor: t.line,
    marginTop: 18,
    marginBottom: 12,
  },
  ingredientsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  ingredientsTitle: {
    fontFamily: font.sans[600],
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 1.68,
    color: t.textMute,
  },
  addLink: {
    fontFamily: font.sans[600],
    fontSize: 11,
    fontWeight: "600",
    color: t.accent,
  },
  addLinkDisabled: {
    color: t.textMute,
  },
  emptyHint: {
    paddingVertical: 14,
    fontFamily: font.sans[400],
    fontSize: 13,
    color: t.textMute,
    textAlign: "center",
  },
  ingredientRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  ingredientRowDivider: {
    borderTopWidth: 1,
    borderTopColor: t.line,
  },
  ingredientName: {
    flex: 1,
    fontFamily: font.sans[400],
    fontSize: 14,
    color: t.text,
  },
  ingredientQty: {
    fontFamily: font.mono[400],
    fontSize: 11,
    color: t.textMute,
    width: 56,
    textAlign: "right",
  },
  ingredientCal: {
    fontFamily: font.mono[400],
    fontSize: 14,
    color: t.text,
    width: 42,
    textAlign: "right",
  },
  hint: {
    marginTop: 10,
    paddingHorizontal: 4,
    fontFamily: font.sans[400],
    fontSize: 11,
    color: t.textMute,
    textAlign: "center",
  },
  errorText: {
    marginTop: 12,
    fontFamily: font.sans[600],
    fontSize: 12.5,
    fontWeight: "600",
    color: t.negative,
    textAlign: "center",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
  },
  deleteButton: {
    width: 130,
    height: 52,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteButtonText: {
    fontFamily: font.sans[600],
    fontSize: 13,
    fontWeight: "600",
    color: t.negative,
  },
  saveButton: {
    flex: 1,
    height: 52,
    backgroundColor: t.accent,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontFamily: font.sans[700],
    fontSize: 14,
    fontWeight: "700",
    color: t.accentInk,
    letterSpacing: 0.28,
  },
});

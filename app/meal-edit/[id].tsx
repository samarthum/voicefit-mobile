import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MealIngredient } from "@voicefit/contracts/types";
import { apiRequest } from "@/lib/api-client";
import { fetchInterpretedIngredient } from "@/lib/api/ingredient";
import {
  type AsyncMealStatus,
  formatNullableCalories,
  isFiniteNumber,
  normalizeMealStatus,
  roundNullable,
} from "@/lib/meal-status";
import { color as t, font, radius as r } from "@/lib/tokens";
import { haptic } from "@/lib/haptics";
import { type IngredientEditorMode } from "@/components/command-center/IngredientEditor";
import { IngredientEditorSheet } from "@/components/command-center/IngredientEditorSheet";
import {
  generateIngredientId,
  recalculateMealTotals,
} from "@/components/command-center/helpers";
import type { MealReviewIngredient, MealReviewDraft } from "@/components/command-center/types";
import { StatusNotice, MealSummaryCard, IngredientList, MealActionsBar } from "@/components/meal-edit";

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
      haptic.success();
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
      haptic.success();
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
    haptic.warning();
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

  const insets = useSafeAreaInsets();

  const HeaderDone = () => (
    <Pressable
      onPress={handleClose}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Done"
    >
      <Text style={styles.headerDoneText}>Done</Text>
    </Pressable>
  );

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Edit meal",
          headerRight: () => <HeaderDone />,
        }}
      />

      {mealQuery.isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={t.accent} />
        </View>
      ) : null}

      {mealQuery.isError ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorTitle}>Couldn't load meal</Text>
          <Text style={styles.errorBody} selectable>
            {mealQuery.error instanceof Error ? mealQuery.error.message : "Please try again."}
          </Text>
          <Pressable style={styles.retryButton} onPress={() => void mealQuery.refetch()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {meal ? (
        <>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            contentInsetAdjustmentBehavior="automatic"
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
          >
            <StatusNotice status={mealStatus} message={meal.errorMessage} />

            <View style={styles.summaryCard}>
              <MealSummaryCard
                description={meal.description}
                eatenAt={meal.eatenAt}
                mealType={editedMealType ?? meal.mealType}
                displayCalories={displayCalories}
                isPendingEstimate={isPendingEstimate}
                macros={displayTotals.macros}
                onSelectMealType={(type) => {
                  setEditedMealType(type);
                  if (type !== meal.mealType) setIsDirty(true);
                }}
              />

              <IngredientList
                ingredients={ingredients}
                isPendingEstimate={isPendingEstimate}
                onAdd={() => setEditorMode({ kind: "add" })}
                onEdit={(ingredient) => setEditorMode({ kind: "edit", ingredient })}
                onLongPress={handleLongPressIngredient}
              />
            </View>

            <Text style={styles.hint}>
              Tap a row to edit · Long-press to delete
            </Text>

            {errorMessage ? <Text style={styles.errorText} selectable>{errorMessage}</Text> : null}
          </ScrollView>

          {/* Pinned footer — stays reachable and above the safe area no matter
              how long the ingredient list grows. NOTE: this screen is a native
              form-sheet, where useSafeAreaInsets().bottom reports 0 (the sheet
              runs edge-to-edge but the JS context sees no inset), so guard with
              a home-indicator minimum or the buttons fall under it. */}
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 34) + 12 }]}>
            <MealActionsBar
              primaryLabel={primaryActionLabel}
              primaryDisabled={primaryActionDisabled}
              primaryPending={primaryActionPending}
              deletePending={deleteMutation.isPending}
              onPrimaryAction={handlePrimaryAction}
              onDelete={handleDelete}
            />
          </View>
        </>
      ) : null}

      <IngredientEditorSheet
        mode={editorMode}
        fetchInterpreted={editorFetch}
        onSubmitAdd={onSubmitAdd}
        onSubmitEdit={onSubmitEdit}
        onClose={() => setEditorMode(null)}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles (only what remains in this file)
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: t.bg,
  },
  headerDoneText: {
    fontFamily: font.sans[500],
    fontSize: 14.5,
    fontWeight: "500",
    color: t.accent,
    letterSpacing: -0.07,
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
    borderCurve: "continuous",
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
    paddingBottom: 24,
    gap: 12,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: t.bg,
    borderTopWidth: 1,
    borderTopColor: t.line,
  },
  summaryCard: {
    backgroundColor: t.surface,
    borderRadius: r.md,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: t.line,
    padding: 16,
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
});

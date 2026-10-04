import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,

  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MealIngredient } from "@voicefit/contracts/types";
import { saveMealEdits } from "@/lib/api/meal-edit";
import { retryMealEstimate } from "@/lib/api/meal-repeat";
import { apiRequest } from "@/lib/api-client";
import { fetchInterpretedIngredient } from "@/lib/api/ingredient";
import {
  type AsyncMealStatus,
  formatNullableCalories,
  isFiniteNumber,
  normalizeMealStatus,
  roundNullable,
} from "@/lib/meal-status";
import { Icon } from "@/components/Icon";
import { color as t, font, radius as r } from "@/lib/tokens";
import { haptic } from "@/lib/haptics";
import { type IngredientEditorMode } from "@/components/command-center/IngredientEditor";
import { IngredientEditorSheet } from "@/components/command-center/IngredientEditorSheet";
import {
  generateIngredientId,
} from "@/components/command-center/helpers";
import type { EditableIngredient } from "@/components/command-center/ingredient-edit";
import { StatusNotice, MealSummaryCard, IngredientList, MealActionsBar } from "@/components/meal-edit";
import { useAppPrompt } from "@/components/AppPrompt";

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
  return isFiniteNumber(value) ? value : null;
}

function toReviewIngredients(rows: MealIngredientRow[]): EditableIngredient[] {
  // Position-ordered saved rows keep stable IDs and unknown nutrition.
  return rows
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((row) => ({
      id: row.id,
      name: row.name,
      grams: nutritionNumber(row.grams),
      calories: nutritionNumber(row.calories),
      proteinG: nutritionNumber(row.proteinG),
      carbsG: nutritionNumber(row.carbsG),
      fatG: nutritionNumber(row.fatG),
    }));
}

function toServerIngredients(rows: EditableIngredient[]) {
  return rows.map(({ id: _id, ...rest }) => rest);
}

/** Unknown component nutrition keeps the corresponding total unknown. */
function computeTotals(ingredients: EditableIngredient[]) {
  const sum = (key: "grams" | "calories" | "proteinG" | "carbsG" | "fatG") =>
    ingredients.some(row => !isFiniteNumber(row[key])) ? null : ingredients.reduce((total, row) => total + (row[key] ?? 0), 0);
  return { totalGrams: sum("grams"), calories: sum("calories"),
    macros: { protein: sum("proteinG"), carbs: sum("carbsG"), fat: sum("fatG") } };
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
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = typeof rawId === "string" ? rawId : "";
  // A different route must never inherit the previous meal's local draft.
  return <MealEditSession key={id} id={id} />;
}

function MealEditSession({ id }: { id: string }) {
  const router = useRouter();
  const { getToken, isSignedIn } = useAuth();
  const queryClient = useQueryClient();

  const [ingredients, setIngredients] = useState<EditableIngredient[]>([]);
  const [editedMealType, setEditedMealType] = useState<MealType | null>(null);
  const [seeded, setSeeded] = useState(false);
  const [loadedVersion, setLoadedVersion] = useState<string | undefined>();
  const [isDirty, setIsDirty] = useState(false);
  const [ingredientsDirty, setIngredientsDirty] = useState(false);
  const [editorMode, setEditorMode] = useState<IngredientEditorMode<EditableIngredient> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const prompt = useAppPrompt([id, editorMode, ingredients]);

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
    if (!mealQuery.data || (seeded && (isDirty || loadedVersion === mealQuery.data.updatedAt))) return;
    if (mealQuery.data.interpretationStatus === "interpreting") return;
    setIngredients(toReviewIngredients(mealQuery.data.ingredients ?? []));
    setEditedMealType((current) => isDirty ? current ?? mealQuery.data.mealType : mealQuery.data.mealType);
    setLoadedVersion(mealQuery.data.updatedAt);
    setSeeded(true);
  }, [seeded, mealQuery.data, isDirty, loadedVersion]);

  const ingredientTotals = useMemo(() => computeTotals(ingredients), [ingredients]);

  type MealUpdatePayload = {
    mealType?: MealType;
    interpretationStatus?: AsyncMealStatus;
  };

  const updateMealMetadata = async (
    token: string,
    body: MealUpdatePayload,
  ) => apiRequest<MealDetail>(`/api/meals/${id}`, {
    method: "PUT", token, body: JSON.stringify({ ...body, expectedUpdatedAt: loadedVersion }),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");

      return saveMealEdits<MealDetail>(id, token, {
        expectedUpdatedAt: loadedVersion,
        ingredients: ingredientsDirty ? toServerIngredients(ingredients) : undefined,
        mealType: editedMealType && editedMealType !== mealQuery.data?.mealType ? editedMealType : undefined,
      });
    },
    onSuccess: async (record: MealDetail) => {
      queryClient.setQueryData(["meal", id], record);
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

  const retryEstimateMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      return retryMealEstimate(id, token);
    },
    onSuccess: async (record) => {
      queryClient.setQueryData(["meal", id], record);
      setErrorMessage(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["meal", id] }),
        queryClient.invalidateQueries({ queryKey: ["meals"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
    onError: (error) => setErrorMessage(error instanceof Error ? error.message : "Could not retry estimate."),
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

  const handleClose = useCallback(() => {
    if (isDirty && !saveMutation.isPending) {
      prompt.alert(
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
  }, [isDirty, saveMutation.isPending, router, prompt.alert]);

  const handleDelete = () => {
    haptic.warning();
    prompt.alert("Delete meal?", "It will be removed from your log.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete meal", style: "destructive", onPress: () => deleteMutation.mutateAsync() },
    ]);
  };

  const handleLongPressIngredient = (ingredient: EditableIngredient) => {
    prompt.alert("Delete ingredient?", `Remove "${ingredient.name}" from this meal.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete ingredient",
        style: "destructive",
        onPress: () => {
          setIngredients((prev) => prev.filter((ing) => ing.id !== ingredient.id));
          setIsDirty(true);
          setIngredientsDirty(true);
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
    setIngredientsDirty(true);
    setEditorMode(null);
  };

  const onSubmitEdit = (replacement: MealIngredient | EditableIngredient) => {
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
    setIngredientsDirty(true);
    setEditorMode(null);
  };

  const meal = mealQuery.data;
  const mealStatus = meal ? normalizeMealStatus(meal.interpretationStatus, meal.calories) : "reviewed";
  const displayTotals = meal && !ingredientsDirty
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
      saveMutation.mutate();
      return;
    }
    if (canConfirmReview) {
      confirmReviewMutation.mutate();
    }
  };

  const insets = useSafeAreaInsets();

  const renderHeaderDone = useCallback(() => (
    // A plain close, not "Done": the bottom action is what saves or confirms,
    // and closing with unsaved edits still asks before discarding.
    <Pressable
      onPress={handleClose}
      hitSlop={12}
      style={({ pressed }) => [styles.headerClose, pressed && { opacity: 0.6 }]}
      accessibilityRole="button"
      accessibilityLabel="Close"
    >
      <Icon name="close" size={18} color={t.text} />
    </Pressable>
  ), [handleClose]);

  const screenOptions = useMemo(() => ({
    title: "Edit meal",
    headerRight: renderHeaderDone,
  }), [renderHeaderDone]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <View style={styles.root}>
      <Stack.Screen
        options={screenOptions}
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
            {mealStatus === "failed" ? <Pressable testID="meal-edit-retry-estimate" disabled={retryEstimateMutation.isPending || isDirty} style={styles.retryButton} onPress={() => retryEstimateMutation.mutate()}>
              <Text style={styles.retryButtonText}>{retryEstimateMutation.isPending ? "Retrying…" : "Retry nutrition estimate"}</Text>
            </Pressable> : null}
            {mealStatus === "reviewed" && !isDirty ? <Pressable testID="meal-edit-repeat" style={styles.retryButton} onPress={() => router.push({ pathname: "/meal-repeat", params: { id } })}>
              <Text style={styles.retryButtonText}>Repeat this meal…</Text>
            </Pressable> : null}

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
      {prompt.dialog}
        </View>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
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
  headerClose: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
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

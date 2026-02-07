import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../lib/api-client";

type MealType = "breakfast" | "lunch" | "dinner" | "snack";

interface MealItem {
  id: string;
  userId: string;
  eatenAt: string;
  mealType: MealType;
  description: string;
  transcriptRaw: string | null;
  calories: number;
  createdAt: string;
  updatedAt: string;
}

interface MealsListResponse {
  meals: MealItem[];
  total: number;
  limit: number;
  offset: number;
}

const PAGE_SIZE = 20;
const mealTypes: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

function formatMealTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function MealsScreen() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const [dateInput, setDateInput] = useState("");
  const [appliedDate, setAppliedDate] = useState("");
  const [filterError, setFilterError] = useState<string | null>(null);
  const [selectedMealId, setSelectedMealId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editCalories, setEditCalories] = useState("");
  const [editMealType, setEditMealType] = useState<MealType>("breakfast");
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);

  const mealsQuery = useInfiniteQuery({
    queryKey: ["meals", appliedDate],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const token = await getToken();
      if (!token) {
        throw new Error("Not signed in");
      }
      const offset = pageParam as number;
      const query = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      if (appliedDate) {
        query.set("date", appliedDate);
      }
      return apiRequest<MealsListResponse>(`/api/meals?${query.toString()}`, { token });
    },
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((count, page) => count + page.meals.length, 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
  });

  const mealDetailQuery = useQuery({
    queryKey: ["meal-detail", selectedMealId],
    queryFn: async () => {
      const token = await getToken();
      if (!token || !selectedMealId) {
        throw new Error("Not signed in");
      }
      return apiRequest<MealItem>(`/api/meals/${selectedMealId}`, { token });
    },
    enabled: !!selectedMealId,
  });

  useEffect(() => {
    if (!mealDetailQuery.data) return;
    setEditDescription(mealDetailQuery.data.description);
    setEditCalories(String(mealDetailQuery.data.calories));
    setEditMealType(mealDetailQuery.data.mealType);
    setEditError(null);
    setEditSuccess(null);
  }, [mealDetailQuery.data]);

  const editSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateMealMutation = useMutation({
    mutationFn: async () => {
      if (!selectedMealId) {
        throw new Error("Select a meal first");
      }
      const token = await getToken();
      if (!token) {
        throw new Error("Not signed in");
      }
      const calories = Number(editCalories.trim());
      if (!editDescription.trim()) {
        throw new Error("Description is required.");
      }
      if (!Number.isInteger(calories) || calories < 0) {
        throw new Error("Calories must be a non-negative integer.");
      }

      return apiRequest<MealItem>(`/api/meals/${selectedMealId}`, {
        method: "PUT",
        token,
        body: JSON.stringify({
          description: editDescription.trim(),
          calories,
          mealType: editMealType,
        }),
      });
    },
    onSuccess: async (updatedMeal) => {
      setEditError(null);
      queryClient.setQueryData(["meal-detail", updatedMeal.id], updatedMeal);
      await queryClient.invalidateQueries({ queryKey: ["meals"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      Keyboard.dismiss();
      // Close the detail panel after a brief moment so user sees the list updated
      setSelectedMealId(null);
    },
    onError: (error) => {
      setEditSuccess(null);
      setEditError(error instanceof Error ? error.message : "Failed to update meal.");
    },
  });

  const deleteMealMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      if (!token) {
        throw new Error("Not signed in");
      }
      return apiRequest<{ deleted: boolean }>(`/api/meals/${id}`, {
        method: "DELETE",
        token,
      });
    },
    onSuccess: async (_result, id) => {
      if (selectedMealId === id) {
        setSelectedMealId(null);
      }
      await queryClient.invalidateQueries({ queryKey: ["meals"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const meals = useMemo(
    () => mealsQuery.data?.pages.flatMap((page) => page.meals) ?? [],
    [mealsQuery.data]
  );

  const total = mealsQuery.data?.pages[0]?.total ?? 0;
  const totalLoaded = meals.length;

  const applyFilter = () => {
    const next = dateInput.trim();
    if (next && !dateRegex.test(next)) {
      setFilterError("Date must be YYYY-MM-DD.");
      return;
    }
    setFilterError(null);
    setSelectedMealId(null);
    setAppliedDate(next);
  };

  const clearFilter = () => {
    setDateInput("");
    setAppliedDate("");
    setFilterError(null);
    setSelectedMealId(null);
  };

  const confirmDelete = (id: string) => {
    Alert.alert("Delete meal", "This will permanently delete the meal.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteMealMutation.mutate(id),
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={meals}
        keyExtractor={(item) => item.id}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={mealsQuery.isRefetching && !mealsQuery.isFetchingNextPage}
            onRefresh={() => mealsQuery.refetch()}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerSection}>
            <Text style={styles.title}>Meals</Text>
            <Text style={styles.subtitle}>List, filter, view, edit, and delete meals.</Text>

            <View style={styles.filterCard}>
              <Text style={styles.label}>Date filter (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={dateInput}
                onChangeText={setDateInput}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Optional date filter"
              />
              {filterError ? <Text style={styles.error}>{filterError}</Text> : null}
              <View style={styles.row}>
                <Pressable style={styles.buttonPrimary} onPress={applyFilter}>
                  <Text style={styles.buttonPrimaryText}>Apply</Text>
                </Pressable>
                <Pressable style={styles.buttonSecondary} onPress={clearFilter}>
                  <Text style={styles.buttonSecondaryText}>Clear</Text>
                </Pressable>
              </View>
              <Text style={styles.helperText}>
                Loaded {totalLoaded} of {total}{appliedDate ? ` for ${appliedDate}` : ""}
              </Text>
            </View>

            {selectedMealId ? (
              <View style={styles.detailCard}>
                <Text style={styles.detailTitle}>Meal Details</Text>
                {mealDetailQuery.isLoading ? (
                  <ActivityIndicator />
                ) : mealDetailQuery.error ? (
                  <Text style={styles.error}>
                    {mealDetailQuery.error instanceof Error
                      ? mealDetailQuery.error.message
                      : "Failed to load meal"}
                  </Text>
                ) : mealDetailQuery.data ? (
                  <>
                    <Text style={styles.label}>Meal Type</Text>
                    <View style={styles.chipRow}>
                      {mealTypes.map((mealType) => (
                        <Pressable
                          key={mealType}
                          style={[
                            styles.chip,
                            editMealType === mealType ? styles.chipActive : null,
                          ]}
                          onPress={() => setEditMealType(mealType)}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              editMealType === mealType ? styles.chipTextActive : null,
                            ]}
                          >
                            {mealType}
                          </Text>
                        </Pressable>
                      ))}
                    </View>

                    <Text style={styles.label}>Description</Text>
                    <TextInput
                      style={styles.input}
                      value={editDescription}
                      onChangeText={setEditDescription}
                    />

                    <Text style={styles.label}>Calories</Text>
                    <TextInput
                      style={styles.input}
                      value={editCalories}
                      onChangeText={setEditCalories}
                      keyboardType="number-pad"
                    />

                    <Text style={styles.label}>Eaten At</Text>
                    <Text style={styles.helperText}>{formatMealTime(mealDetailQuery.data.eatenAt)}</Text>

                    {mealDetailQuery.data.transcriptRaw ? (
                      <>
                        <Text style={styles.label}>Transcript</Text>
                        <Text style={styles.helperText}>{mealDetailQuery.data.transcriptRaw}</Text>
                      </>
                    ) : null}

                    {editError ? <Text style={styles.error}>{editError}</Text> : null}
                    {editSuccess ? <Text style={styles.success}>{editSuccess}</Text> : null}

                    <View style={styles.row}>
                      <Pressable
                        style={[
                          styles.buttonPrimary,
                          updateMealMutation.isPending ? styles.disabledButton : null,
                        ]}
                        onPress={() => updateMealMutation.mutate()}
                        disabled={updateMealMutation.isPending}
                      >
                        <Text style={styles.buttonPrimaryText}>
                          {updateMealMutation.isPending ? "Saving..." : "Save Changes"}
                        </Text>
                      </Pressable>
                      <Pressable
                        style={styles.buttonSecondary}
                        onPress={() => setSelectedMealId(null)}
                      >
                        <Text style={styles.buttonSecondaryText}>Close</Text>
                      </Pressable>
                    </View>
                  </>
                ) : null}
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          mealsQuery.isLoading ? (
            <ActivityIndicator />
          ) : mealsQuery.error ? (
            <Text style={styles.error}>
              {mealsQuery.error instanceof Error ? mealsQuery.error.message : "Failed to load meals"}
            </Text>
          ) : (
            <Text style={styles.emptyText}>No meals found.</Text>
          )
        }
        renderItem={({ item }) => (
          <View style={styles.itemCard}>
            <View style={styles.itemTopRow}>
              <Text style={styles.itemTitle}>{item.description}</Text>
              <Text style={styles.itemCalories}>{item.calories} kcal</Text>
            </View>
            <Text style={styles.itemMeta}>
              {item.mealType} · {formatMealTime(item.eatenAt)}
            </Text>

            <View style={styles.row}>
              <Pressable
                style={styles.buttonSecondary}
                onPress={() => setSelectedMealId(item.id)}
              >
                <Text style={styles.buttonSecondaryText}>View / Edit</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.buttonDanger,
                  deleteMealMutation.isPending ? styles.disabledButton : null,
                ]}
                onPress={() => confirmDelete(item.id)}
                disabled={deleteMealMutation.isPending}
              >
                <Text style={styles.buttonDangerText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        )}
        ListFooterComponent={
          <View style={styles.footer}>
            {mealsQuery.hasNextPage ? (
              <Pressable
                style={[
                  styles.buttonPrimary,
                  mealsQuery.isFetchingNextPage ? styles.disabledButton : null,
                ]}
                onPress={() => mealsQuery.fetchNextPage()}
                disabled={mealsQuery.isFetchingNextPage}
              >
                <Text style={styles.buttonPrimaryText}>
                  {mealsQuery.isFetchingNextPage ? "Loading..." : "Load More"}
                </Text>
              </Pressable>
            ) : totalLoaded > 0 ? (
              <Text style={styles.helperText}>All meals loaded.</Text>
            ) : null}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  headerSection: {
    padding: 20,
    paddingBottom: 12,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
  },
  subtitle: {
    fontSize: 14,
    color: "#4B5563",
  },
  filterCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  detailCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
  },
  input: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#FFFFFF",
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  buttonPrimary: {
    backgroundColor: "#111827",
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPrimaryText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  buttonSecondary: {
    backgroundColor: "#E5E7EB",
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonSecondaryText: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "600",
  },
  buttonDanger: {
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDangerText: {
    color: "#B91C1C",
    fontSize: 14,
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.6,
  },
  helperText: {
    fontSize: 12,
    color: "#4B5563",
  },
  error: {
    color: "#B91C1C",
    fontSize: 13,
    fontWeight: "600",
  },
  success: {
    color: "#047857",
    fontSize: 13,
    fontWeight: "600",
  },
  emptyText: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    color: "#4B5563",
    fontSize: 14,
  },
  itemCard: {
    marginHorizontal: 20,
    marginBottom: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  itemTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  itemTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  itemCalories: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
  },
  itemMeta: {
    fontSize: 12,
    color: "#4B5563",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 11,
  },
  chipActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  chipText: {
    fontSize: 12,
    color: "#374151",
    textTransform: "capitalize",
  },
  chipTextActive: {
    color: "#FFFFFF",
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 22,
    alignItems: "center",
  },
});

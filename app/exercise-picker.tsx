import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { FloatingCommandBar } from "@/components/FloatingCommandBar";
import { Icon } from "@/components/Icon";
import { useCommandCenter } from "@/components/command-center";
import { haptic } from "@/lib/haptics";
import { EXERCISE_CATALOG, type ExerciseCatalogItem } from "@/lib/exercise-catalog";
import { color as token, font, radius as r } from "@/lib/tokens";

const COLORS = {
  bg: token.bg,
  surface: token.surface,
  surface2: token.surface2,
  border: token.line,
  textPrimary: token.text,
  textSecondary: token.textSoft,
  textTertiary: token.textMute,
  blue: token.accent,
  green: token.accent,
  chest: token.accent,
  shoulders: token.accent,
};

const FILTERS = ["All", "Chest", "Back", "Shoulders", "Legs", "Arms", "Core", "Cardio"] as const;

type ExerciseItem = ExerciseCatalogItem & { recent?: string };

function HeaderClose() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.back()}
      accessibilityRole="button"
      accessibilityLabel="Close"
      style={{ padding: 4 }}
    >
      <Icon name="close" size={22} color={token.text} />
    </Pressable>
  );
}

function ExerciseRow({
  item,
  onAdd,
}: {
  item: ExerciseItem;
  onAdd: () => void;
}) {
  return (
    <View style={styles.exerciseRow}>
      <View style={styles.exerciseLeft}>
        <View>
          <Text style={styles.exerciseName}>{item.name}</Text>
          <View style={styles.exerciseMetaRow}>
            <Text style={styles.exerciseMeta}>
              {item.equipment.toUpperCase()} · {item.group.toUpperCase()}
              {item.recent ? ` · ${item.recent.toUpperCase()}` : ""}
            </Text>
          </View>
        </View>
      </View>
      <Pressable
        style={styles.addCircle}
        onPress={() => { haptic.tap(); onAdd(); }}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Add ${item.name}`}
      >
        <Icon name="plus" size={14} color={token.accent} />
      </Pressable>
    </View>
  );
}

export default function ExercisePickerScreen() {
  const cc = useCommandCenter();
  const router = useRouter();
  const params = useLocalSearchParams<{ sessionId?: string | string[] }>();
  const sessionId = Array.isArray(params.sessionId) ? params.sessionId[0] : params.sessionId;
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<(typeof FILTERS)[number]>("All");

  const recentItems = useMemo<ExerciseItem[]>(
    () =>
      EXERCISE_CATALOG.filter((item) => item.recentDaysAgo != null).map((item) => ({
        ...item,
        recent: `${item.recentDaysAgo} days ago`,
      })),
    []
  );

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    // When searching, ignore the group filter — search across all exercises
    const source =
      activeFilter === "All" || query
        ? EXERCISE_CATALOG
        : EXERCISE_CATALOG.filter((item) => item.group === activeFilter);
    if (!query) return source;
    return source.filter((item) => item.name.toLowerCase().includes(query));
  }, [activeFilter, search]);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, ExerciseItem[]>();
    for (const item of filteredItems) {
      const existing = groups.get(item.group) ?? [];
      existing.push(item);
      groups.set(item.group, existing);
    }
    return [...groups.entries()];
  }, [filteredItems]);

  const handleAdd = (item: ExerciseItem) => {
    if (sessionId) {
      router.replace({
        pathname: "/workout-session/[id]",
        params: {
          id: sessionId,
          addExerciseName: item.name,
          addExerciseType: item.group === "Cardio" ? "cardio" : "resistance",
          addExerciseNonce: String(Date.now()),
        },
      });
      return;
    }
    router.replace("/(tabs)/workouts");
  };

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Add exercise",
          headerLeft: () => <HeaderClose />,
        }}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >

        <View style={styles.searchWrap}>
          <Icon name="search" size={16} color={token.textMute} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search exercises..."
            placeholderTextColor={COLORS.textTertiary}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FILTERS.map((filter) => {
            const active = filter === activeFilter;
            return (
              <Pressable
                key={filter}
                style={[styles.filterChip, active ? styles.filterChipActive : null]}
                onPress={() => setActiveFilter(filter)}
              >
                <Text style={[styles.filterText, active ? styles.filterTextActive : null]}>{filter}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {recentItems.length > 0 && activeFilter === "All" && !search.trim() ? (
          <>
            <Text style={styles.sectionLabel}>Recent</Text>
            <View style={styles.sectionCard}>
              {recentItems.map((item) => (
                <ExerciseRow key={item.name} item={item} onAdd={() => handleAdd(item)} />
              ))}
            </View>
          </>
        ) : null}

        {groupedItems.map(([group, items]) => (
          <View key={group}>
            <Text style={styles.sectionLabel}>{group}</Text>
            <View style={styles.sectionCard}>
              {items.map((item) => (
                <ExerciseRow key={`${item.name}-${item.equipment}`} item={item} onAdd={() => handleAdd(item)} />
              ))}
            </View>
          </View>
        ))}

        {groupedItems.length === 0 && search.trim() ? (
          <Text style={styles.emptyText}>No exercises match "{search.trim()}"</Text>
        ) : null}
      </ScrollView>

      <FloatingCommandBar
        hint="Add tricep pushdowns…"
        onPress={() => cc.open()}
        onMicPress={() => cc.startRecording()}
        bottomOffset={8}
        safeAreaBottom
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 96,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderRadius: r.sm,
    borderCurve: "continuous",
    backgroundColor: token.surface,
    borderWidth: 1,
    borderColor: token.line,
    minHeight: 48,
  },
  searchInput: {
    flex: 1,
    fontFamily: font.sans[400],
    fontSize: 14,
    color: token.text,
    letterSpacing: -0.07,
  },
  filterRow: {
    gap: 8,
    paddingBottom: 14,
  },
  filterChip: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: r.pill,
    borderWidth: 1,
    borderColor: token.line,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  filterChipActive: {
    backgroundColor: token.accent,
    borderColor: "transparent",
  },
  filterText: {
    fontFamily: font.sans[600],
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.48,
    color: token.textSoft,
  },
  filterTextActive: {
    color: token.accentInk,
  },
  sectionLabel: {
    paddingTop: 6,
    paddingBottom: 10,
    fontFamily: font.sans[600],
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 1.68,
    textTransform: "uppercase",
    color: token.textSoft,
  },
  sectionCard: {
    marginBottom: 12,
    gap: 6,
  },
  exerciseRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: token.surface,
    borderWidth: 1,
    borderColor: token.line,
    borderRadius: 12,
    borderCurve: "continuous",
    marginBottom: 6,
  },
  exerciseLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  exerciseName: {
    fontFamily: font.sans[500],
    fontSize: 14.5,
    fontWeight: "500",
    letterSpacing: -0.07,
    color: token.text,
  },
  exerciseMetaRow: {
    marginTop: 3,
  },
  exerciseMeta: {
    fontFamily: font.sans[600],
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 1.26,
    color: token.textMute,
  },
  addCircle: {
    width: 30,
    height: 30,
    borderRadius: r.pill,
    backgroundColor: token.bg,
    borderWidth: 1,
    borderColor: token.line,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontFamily: font.sans[400],
    fontSize: 14,
    color: token.textSoft,
    textAlign: "center",
    paddingVertical: 24,
  },
});

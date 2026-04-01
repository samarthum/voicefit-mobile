import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { FloatingCommandBar } from "../components/FloatingCommandBar";
import { useCommandCenter } from "../components/command-center";
import { EXERCISE_CATALOG, type ExerciseCatalogItem } from "../lib/exercise-catalog";

const COLORS = {
  bg: "#FFFFFF",
  surface: "#F8F8F8",
  border: "#E8E8E8",
  textPrimary: "#1A1A1A",
  textSecondary: "#8E8E93",
  textTertiary: "#AEAEB2",
  blue: "#007AFF",
  green: "#34C759",
  chest: "#FF6B6B",
  shoulders: "#AF52DE",
};

const FILTERS = ["All", "Chest", "Back", "Shoulders", "Legs", "Arms", "Core", "Cardio"] as const;

type ExerciseItem = ExerciseCatalogItem & { recent?: string };

function CloseGlyph() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path d="M5 5L19 19M19 5L5 19" stroke={COLORS.textPrimary} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

function SearchGlyph() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M11 18C14.866 18 18 14.866 18 11C18 7.13401 14.866 4 11 4C7.13401 4 4 7.13401 4 11C4 14.866 7.13401 18 11 18Z"
        stroke={COLORS.textTertiary}
        strokeWidth={2}
      />
      <Path d="M20 20L16.5 16.5" stroke={COLORS.textTertiary} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function PlusGlyph() {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5V19M5 12H19" stroke={COLORS.textTertiary} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

function AccentGlyph({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M6 7H18M8 12H16M5 17H19" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
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
        <View style={[styles.exerciseIcon, { backgroundColor: `${item.accent}14` }]}>
          <AccentGlyph color={item.accent} />
        </View>
        <View>
          <Text style={styles.exerciseName}>{item.name}</Text>
          <View style={styles.exerciseMetaRow}>
            <Text style={styles.exerciseEquipment}>{item.equipment.toUpperCase()}</Text>
            <Text style={styles.exerciseGroup}>{item.group}</Text>
            {item.recent ? <Text style={styles.exerciseRecent}>{item.recent}</Text> : null}
          </View>
        </View>
      </View>
      <Pressable style={styles.addCircle} onPress={onAdd}>
        <PlusGlyph />
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
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Pressable style={styles.iconButton} onPress={() => router.back()}>
            <CloseGlyph />
          </Pressable>
          <Text style={styles.title}>Add Exercise</Text>
          <View style={styles.headerPlaceholder} />
        </View>

        <View style={styles.searchWrap}>
          <SearchGlyph />
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
        hint='"Add tricep pushdowns"'
        onPress={() => cc.open()}
        onMicPress={() => cc.startRecording()}
      />
    </SafeAreaView>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 18,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  createLink: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.blue,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  filterRow: {
    gap: 10,
    paddingBottom: 20,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.bg,
  },
  filterChipActive: {
    backgroundColor: COLORS.textPrimary,
    borderColor: COLORS.textPrimary,
  },
  filterText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  filterTextActive: {
    color: "#FFFFFF",
  },
  sectionLabel: {
    paddingBottom: 10,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: COLORS.textSecondary,
  },
  sectionCard: {
    marginBottom: 20,
  },
  exerciseRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  exerciseLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  exerciseIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  exerciseMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
    flexWrap: "wrap",
  },
  exerciseEquipment: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: COLORS.textSecondary,
  },
  exerciseGroup: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  exerciseRecent: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.green,
  },
  addCircle: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  headerPlaceholder: {
    width: 32,
  },
  emptyText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: "center",
    paddingVertical: 24,
  },
});

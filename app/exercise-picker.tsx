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
import { color as token, font, radius as r } from "../lib/tokens";

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

function CloseGlyph() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path d="M5 5L19 19M19 5L5 19" stroke={token.textSoft} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

function SearchGlyph() {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
      <Path
        d="M6 1.5C8.485 1.5 10.5 3.515 10.5 6C10.5 8.485 8.485 10.5 6 10.5C3.515 10.5 1.5 8.485 1.5 6C1.5 3.515 3.515 1.5 6 1.5Z"
        stroke={token.textMute}
        strokeWidth={1.4}
      />
      <Path d="M9.5 9.5L13 13" stroke={token.textMute} strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}

function PlusGlyph() {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5V19M5 12H19" stroke={token.accent} strokeWidth={2.2} strokeLinecap="round" />
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
          <Text style={styles.title}>Add exercise</Text>
          <Text style={styles.createLink}>New</Text>
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
        hint="Add tricep pushdowns…"
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
    paddingBottom: 14,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: r.pill,
    backgroundColor: token.surface,
    borderWidth: 1,
    borderColor: token.line,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: font.sans[600],
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.17,
    color: token.text,
  },
  createLink: {
    fontFamily: font.sans[600],
    fontSize: 11.5,
    fontWeight: "600",
    letterSpacing: 1.38,
    textTransform: "uppercase",
    color: token.accent,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderRadius: r.sm,
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
  headerPlaceholder: {
    width: 32,
  },
  emptyText: {
    fontFamily: font.sans[400],
    fontSize: 14,
    color: token.textSoft,
    textAlign: "center",
    paddingVertical: 24,
  },
});

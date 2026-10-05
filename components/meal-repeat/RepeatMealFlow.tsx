import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@clerk/clerk-expo";
import { useQueryClient } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { apiRequest } from "@/lib/api-client";
import { getSavedMeal, previewRepeatedMeal, repeatSavedMeal, type RepeatMealInput, type SavedMealRecord } from "@/lib/api/meal-repeat";
import { formatKcal } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { Icon } from "@/components/Icon";
import { color as t, font, radius as r } from "@/lib/tokens";

type MealChoice = Omit<SavedMealRecord, "ingredients">;
type MealType = "breakfast" | "lunch" | "dinner" | "snack";
const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
];
const PORTIONS = [0.5, 1, 1.5, 2];
const PORTION_STEP = 0.25;
const PORTION_MIN = 0.25;
const PORTION_MAX = 5;

const message = (error: unknown) => error instanceof Error ? error.message : "Please try again.";
const finite = (value: number | null | undefined): value is number => typeof value === "number" && Number.isFinite(value);
// An unreviewed AI estimate is a complete record; only pending/failed rows have nothing to copy.
const reusable = (meal: MealChoice) =>
  (meal.interpretationStatus === "reviewed" || meal.interpretationStatus === "needs_review") && finite(meal.calories) && meal.calories >= 0;
const typeLabel = (type: string) => MEAL_TYPES.find((m) => m.value === type)?.label ?? type;
const portionLabel = (value: number) => `${Number(value.toFixed(2))}×`;

/** Logging happens now, so default to the meal that fits the clock. */
function mealTypeForNow(date = new Date()): MealType {
  const hour = date.getHours();
  if (hour >= 4 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 16) return "lunch";
  if (hour >= 16 && hour < 22) return "dinner";
  return "snack";
}

function relativeDay(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(new Date()) - startOf(date)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return date.toLocaleDateString("en-US", { weekday: "long" });
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function lastLogged(iso: string) {
  const day = relativeDay(iso);
  return day === "Today" || day === "Yesterday" ? day.toLowerCase() : day;
}

/** One row per distinct meal (newest entry wins), with how often it was logged. */
function groupChoices(choices: MealChoice[]) {
  const groups = new Map<string, { meal: MealChoice; count: number }>();
  for (const meal of choices) {
    if (!reusable(meal)) continue;
    const key = meal.description.trim().toLowerCase();
    const existing = groups.get(key);
    if (existing) existing.count += 1;
    else groups.set(key, { meal, count: 1 });
  }
  return Array.from(groups.values());
}

/** The only repeat write uses the owned full saved source's ID, never a summary. */
export function RepeatMealFlow({ initialMealId, onClose, onSaved }: {
  initialMealId?: string; onClose: () => void; onSaved?: (meal: SavedMealRecord) => void;
}) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [choices, setChoices] = useState<MealChoice[]>([]);
  const [total, setTotal] = useState(0);
  const [listBusy, setListBusy] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(initialMealId ?? "");
  const [source, setSource] = useState<SavedMealRecord | null>(null);
  const [sourceBusy, setSourceBusy] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [portion, setPortion] = useState(1);
  const [mealType, setMealType] = useState<MealType>(() => mealTypeForNow());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedMealRecord | null>(null);
  const [undone, setUndone] = useState(false);
  const attempt = useRef<{ sourceId: string; input: RepeatMealInput } | null>(null);
  const writing = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const token = async () => { const value = await getToken(); if (!value) throw new Error("Not signed in"); return value; };

  const loadChoices = async (offset: number) => {
    setListBusy(true); setListError(null);
    try {
      const result = await apiRequest<{ meals: MealChoice[]; total: number }>(`/api/meals?limit=50&offset=${offset}`, { token: await token() });
      if (!mounted.current) return;
      setChoices(previous => offset === 0 ? result.meals : [...previous, ...result.meals.filter(row => !previous.some(old => old.id === row.id))]);
      setTotal(result.total);
    } catch (err) { if (mounted.current) setListError(message(err)); }
    finally { if (mounted.current) setListBusy(false); }
  };
  // The chooser is skipped entirely when a source was passed in.
  useEffect(() => { if (!initialMealId) void loadChoices(0); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedId) return;
    let current = true;
    setSource(null); setSourceBusy(true); setSourceError(null);
    void (async () => {
      try {
        const detail = await getSavedMeal(selectedId, await token());
        if (!current) return;
        if (!reusable(detail)) throw new Error("This meal's estimate isn't ready yet. Open it from your meals to retry the estimate first.");
        if (detail.id !== selectedId || !Array.isArray(detail.ingredients)) throw new Error("Could not load the full saved meal.");
        setSource(detail);
      } catch (err) { if (current) setSourceError(message(err)); }
      finally { if (current) setSourceBusy(false); }
    })();
    return () => { current = false; };
  }, [selectedId, reload]); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => groupChoices(choices), [choices]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? groups.filter((g) => g.meal.description.toLowerCase().includes(needle)) : groups;
  }, [groups, query]);

  const preview = source ? previewRepeatedMeal(source, portion) : null;
  const locked = busy || !!attempt.current;

  const refresh = async () => {
    await Promise.all([queryClient.invalidateQueries({ queryKey: ["meals"] }), queryClient.invalidateQueries({ queryKey: ["dashboard"] })]);
  };
  const choose = (id: string) => {
    if (locked) return;
    haptic.tap();
    setError(null); setPortion(1); setSelectedId(id);
  };
  const backToList = () => {
    if (locked) return;
    setSelectedId(""); setSource(null); setSourceError(null); setError(null);
  };
  const setPortionSafely = (value: number) => {
    if (locked) return;
    const next = Math.min(PORTION_MAX, Math.max(PORTION_MIN, Math.round(value / PORTION_STEP) * PORTION_STEP));
    if (next !== portion) haptic.selection();
    setPortion(next);
  };
  const save = async () => {
    if (writing.current || !source || saved) return;
    writing.current = true; setBusy(true); setError(null);
    attempt.current ??= { sourceId: source.id, input: { requestId: randomUUID(), portionMultiplier: portion, eatenAt: new Date().toISOString(), mealType } };
    try {
      const record = await repeatSavedMeal(attempt.current.sourceId, await token(), attempt.current.input);
      // Refuse to show/undo a source record if a malformed response returns it.
      if (!record.id || record.id === attempt.current.sourceId || !Array.isArray(record.ingredients)) throw new Error("The server did not confirm a new saved meal. Retry safely.");
      queryClient.setQueryData(["meal", record.id], record);
      if (mounted.current) { haptic.success(); setSaved(record); onSaved?.(record); }
      await refresh();
    } catch (err) { if (mounted.current) { haptic.warning(); setError(message(err)); } }
    finally { writing.current = false; if (mounted.current) setBusy(false); }
  };
  const undo = async () => {
    if (writing.current || !saved || saved.id === source?.id || undone) return;
    writing.current = true; setBusy(true); setError(null);
    try {
      const response = await apiRequest<{ deleted: boolean }>(`/api/meals/${encodeURIComponent(saved.id)}`, { method: "DELETE", token: await token() });
      if (response.deleted !== true) throw new Error("The server did not confirm deletion. Retry undo.");
      if (mounted.current) setUndone(true);
      await queryClient.invalidateQueries({ queryKey: ["meal", saved.id] });
      await refresh();
    } catch (err) { if (mounted.current) setError(message(err)); }
    finally { writing.current = false; if (mounted.current) setBusy(false); }
  };

  const errorNode = error ? <Text style={styles.error} testID="meal-repeat-error">{error}</Text> : null;

  // ── Done ────────────────────────────────────────────────────────────────
  if (saved) {
    return (
      <View style={styles.root}>
        <View style={styles.doneBody}>
          <View style={[styles.doneBadge, undone && styles.doneBadgeMuted]}>
            <Icon name={undone ? "close" : "check"} size={28} color={undone ? t.textSoft : t.accentInk} />
          </View>
          <Text style={styles.doneTitle}>{undone ? "Repeat removed" : "Meal logged"}</Text>
          <Text style={styles.doneSub}>
            {undone ? "Only the new entry was removed. The original meal is unchanged." : `Added to ${typeLabel(saved.mealType).toLowerCase()} today.`}
          </Text>
          {!undone ? (
            <View style={styles.doneCard}>
              <Text style={styles.doneMeal} numberOfLines={2}>{saved.description}</Text>
              <Text style={styles.doneKcal}>{formatKcal(saved.calories)} kcal</Text>
            </View>
          ) : null}
          {errorNode}
        </View>
        <View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>
          <Pressable testID="meal-repeat-close" disabled={busy} onPress={onClose} accessibilityRole="button" style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
            <Text style={styles.primaryText}>Done</Text>
          </Pressable>
          {!undone ? (
            <Pressable testID="meal-repeat-undo" disabled={busy} onPress={() => void undo()} accessibilityRole="button" style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
              <Text style={styles.secondaryText}>{busy ? "Undoing…" : "Undo"}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  // ── Confirm ─────────────────────────────────────────────────────────────
  if (selectedId) {
    const fromList = !initialMealId;
    return (
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {fromList ? (
            <Pressable onPress={backToList} disabled={locked} hitSlop={8} style={({ pressed }) => [styles.backLink, pressed && styles.pressed]} accessibilityRole="button" testID="meal-repeat-back">
              <Icon name="chevronLeft" size={16} color={t.accent} />
              <Text style={styles.backText}>All meals</Text>
            </Pressable>
          ) : null}

          {sourceBusy ? <ActivityIndicator style={{ paddingVertical: 40 }} color={t.accent} /> : null}
          {sourceError ? (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>{sourceError}</Text>
              <Pressable testID="meal-repeat-source-retry" onPress={() => setReload((v) => v + 1)} hitSlop={8}>
                <Text style={styles.link}>Try again</Text>
              </Pressable>
            </View>
          ) : null}

          {source && preview ? (
            <>
              <Text style={styles.mealTitle} numberOfLines={3}>{source.description}</Text>
              <Text style={styles.mealSub}>
                Last logged {lastLogged(source.eatenAt)} · {typeLabel(source.mealType)}
              </Text>

              <View style={styles.previewCard}>
                <View style={styles.previewTop}>
                  <Text style={styles.previewKcal}>{formatKcal(preview.calories)}</Text>
                  <Text style={styles.previewUnit}>kcal</Text>
                </View>
                <View style={styles.macroRow}>
                  {([["Protein", preview.proteinG], ["Carbs", preview.carbsG], ["Fat", preview.fatG]] as const).map(([label, grams]) => (
                    <View key={label} style={styles.macroCell}>
                      <Text style={styles.macroLabel}>{label}</Text>
                      <Text style={styles.macroValue}>{finite(grams) ? Math.round(grams) : "—"}<Text style={styles.macroUnit}>g</Text></Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.sectionRow}>
                <Text style={styles.sectionLabel}>Portion</Text>
                <View style={styles.stepper}>
                  <Pressable testID="meal-repeat-portion-down" accessibilityLabel="Smaller portion" disabled={locked || portion <= PORTION_MIN} onPress={() => setPortionSafely(portion - PORTION_STEP)} hitSlop={6} style={({ pressed }) => [styles.stepButton, (portion <= PORTION_MIN) && styles.disabled, pressed && styles.pressed]}>
                    <Text style={styles.stepGlyph}>−</Text>
                  </Pressable>
                  <Text style={styles.stepValue} testID="meal-repeat-portion-value">{portionLabel(portion)}</Text>
                  <Pressable testID="meal-repeat-portion-up" accessibilityLabel="Larger portion" disabled={locked || portion >= PORTION_MAX} onPress={() => setPortionSafely(portion + PORTION_STEP)} hitSlop={6} style={({ pressed }) => [styles.stepButton, (portion >= PORTION_MAX) && styles.disabled, pressed && styles.pressed]}>
                    <Text style={styles.stepGlyph}>+</Text>
                  </Pressable>
                </View>
              </View>
              <View style={styles.segment}>
                {PORTIONS.map((value) => {
                  const active = portion === value;
                  return (
                    <Pressable key={value} testID={`meal-repeat-portion-${value}`} disabled={locked} onPress={() => setPortionSafely(value)} style={[styles.segmentItem, active && styles.segmentItemActive]} accessibilityRole="button" accessibilityState={{ selected: active }}>
                      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{value === 0.5 ? "½×" : value === 1.5 ? "1½×" : `${value}×`}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.sectionLabel, { marginTop: 22 }]}>Log as</Text>
              <View style={styles.segment}>
                {MEAL_TYPES.map(({ value, label }) => {
                  const active = mealType === value;
                  return (
                    <Pressable key={value} testID={`meal-repeat-type-${value}`} disabled={locked} onPress={() => { if (!active) haptic.selection(); setMealType(value); }} style={[styles.segmentItem, active && styles.segmentItemActive]} accessibilityRole="button" accessibilityState={{ selected: active }}>
                      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {preview.ingredients.length ? (
                <Text style={styles.includes} numberOfLines={3}>
                  <Text style={styles.includesLabel}>Includes </Text>
                  {preview.ingredients.map((row) => row.name).join(", ")}
                </Text>
              ) : null}
              {errorNode}
            </>
          ) : null}
        </ScrollView>

        {source && preview ? (
          <View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>
            <Pressable testID="meal-repeat-save" accessibilityRole="button" disabled={busy} accessibilityState={{ busy, disabled: busy }} onPress={() => void save()} style={({ pressed }) => [styles.primary, busy && styles.busy, pressed && styles.pressed]}>
              {busy ? <ActivityIndicator size="small" color={t.accentInk} /> : null}
              <Text style={styles.primaryText}>
                {busy ? "Logging…" : attempt.current ? "Try again" : `Log ${formatKcal(preview.calories)} kcal`}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  }

  // ── Pick ────────────────────────────────────────────────────────────────
  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <View style={styles.search}>
        <Icon name="search" size={16} color={t.textMute} />
        <TextInput
          testID="meal-repeat-search"
          value={query}
          onChangeText={setQuery}
          placeholder="Search your meals"
          placeholderTextColor={t.textMute}
          style={styles.searchInput}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
      </View>

      {filtered.length ? (
        <View style={styles.list}>
          {filtered.map(({ meal, count }, i) => (
            <Pressable
              key={meal.id}
              testID={`meal-repeat-source-${meal.id}`}
              onPress={() => choose(meal.id)}
              style={({ pressed }) => [styles.row, i > 0 && styles.rowDivider, pressed && styles.rowPressed]}
              accessibilityRole="button"
            >
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle} numberOfLines={2}>{meal.description}</Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {typeLabel(meal.mealType)} · {relativeDay(meal.eatenAt)}{count > 1 ? ` · ${count}×` : ""}
                </Text>
              </View>
              <Text style={styles.rowKcal}>{formatKcal(meal.calories)}<Text style={styles.rowKcalUnit}> kcal</Text></Text>
              <Icon name="chevronRight" size={14} color={t.textMute} />
            </Pressable>
          ))}
        </View>
      ) : null}

      {listBusy ? <ActivityIndicator style={{ paddingVertical: 24 }} color={t.accent} /> : null}
      {listError ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>Couldn’t load your meals.</Text>
          <Pressable testID="meal-repeat-list-retry" onPress={() => void loadChoices(choices.length)} hitSlop={8}>
            <Text style={styles.link}>Try again</Text>
          </Pressable>
        </View>
      ) : null}
      {!listBusy && !listError && !filtered.length ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{query.trim() ? "No matches" : "Nothing to repeat yet"}</Text>
          <Text style={styles.emptyBody}>{query.trim() ? "Try another word, or load older meals." : "Meals you log show up here so you can log them again in one tap."}</Text>
        </View>
      ) : null}
      {choices.length < total && !listBusy ? (
        <Pressable onPress={() => void loadChoices(choices.length)} style={({ pressed }) => [styles.more, pressed && styles.pressed]} accessibilityRole="button" testID="meal-repeat-more">
          <Text style={styles.link}>Show older meals</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: t.bg },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.35 },
  busy: { opacity: 0.85 },
  link: { fontFamily: font.sans[600], fontSize: 14, fontWeight: "600", color: t.accent },

  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: r.sm,
    borderCurve: "continuous",
    backgroundColor: t.surface2,
    marginBottom: 14,
  },
  searchInput: { flex: 1, fontFamily: font.sans[400], fontSize: 16, color: t.text, padding: 0 },
  list: {
    backgroundColor: t.surface,
    borderRadius: r.md,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: t.line,
    overflow: "hidden",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 16, minHeight: 64 },
  rowDivider: { borderTopWidth: 1, borderTopColor: t.line },
  rowPressed: { backgroundColor: t.surface2 },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { fontFamily: font.sans[500], fontSize: 15, lineHeight: 20, fontWeight: "500", color: t.text },
  rowMeta: { marginTop: 3, fontFamily: font.sans[400], fontSize: 12.5, color: t.textMute },
  rowKcal: { fontFamily: font.mono[500], fontSize: 14, fontWeight: "500", color: t.text },
  rowKcalUnit: { fontFamily: font.sans[400], fontSize: 11, color: t.textMute },
  more: { alignSelf: "center", paddingVertical: 16, paddingHorizontal: 20 },
  empty: { alignItems: "center", paddingVertical: 40, paddingHorizontal: 24, gap: 6 },
  emptyTitle: { fontFamily: font.sans[600], fontSize: 16, fontWeight: "600", color: t.text },
  emptyBody: { fontFamily: font.sans[400], fontSize: 14, lineHeight: 20, color: t.textSoft, textAlign: "center" },
  notice: {
    marginTop: 12,
    padding: 14,
    borderRadius: r.sm,
    borderCurve: "continuous",
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.line,
    gap: 8,
  },
  noticeText: { fontFamily: font.sans[400], fontSize: 14, lineHeight: 20, color: t.textSoft },

  backLink: { flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-start", marginBottom: 12, marginLeft: -4 },
  backText: { fontFamily: font.sans[600], fontSize: 14, fontWeight: "600", color: t.accent },
  mealTitle: { fontFamily: font.sans[700], fontSize: 22, lineHeight: 28, fontWeight: "700", letterSpacing: -0.4, color: t.text },
  mealSub: { marginTop: 4, fontFamily: font.sans[400], fontSize: 13.5, color: t.textMute },
  previewCard: {
    marginTop: 18,
    padding: 18,
    borderRadius: r.md,
    borderCurve: "continuous",
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.line,
  },
  previewTop: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  previewKcal: { fontFamily: font.mono[500], fontSize: 38, fontWeight: "500", letterSpacing: -1.4, color: t.text },
  previewUnit: { fontFamily: font.sans[500], fontSize: 15, color: t.textMute },
  macroRow: { flexDirection: "row", marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: t.line },
  macroCell: { flex: 1 },
  macroLabel: { fontFamily: font.sans[500], fontSize: 12, color: t.textMute },
  macroValue: { marginTop: 2, fontFamily: font.mono[500], fontSize: 16, fontWeight: "500", color: t.text },
  macroUnit: { fontFamily: font.sans[400], fontSize: 12, color: t.textMute },

  sectionRow: { marginTop: 22, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionLabel: { fontFamily: font.sans[600], fontSize: 13, fontWeight: "600", color: t.textSoft, marginBottom: 8 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  stepButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.line2,
    alignItems: "center",
    justifyContent: "center",
  },
  stepGlyph: { fontFamily: font.sans[500], fontSize: 18, lineHeight: 20, color: t.text },
  stepValue: { minWidth: 44, textAlign: "center", fontFamily: font.mono[500], fontSize: 15, fontWeight: "500", color: t.text },
  segment: {
    flexDirection: "row",
    padding: 3,
    borderRadius: r.sm + 2,
    borderCurve: "continuous",
    backgroundColor: t.surface2,
  },
  segmentItem: { flex: 1, height: 36, borderRadius: r.sm, borderCurve: "continuous", alignItems: "center", justifyContent: "center" },
  segmentItemActive: { backgroundColor: t.surface, boxShadow: "0 1px 3px rgba(15,20,25,0.12)" },
  segmentText: { fontFamily: font.sans[500], fontSize: 13.5, color: t.textSoft },
  segmentTextActive: { fontFamily: font.sans[600], fontWeight: "600", color: t.text },
  includes: { marginTop: 22, fontFamily: font.sans[400], fontSize: 13.5, lineHeight: 20, color: t.textSoft },
  includesLabel: { fontFamily: font.sans[600], fontWeight: "600", color: t.textSoft },
  error: { marginTop: 14, fontFamily: font.sans[500], fontSize: 13.5, lineHeight: 19, color: t.negative },

  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 8,
    backgroundColor: t.bg,
    borderTopWidth: 1,
    borderTopColor: t.line,
  },
  primary: {
    height: 52,
    borderRadius: 16,
    borderCurve: "continuous",
    backgroundColor: t.accent,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryText: { fontFamily: font.sans[700], fontSize: 16, fontWeight: "700", color: t.accentInk },
  secondary: { height: 44, alignItems: "center", justifyContent: "center" },
  secondaryText: { fontFamily: font.sans[600], fontSize: 15, fontWeight: "600", color: t.textSoft },

  doneBody: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  doneBadge: { width: 64, height: 64, borderRadius: 32, backgroundColor: t.accent, alignItems: "center", justifyContent: "center" },
  doneBadgeMuted: { backgroundColor: t.surface2 },
  doneTitle: { marginTop: 16, fontFamily: font.sans[700], fontSize: 22, fontWeight: "700", letterSpacing: -0.4, color: t.text },
  doneSub: { marginTop: 6, fontFamily: font.sans[400], fontSize: 14.5, lineHeight: 20, color: t.textSoft, textAlign: "center" },
  doneCard: {
    marginTop: 20,
    alignSelf: "stretch",
    padding: 16,
    borderRadius: r.md,
    borderCurve: "continuous",
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.line,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  doneMeal: { flex: 1, fontFamily: font.sans[500], fontSize: 15, lineHeight: 20, color: t.text },
  doneKcal: { fontFamily: font.mono[500], fontSize: 15, fontWeight: "500", color: t.text },
});

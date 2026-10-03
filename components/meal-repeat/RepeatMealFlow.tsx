import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { useQueryClient } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { apiRequest } from "@/lib/api-client";
import { getSavedMeal, parsePortionMultiplier, previewRepeatedMeal, repeatSavedMeal, type RepeatMealInput, type SavedMealRecord } from "@/lib/api/meal-repeat";
import { color as t, font } from "@/lib/tokens";

type MealChoice = Omit<SavedMealRecord, "ingredients">;
const message = (error: unknown) => error instanceof Error ? error.message : "Please try again.";
const number = (value: number | null | undefined) => typeof value === "number" && Number.isFinite(value) ? String(value) : "Unknown";
const reusable = (meal: MealChoice) => meal.interpretationStatus === "reviewed" && typeof meal.calories === "number" && Number.isFinite(meal.calories) && meal.calories >= 0;

function Nutrition({ meal }: { meal: SavedMealRecord }) {
  return <View style={styles.card}>
    <Text style={styles.title}>{meal.description}</Text>
    <Text style={styles.body}>{number(meal.calories)} kcal · P {number(meal.proteinG)} g · C {number(meal.carbsG)} g · F {number(meal.fatG)} g</Text>
    <Text style={styles.body}>Total portion: {number(meal.totalGrams)} g</Text>
    {meal.ingredients.map((row, index) => <View key={row.id ?? index} style={styles.ingredient}>
      <Text style={styles.body}>{row.name} · {number(row.grams)} g · {number(row.calories)} kcal</Text>
      <Text style={styles.muted}>P {number(row.proteinG)} g · C {number(row.carbsG)} g · F {number(row.fatG)} g</Text>
    </View>)}
    {!meal.ingredients.length ? <Text style={styles.muted}>This saved meal has no ingredient breakdown. Only its saved nutrition can be repeated.</Text> : null}
  </View>;
}

/** The only repeat write uses the owned full saved source's ID, never a summary. */
export function RepeatMealFlow({ initialMealId, onClose, onSaved }: {
  initialMealId?: string; onClose: () => void; onSaved?: (meal: SavedMealRecord) => void;
}) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const [choices, setChoices] = useState<MealChoice[]>([]);
  const [total, setTotal] = useState(0);
  const [listBusy, setListBusy] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState(initialMealId ?? "");
  const [source, setSource] = useState<SavedMealRecord | null>(null);
  const [sourceBusy, setSourceBusy] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [portionText, setPortionText] = useState("1");
  const [mealType, setMealType] = useState("lunch");
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
      const result = await apiRequest<{ meals: MealChoice[]; total: number }>(`/api/meals?limit=20&offset=${offset}`, { token: await token() });
      if (!mounted.current) return;
      setChoices(previous => offset === 0 ? result.meals : [...previous, ...result.meals.filter(row => !previous.some(old => old.id === row.id))]);
      setTotal(result.total);
    } catch (err) { if (mounted.current) setListError(message(err)); }
    finally { if (mounted.current) setListBusy(false); }
  };
  useEffect(() => { void loadChoices(0); }, []); // fetch list once per flow, then paginate explicitly
  useEffect(() => {
    if (!selectedId) return;
    let current = true;
    setSource(null); setSourceBusy(true); setSourceError(null);
    void (async () => {
      try {
        const detail = await getSavedMeal(selectedId, await token());
        if (!current) return;
        if (!reusable(detail)) throw new Error("Review this meal and confirm its nutrition before repeating it. Failed estimates can be retried from the meal editor.");
        if (detail.id !== selectedId || !Array.isArray(detail.ingredients)) throw new Error("Could not load the full saved meal.");
        setSource(detail); setMealType(detail.mealType);
      } catch (err) { if (current) setSourceError(message(err)); }
      finally { if (current) setSourceBusy(false); }
    })();
    return () => { current = false; };
  }, [selectedId, reload]);
  const multiplier = parsePortionMultiplier(portionText);
  const preview = source && multiplier ? previewRepeatedMeal(source, multiplier) : null;
  const refresh = async () => {
    await Promise.all([queryClient.invalidateQueries({ queryKey: ["meals"] }), queryClient.invalidateQueries({ queryKey: ["dashboard"] })]);
  };
  const save = async () => {
    if (writing.current || !source || !multiplier || saved) return;
    writing.current = true; setBusy(true); setError(null);
    attempt.current ??= { sourceId: source.id, input: { requestId: randomUUID(), portionMultiplier: multiplier, eatenAt: new Date().toISOString(), mealType } };
    try {
      const record = await repeatSavedMeal(attempt.current.sourceId, await token(), attempt.current.input);
      // Refuse to show/undo a source record if a malformed response returns it.
      if (!record.id || record.id === attempt.current.sourceId || !Array.isArray(record.ingredients)) throw new Error("The server did not confirm a new saved meal. Retry safely.");
      queryClient.setQueryData(["meal", record.id], record);
      if (mounted.current) { setSaved(record); onSaved?.(record); }
      await refresh();
    } catch (err) { if (mounted.current) setError(message(err)); }
    finally { writing.current = false; if (mounted.current) setBusy(false); }
  };
  const undo = async () => {
    if (writing.current || !saved || saved.id === source?.id || undone) return;
    writing.current = true; setBusy(true); setError(null);
    try {
      const response = await apiRequest<{ deleted: boolean }>(`/api/meals/${encodeURIComponent(saved.id)}`, { method: "DELETE", token: await token() });
      if (response.deleted !== true) throw new Error("The server did not confirm deletion. Retry undo.");
      if (mounted.current) setUndone(true);
      await queryClient.invalidateQueries({queryKey:["meal", saved.id]});
      await refresh();
    } catch (err) { if (mounted.current) setError(message(err)); }
    finally { writing.current = false; if (mounted.current) setBusy(false); }
  };
  const locked = busy || !!attempt.current;
  return <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={styles.heading}>{saved ? undone ? "Repeat removed" : "Meal saved" : "Repeat a familiar meal"}</Text>
    {saved ? <>
      <Text style={styles.body}>{undone ? "Only the newly repeated entry was removed. Your original meal is unchanged." : "Confirmed saved record — nutrition below is exactly what the server saved."}</Text>
      {!undone ? <Nutrition meal={saved} /> : null}
      {!undone ? <Pressable testID="meal-repeat-undo" disabled={busy} onPress={() => void undo()} style={styles.button}><Text style={styles.buttonText}>{busy ? "Working…" : "Undo this new meal"}</Text></Pressable> : null}
    </> : <>
      <Text style={styles.muted}>Recent saved meals · choose the exact entry you want to reuse.</Text>
      {choices.map(choice => <Pressable key={choice.id} testID={`meal-repeat-source-${choice.id}`} disabled={locked || !reusable(choice)} onPress={() => { setSelectedId(choice.id); setError(null); }} style={[styles.choice, selectedId === choice.id && styles.selected]}>
        <Text style={styles.body}>{choice.description}</Text>
        <Text style={styles.muted}>{choice.mealType} · {new Date(choice.eatenAt).toLocaleString()} · {number(choice.calories)} kcal{!reusable(choice) ? " · Review nutrition first" : ""}</Text>
      </Pressable>)}
      {listBusy ? <ActivityIndicator color={t.accent} /> : null}
      {listError ? <><Text style={styles.error}>{listError}</Text><Pressable testID="meal-repeat-list-retry" onPress={() => void loadChoices(choices.length)} style={styles.button}><Text style={styles.buttonText}>Retry loading meals</Text></Pressable></> : null}
      {!listBusy && !listError && !choices.length ? <Text style={styles.body}>No saved meals yet. Log a meal first, then repeat it here.</Text> : null}
      {choices.length < total ? <Pressable disabled={listBusy || locked} onPress={() => void loadChoices(choices.length)} style={styles.button}><Text style={styles.buttonText}>More recent meals</Text></Pressable> : null}
      {sourceBusy ? <ActivityIndicator color={t.accent} /> : null}
      {sourceError ? <><Text style={styles.error}>{sourceError}</Text><Pressable testID="meal-repeat-source-retry" style={styles.button} onPress={() => setReload(v => v + 1)}><Text style={styles.buttonText}>Retry loading selected meal</Text></Pressable></> : null}
      {source ? <>
        <Text style={styles.title}>Portion of the original saved meal</Text>
        <View style={styles.row}>{[0.5, 1, 1.5, 2].map(value => <Pressable key={value} disabled={locked} testID={`meal-repeat-portion-${value}`} style={[styles.choice, multiplier === value && styles.selected]} onPress={() => setPortionText(String(value))}><Text style={styles.body}>{value}×</Text></Pressable>)}</View>
        <TextInput testID="meal-repeat-custom" accessibilityLabel="Custom portion multiplier" editable={!locked} value={portionText} onChangeText={setPortionText} keyboardType="decimal-pad" style={styles.input} />
        {!multiplier ? <Text style={styles.error}>Enter a portion greater than zero and at most 20, e.g. 1.25.</Text> : null}
        <Text style={styles.muted}>Same food, proportional estimate from the saved nutrition — no new AI estimate. Use the ingredient editor instead if the food changed. Unknown nutrition stays unknown.</Text>
        <Text style={styles.title}>Save for today · {new Date().toLocaleDateString()}</Text>
        <View style={styles.row}>{["breakfast", "lunch", "dinner", "snack"].map(type => <Pressable key={type} disabled={locked} style={[styles.choice, mealType === type && styles.selected]} onPress={() => setMealType(type)}><Text style={styles.body}>{type}</Text></Pressable>)}</View>
        {preview ? <Nutrition meal={preview} /> : null}
        {attempt.current && error ? <Text style={styles.muted}>Your selection and portion are preserved. Retry uses the same request so it cannot add this meal twice.</Text> : null}
        <Pressable testID="meal-repeat-save" accessibilityRole="button" disabled={busy || !preview} onPress={() => void save()} style={[styles.button, (!preview || busy) && styles.disabled]}><Text style={styles.buttonText}>{busy ? "Saving…" : attempt.current ? "Retry save" : "Save repeated meal"}</Text></Pressable>
      </> : null}
    </>}
    {error ? <Text style={styles.error} testID="meal-repeat-error">{error}</Text> : null}
    <Pressable disabled={busy} testID="meal-repeat-close" onPress={onClose} style={styles.choice}><Text style={styles.body}>{saved ? "Done" : "Cancel"}</Text></Pressable>
  </ScrollView>;
}
const styles = StyleSheet.create({
  root:{flex:1,backgroundColor:t.bg},content:{padding:20,paddingTop:24,paddingBottom:48,gap:14},
  heading:{fontFamily:font.sans[600],fontSize:22,color:t.text},title:{fontFamily:font.sans[600],fontSize:16,color:t.text},
  body:{fontFamily:font.sans[400],fontSize:14,color:t.text,lineHeight:21},muted:{fontFamily:font.sans[400],fontSize:12,color:t.textMute,lineHeight:18},
  card:{padding:16,borderRadius:14,borderWidth:1,borderColor:t.line,backgroundColor:t.surface,gap:10},
  choice:{padding:12,borderRadius:12,borderWidth:1,borderColor:t.line},selected:{borderColor:t.accent,backgroundColor:t.surface},
  row:{flexDirection:"row",flexWrap:"wrap",gap:8},input:{borderWidth:1,borderColor:t.line,borderRadius:12,color:t.text,padding:14,fontSize:16},
  button:{backgroundColor:t.accent,padding:16,borderRadius:14,alignItems:"center"},buttonText:{fontFamily:font.sans[600],fontSize:14,color:t.accentInk},
  error:{color:t.negative,fontSize:13},disabled:{opacity:0.45},ingredient:{borderTopWidth:1,borderTopColor:t.line,paddingTop:8},
});

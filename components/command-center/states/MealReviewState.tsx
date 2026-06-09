import { Pressable, StyleSheet, Text, View } from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/Icon";
import { haptic } from "@/lib/haptics";
import { useCommandCenterOverlay } from "@/components/command-center/CommandCenterProvider";
import { formatMealTypeLabel } from "@/components/command-center/helpers";
import type { MealReviewIngredient } from "@/components/command-center/types";
import { color as t, font } from "@/lib/tokens";

export function MealReviewState({
  onClose,
  onAddIngredient,
  onEditIngredient,
  onLongPressIngredient,
}: {
  onClose: () => void;
  onAddIngredient: () => void;
  onEditIngredient: (ingredient: MealReviewIngredient) => void;
  onLongPressIngredient: (ingredient: MealReviewIngredient) => void;
}) {
  const { snapshot, dispatch } = useCommandCenterOverlay();
  const insets = useSafeAreaInsets();
  const reviewDraft = snapshot.review?.kind === "meal" ? snapshot.review : null;
  if (!reviewDraft) return null;

  const meal = reviewDraft.interpreted.payload;
  const mealTypeLabel = formatMealTypeLabel(meal.mealType).toUpperCase();
  const totalGramsLabel = `${Math.round(reviewDraft.totalGrams)} G`;
  const eyebrowParts = [mealTypeLabel, reviewDraft.eatenAtLabel, totalGramsLabel].filter(Boolean);
  const eyebrow = eyebrowParts.join(" · ");

  return (
    <BottomSheetScrollView
      contentContainerStyle={[styles.mealReviewContent, { paddingBottom: insets.bottom + 22 }]}
      showsVerticalScrollIndicator={false}
      keyboardDismissMode="on-drag"
    >
      <View style={styles.mealReviewYouSaidRow}>
        <Text style={styles.mealReviewYouSaidLabel}>YOU SAID</Text>
        <Pressable onPress={() => dispatch({ type: "review.transcript.edit" })} testID="cc-review-edit-transcript">
          <Text style={styles.mealReviewEditLink}>EDIT</Text>
        </Pressable>
      </View>
      <Text style={styles.mealReviewTranscript} selectable>{`"${reviewDraft.transcript}"`}</Text>

      <View style={styles.mealReviewBigCard}>
        <View style={styles.mealReviewHeroRow}>
          <View style={styles.mealReviewHeroLeft}>
            <Text style={styles.mealReviewEyebrow}>{eyebrow}</Text>
            <Text style={styles.mealReviewName} selectable>{meal.description}</Text>
          </View>
          <View style={styles.mealReviewHeroRight}>
            <Text style={styles.mealReviewKcal} selectable>{meal.calories}</Text>
            <Text style={styles.mealReviewKcalCaption}>KCAL · EST.</Text>
          </View>
        </View>

        <View style={styles.mealReviewMacrosGrid}>
          <View style={styles.mealReviewMacroCell}>
            <Text style={styles.mealReviewMacroLabel}>PROTEIN</Text>
            <View style={styles.mealReviewMacroValueRow}>
              <Text style={[styles.mealReviewMacroValue, styles.mealReviewMacroValueAccent]} selectable>
                {reviewDraft.macros.protein}
              </Text>
              <Text style={styles.mealReviewMacroUnit}>g</Text>
            </View>
          </View>
          <View style={styles.mealReviewMacroCell}>
            <Text style={styles.mealReviewMacroLabel}>CARBS</Text>
            <View style={styles.mealReviewMacroValueRow}>
              <Text style={[styles.mealReviewMacroValue, styles.mealReviewMacroValueSoft]} selectable>
                {reviewDraft.macros.carbs}
              </Text>
              <Text style={styles.mealReviewMacroUnit}>g</Text>
            </View>
          </View>
          <View style={styles.mealReviewMacroCell}>
            <Text style={styles.mealReviewMacroLabel}>FAT</Text>
            <View style={styles.mealReviewMacroValueRow}>
              <Text style={[styles.mealReviewMacroValue, styles.mealReviewMacroValueSoft]} selectable>
                {reviewDraft.macros.fat}
              </Text>
              <Text style={styles.mealReviewMacroUnit}>g</Text>
            </View>
          </View>
        </View>

        <View style={styles.mealReviewDivider} />

        <View style={styles.mealReviewIngredientsHeader}>
          <Text style={styles.mealReviewIngredientsTitle}>INGREDIENTS</Text>
          <Pressable onPress={() => { haptic.tap(); onAddIngredient(); }} testID="cc-review-add-ingredient">
            <Text style={styles.mealReviewAddLink}>+ ADD</Text>
          </Pressable>
        </View>

        {reviewDraft.ingredients.map((ingredient, index) => (
          <Pressable
            key={ingredient.id}
            onPress={() => onEditIngredient(ingredient)}
            onLongPress={() => onLongPressIngredient(ingredient)}
            delayLongPress={400}
            style={[
              styles.mealReviewIngredientRow,
              index === 0 ? null : styles.mealReviewIngredientRowDivider,
            ]}
            testID={`cc-review-ingredient-${index}`}
          >
            <View style={styles.mealReviewIngredientCopy}>
              <Text style={styles.mealReviewIngredientName} selectable>{ingredient.name}</Text>
              <Text style={styles.mealReviewIngredientMacros} selectable>
                {`P ${Math.round(ingredient.proteinG)}g · C ${Math.round(ingredient.carbsG)}g · F ${Math.round(ingredient.fatG)}g`}
              </Text>
            </View>
            <Text style={styles.mealReviewIngredientQty} selectable>{`${Math.round(ingredient.grams)} g`}</Text>
            <Text style={styles.mealReviewIngredientCal} selectable>{ingredient.calories}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.mealReviewActions}>
        <Pressable
          style={styles.mealReviewDiscardButton}
          onPress={onClose}
          testID="cc-review-discard"
        >
          <Text style={styles.mealReviewDiscardText}>DISCARD</Text>
        </Pressable>
        <Pressable
          style={styles.mealReviewSaveButton}
          onPress={() => { haptic.success(); void dispatch({ type: "review.save" }); }}
          testID="cc-review-save"
        >
          <Text style={styles.mealReviewSaveText}>Save meal</Text>
          <Icon name="check" size={16} color={t.accentInk} />
        </Pressable>
      </View>
    </BottomSheetScrollView>
  );
}

const styles = StyleSheet.create({
  mealReviewContent: { paddingHorizontal: 22, paddingBottom: 8 },
  mealReviewYouSaidRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  mealReviewYouSaidLabel: {
    fontFamily: font.sans[600],
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 1.68,
    textTransform: "uppercase",
    color: t.accent,
  },
  mealReviewEditLink: {
    fontFamily: font.sans[600],
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: t.accent,
  },
  mealReviewTranscript: {
    fontFamily: font.sans[400],
    fontSize: 13.5,
    lineHeight: 19,
    color: t.textSoft,
    marginBottom: 16,
  },
  mealReviewBigCard: {
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 20,
    borderCurve: "continuous",
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  mealReviewHeroRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  mealReviewHeroLeft: { flex: 1 },
  mealReviewEyebrow: {
    fontFamily: font.sans[600],
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 1.68,
    textTransform: "uppercase",
    color: t.accent,
  },
  mealReviewName: {
    fontFamily: font.sans[600],
    fontSize: 22,
    fontWeight: "600",
    letterSpacing: -0.44,
    color: t.text,
    marginTop: 6,
    lineHeight: 25,
  },
  mealReviewHeroRight: { alignItems: "flex-end" },
  mealReviewKcal: {
    fontFamily: font.mono[500],
    fontSize: 44,
    color: t.accent,
    letterSpacing: -1.76,
    lineHeight: 44,
  },
  mealReviewKcalCaption: {
    fontFamily: font.sans[600],
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: t.textMute,
    marginTop: 2,
  },
  mealReviewMacrosGrid: {
    flexDirection: "row",
    gap: 8,
    marginTop: 18,
  },
  mealReviewMacroCell: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 10,
    borderCurve: "continuous",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  mealReviewMacroLabel: {
    fontFamily: font.sans[600],
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: t.textMute,
  },
  mealReviewMacroValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 4,
  },
  mealReviewMacroValue: {
    fontFamily: font.mono[500],
    fontSize: 18,
    letterSpacing: -0.36,
  },
  mealReviewMacroValueAccent: { color: t.accent },
  mealReviewMacroValueSoft: { color: t.textSoft },
  mealReviewMacroUnit: {
    fontFamily: font.sans[400],
    fontSize: 10,
    color: t.textMute,
    marginLeft: 2,
  },
  mealReviewDivider: {
    height: 1,
    backgroundColor: t.line,
    marginTop: 18,
    marginBottom: 12,
  },
  mealReviewIngredientsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  mealReviewIngredientsTitle: {
    fontFamily: font.sans[600],
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 1.68,
    textTransform: "uppercase",
    color: t.textMute,
  },
  mealReviewAddLink: {
    fontFamily: font.sans[600],
    fontSize: 11,
    fontWeight: "600",
    color: t.accent,
  },
  mealReviewIngredientRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  mealReviewIngredientRowDivider: {
    borderTopWidth: 1,
    borderTopColor: t.line,
  },
  mealReviewIngredientCopy: {
    flex: 1,
    paddingRight: 8,
  },
  mealReviewIngredientName: {
    fontFamily: font.sans[400],
    fontSize: 14,
    color: t.text,
  },
  mealReviewIngredientMacros: {
    marginTop: 3,
    fontFamily: font.mono[400],
    fontSize: 10.5,
    color: t.textMute,
    letterSpacing: 0.2,
  },
  mealReviewIngredientQty: {
    fontFamily: font.mono[400],
    fontSize: 11,
    color: t.textMute,
    width: 56,
    textAlign: "right",
  },
  mealReviewIngredientCal: {
    fontFamily: font.mono[400],
    fontSize: 14,
    color: t.text,
    width: 42,
    textAlign: "right",
  },
  mealReviewActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  mealReviewDiscardButton: {
    width: 110,
    height: 52,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 14,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  mealReviewDiscardText: {
    fontFamily: font.sans[600],
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.52,
    textTransform: "uppercase",
    color: t.textSoft,
  },
  mealReviewSaveButton: {
    flex: 1,
    height: 52,
    backgroundColor: t.accent,
    borderRadius: 14,
    borderCurve: "continuous",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  mealReviewSaveText: {
    fontFamily: font.sans[700],
    fontSize: 14,
    fontWeight: "700",
    color: t.accentInk,
    letterSpacing: 0.28,
  },
});

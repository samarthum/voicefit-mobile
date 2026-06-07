/**
 * IngredientList
 *
 * Renders the ingredients section inside the meal-edit summary card:
 * the divider, "INGREDIENTS / + ADD" header, and the list of ingredient rows.
 *
 * All state lives in the parent route file; this component is fully
 * presentational.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { MealReviewIngredient } from "@/components/command-center/types";
import { color as t, font } from "@/lib/tokens";

interface Props {
  ingredients: MealReviewIngredient[];
  isPendingEstimate: boolean;
  onAdd: () => void;
  onEdit: (ingredient: MealReviewIngredient) => void;
  onLongPress: (ingredient: MealReviewIngredient) => void;
}

function IngredientRow({
  ingredient,
  index,
  isPendingEstimate,
  onEdit,
  onLongPress,
}: {
  ingredient: MealReviewIngredient;
  index: number;
  isPendingEstimate: boolean;
  onEdit: (ingredient: MealReviewIngredient) => void;
  onLongPress: (ingredient: MealReviewIngredient) => void;
}) {
  return (
    <Pressable
      onPress={() => {
        if (!isPendingEstimate) onEdit(ingredient);
      }}
      onLongPress={() => {
        if (!isPendingEstimate) onLongPress(ingredient);
      }}
      delayLongPress={400}
      style={[
        styles.ingredientRow,
        index === 0 ? null : styles.ingredientRowDivider,
      ]}
      testID={`meal-edit-ingredient-${index}`}
    >
      <View style={styles.ingredientCopy}>
        <Text style={styles.ingredientName}>{ingredient.name}</Text>
        <Text style={styles.ingredientMacros}>
          {`P ${Math.round(ingredient.proteinG)}g · C ${Math.round(ingredient.carbsG)}g · F ${Math.round(ingredient.fatG)}g`}
        </Text>
      </View>
      <Text style={styles.ingredientQty} selectable>{`${Math.round(ingredient.grams)} g`}</Text>
      <Text style={styles.ingredientCal} selectable>{ingredient.calories}</Text>
    </Pressable>
  );
}

export function IngredientList({ ingredients, isPendingEstimate, onAdd, onEdit, onLongPress }: Props) {
  return (
    <>
      <View style={styles.divider} />

      <View style={styles.ingredientsHeader}>
        <Text style={styles.ingredientsTitle}>INGREDIENTS</Text>
        <Pressable
          onPress={onAdd}
          disabled={isPendingEstimate}
          testID="meal-edit-add-ingredient"
        >
          <Text style={[styles.addLink, isPendingEstimate ? styles.addLinkDisabled : null]}>
            + ADD
          </Text>
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
          <IngredientRow
            key={ingredient.id}
            ingredient={ingredient}
            index={index}
            isPendingEstimate={isPendingEstimate}
            onEdit={onEdit}
            onLongPress={onLongPress}
          />
        ))
      )}
    </>
  );
}

const styles = StyleSheet.create({
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
  ingredientCopy: {
    flex: 1,
    paddingRight: 8,
  },
  ingredientName: {
    fontFamily: font.sans[400],
    fontSize: 14,
    color: t.text,
  },
  ingredientMacros: {
    marginTop: 3,
    fontFamily: font.mono[400],
    fontSize: 10.5,
    color: t.textMute,
    letterSpacing: 0.2,
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
});

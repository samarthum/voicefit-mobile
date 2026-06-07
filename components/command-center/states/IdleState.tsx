import { Pressable, StyleSheet, Text, View } from "react-native";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { Icon } from "@/components/Icon";
import { useCommandCenterOverlay } from "@/components/command-center/CommandCenterProvider";
import { EXERCISE_CATALOG } from "@/lib/exercise-catalog";
import { color as t, font } from "@/lib/tokens";

export function IdleState() {
  const { snapshot, dispatch } = useCommandCenterOverlay();
  const { input, quickAddItems, screenContext } = snapshot;
  const sendDisabled = !input.text.trim();
  const isWorkout = screenContext.screen === "workout";
  const placeholder = isWorkout
    ? 'Try "did 3 sets of squats at 80…"'
    : 'Try "had a chicken caesar and a diet coke for lunch"…';

  return (
    <View style={styles.idleBody}>
      <View style={styles.idleInputCard}>
        <BottomSheetTextInput
          style={styles.idleInput}
          placeholder={placeholder}
          placeholderTextColor={t.textSoft}
          value={input.text}
          onChangeText={(text) => dispatch({ type: "text.change", text })}
          multiline
          testID="cc-input-text"
        />
      </View>

      <View style={styles.idleActionsRow}>
        <Pressable
          style={styles.idleSquareBtn}
          onPress={() => void dispatch({ type: "photo.menu.open" })}
          accessibilityRole="button"
          accessibilityLabel="Add meal photo"
          testID="cc-camera"
        >
          <Icon name="camera" size={20} color={t.textSoft} />
        </Pressable>

        <Pressable
          style={styles.idleMicWrap}
          onPress={() => void dispatch({ type: "voice.start" })}
          accessibilityRole="button"
          accessibilityLabel="Start voice input"
          testID="cc-big-mic"
        >
          <View pointerEvents="none" style={styles.idleMicHaloOuter} />
          <View pointerEvents="none" style={styles.idleMicHaloMid} />
          <View style={styles.idleMicCore}>
            <Icon name="mic" size={22} color={t.accentInk} />
          </View>
        </Pressable>

        <Pressable
          style={[styles.idleSquareBtn, sendDisabled && styles.idleSquareBtnDisabled]}
          disabled={sendDisabled}
          onPress={() => void dispatch({ type: "text.submit" })}
          accessibilityRole="button"
          accessibilityLabel="Submit entry"
          testID="cc-send"
        >
          <Icon name="sparkSend" size={16} color={t.text} />
        </Pressable>
      </View>

      <Text style={styles.idleCaption}>HOLD TO SPEAK · OR TYPE</Text>

      {isWorkout ? (
        <View style={styles.frequentSection}>
          <Text style={styles.frequentLabel}>FREQUENT</Text>
          {EXERCISE_CATALOG.slice(0, 5).map((exercise, index) => (
            <Pressable
              key={exercise.name}
              style={styles.frequentRow}
              onPress={() => {
                dispatch({ type: "text.change", text: `3 sets of ${exercise.name}` });
              }}
              testID={`cc-exercise-${index}`}
            >
              <View style={styles.frequentText}>
                <Text style={styles.frequentName}>{exercise.name}</Text>
                <Text style={styles.frequentSub}>
                  {exercise.equipment} · {exercise.group}
                </Text>
              </View>
              <View style={styles.frequentPlus}>
                <Icon name="plus" size={12} color={t.accent} />
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.frequentSection}>
          <Text style={styles.frequentLabel}>FREQUENT</Text>
          {quickAddItems.slice(0, 3).map((item, index) => (
            <Pressable
              key={item.id}
              style={styles.frequentRow}
              onPress={() => {
                void dispatch({ type: "quick-add.save", item });
              }}
              testID={`cc-quick-add-${index}`}
            >
              <View style={styles.frequentText}>
                <Text style={styles.frequentName}>{item.description}</Text>
                <Text style={styles.frequentSub}>{item.calories} kcal</Text>
              </View>
              <View style={styles.frequentPlus}>
                <Icon name="plus" size={12} color={t.accent} />
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  idleBody: { paddingHorizontal: 22 },
  idleInputCard: {
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 16,
    borderCurve: "continuous",
    padding: 16,
    minHeight: 100,
  },
  idleInput: {
    fontFamily: font.sans[400],
    fontSize: 14.5,
    color: t.text,
    lineHeight: 21,
    minHeight: 68,
    padding: 0,
    textAlignVertical: "top",
  },
  idleActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 24,
    paddingHorizontal: 4,
    paddingBottom: 6,
  },
  idleSquareBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderCurve: "continuous",
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.line,
    alignItems: "center",
    justifyContent: "center",
  },
  idleSquareBtnDisabled: { opacity: 0.4 },
  idleMicWrap: {
    width: 84,
    height: 84,
    alignItems: "center",
    justifyContent: "center",
  },
  idleMicHaloOuter: {
    position: "absolute",
    width: 112,
    height: 112,
    borderRadius: 999,
    backgroundColor: "transparent",
  },
  idleMicHaloMid: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 999,
    backgroundColor: "transparent",
  },
  idleMicCore: {
    width: 84,
    height: 84,
    borderRadius: 999,
    backgroundColor: t.accent,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 6px 14px rgba(15,20,25,0.12)",
  },
  idleCaption: {
    fontFamily: font.sans[500],
    fontSize: 11,
    color: t.textMute,
    letterSpacing: 1.76,
    textAlign: "center",
    marginTop: 4,
  },
  frequentSection: { marginTop: 24 },
  frequentLabel: {
    fontFamily: font.sans[600],
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 1.68,
    color: t.textSoft,
    marginBottom: 10,
    paddingLeft: 4,
  },
  frequentRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: t.line,
  },
  frequentText: { flex: 1 },
  frequentName: {
    fontFamily: font.sans[500],
    fontSize: 14.5,
    fontWeight: "500",
    color: t.text,
  },
  frequentSub: {
    fontFamily: font.mono[400],
    fontSize: 11,
    color: t.textMute,
    marginTop: 3,
  },
  frequentPlus: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.line,
    alignItems: "center",
    justifyContent: "center",
  },
});

import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";
import { BottomSheetTextInput } from "@/components/command-center/SheetTextInput";
import { Icon } from "@/components/Icon";
import { SheetShell } from "@/components/command-center/states/SheetShell";
import { useCommandCenterOverlay } from "@/components/command-center/CommandCenterProvider";
import { color as t, font } from "@/lib/tokens";
import { isSavingState, isReviewLocked } from "./saving-ui";

/**
 * Photo confirm step. The photo alone is enough: details are optional and only
 * there for what a camera can't see (portion, brand, hidden oil). One primary
 * action; swapping the photo lives on the photo itself.
 */
export function PhotoState({ onClose }: { onClose: () => void }) {
  const { snapshot, dispatch } = useCommandCenterOverlay();
  const reducedMotion = useReducedMotion();
  const photo = snapshot.input.selectedMealPhoto;
  const busy = isSavingState(snapshot.state) || snapshot.state === "cc_saved";
  const locked = isReviewLocked(snapshot);
  const failure = snapshot.state === "cc_error" ? snapshot.error.copy : null;

  return (
    <SheetShell title="Log meal photo" onClose={onClose} showCloseButton={!locked}>
      <View style={styles.body}>
        <View style={styles.previewWrap}>
          {photo ? (
            <Image
              source={{ uri: photo.uri }}
              style={styles.preview}
              contentFit="cover"
              transition={150}
              testID="cc-photo-preview"
            />
          ) : (
            <View style={[styles.preview, styles.previewFallback]}>
              <Icon name="camera" size={22} color={t.textMute} />
            </View>
          )}
          <Pressable
            style={({ pressed }) => [styles.changePill, pressed && styles.pressed, locked && styles.disabled]}
            disabled={locked}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Change photo"
            accessibilityState={{ disabled: locked }}
            onPress={() => void dispatch({ type: "photo.menu.open" })}
            testID="cc-photo-replace"
          >
            <Icon name="camera" size={14} color="#FFFFFF" />
            <Text style={styles.changeText}>Change</Text>
          </Pressable>
        </View>

        <Text style={styles.fieldLabel}>Details <Text style={styles.optional}>· optional</Text></Text>
        <View style={styles.contextCard}>
          <BottomSheetTextInput
            style={styles.contextInput}
            placeholder="Portion, brand, anything hidden…"
            placeholderTextColor={t.textMute}
            editable={!locked}
            value={snapshot.input.text}
            onChangeText={(text) => dispatch({ type: "text.change", text })}
            multiline
            maxLength={280}
            testID="cc-photo-context"
          />
        </View>

        {failure ? (
          <Animated.View
            entering={reducedMotion ? undefined : FadeIn.duration(180)}
            style={styles.failure}
            accessibilityLiveRegion="polite"
          >
            <Icon name="warning" size={16} color={t.warn} />
            <View style={{ flex: 1 }}>
              <Text style={styles.failureTitle}>{failure.title}</Text>
              {failure.body ? <Text style={styles.failureBody}>{failure.body}</Text> : null}
            </View>
          </Animated.View>
        ) : null}

        <Pressable
          style={({ pressed }) => [styles.primary, pressed && !busy && styles.pressed]}
          disabled={busy}
          accessibilityRole="button"
          accessibilityState={{ busy, disabled: busy }}
          aria-busy={busy}
          onPress={() => { if (!busy) void dispatch({ type: failure ? "error.primary" : "photo.submit" }); }}
          testID="cc-photo-submit"
        >
          {busy ? <ActivityIndicator size="small" color={t.accentInk} /> : <Icon name="sparkSend" size={16} color={t.accentInk} />}
          <Text style={styles.primaryText}>{busy ? "Uploading…" : failure ? failure.primary : "Log meal"}</Text>
        </Pressable>
      </View>
    </SheetShell>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 22, paddingBottom: 4 },
  previewWrap: { position: "relative" },
  preview: {
    width: "100%",
    aspectRatio: 1.5,
    borderRadius: 20,
    borderCurve: "continuous",
    backgroundColor: t.surface2,
  },
  previewFallback: { alignItems: "center", justifyContent: "center" },
  changePill: {
    position: "absolute",
    right: 10,
    bottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(15,20,25,0.62)",
  },
  changeText: { fontFamily: font.sans[600], fontSize: 13, fontWeight: "600", color: "#FFFFFF" },
  fieldLabel: {
    marginTop: 16,
    marginBottom: 6,
    fontFamily: font.sans[600],
    fontSize: 13,
    fontWeight: "600",
    color: t.textSoft,
  },
  optional: { fontFamily: font.sans[400], fontWeight: "400", color: t.textMute },
  contextCard: {
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 14,
    borderCurve: "continuous",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  contextInput: {
    fontFamily: font.sans[400],
    fontSize: 15,
    color: t.text,
    lineHeight: 21,
    minHeight: 42,
    maxHeight: 84,
    padding: 0,
    textAlignVertical: "top",
  },
  failure: { marginTop: 12, flexDirection: "row", gap: 8, alignItems: "flex-start" },
  failureTitle: { fontFamily: font.sans[600], fontSize: 14, fontWeight: "600", color: t.text },
  failureBody: { marginTop: 2, fontFamily: font.sans[400], fontSize: 13, lineHeight: 18, color: t.textSoft },
  primary: {
    marginTop: 16,
    height: 52,
    borderRadius: 16,
    borderCurve: "continuous",
    backgroundColor: t.accent,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryText: { fontFamily: font.sans[700], fontSize: 16, fontWeight: "700", color: t.accentInk },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.5 },
});

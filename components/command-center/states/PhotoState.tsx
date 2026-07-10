import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { Icon } from "@/components/Icon";
import { SheetShell } from "@/components/command-center/states/SheetShell";
import { useCommandCenterOverlay } from "@/components/command-center/CommandCenterProvider";
import { color as t, font } from "@/lib/tokens";

export function PhotoState({ onClose }: { onClose: () => void }) {
  const { snapshot, dispatch } = useCommandCenterOverlay();
  const photo = snapshot.input.selectedMealPhoto;

  return (
    <SheetShell title="Log meal photo" onClose={onClose} scrollable>
      <View style={styles.photoBody}>
        {photo ? (
          <Image
            source={{ uri: photo.uri }}
            style={styles.photoPreview}
            contentFit="cover"
            transition={150}
            testID="cc-photo-preview"
          />
        ) : (
          <View style={styles.photoPreviewFallback}>
            <Icon name="camera" size={20} color={t.textMute} />
          </View>
        )}

        <View style={styles.photoContextCard}>
          <BottomSheetTextInput
            style={styles.photoContextInput}
            placeholder="Add context, e.g. chicken, rice, and sauce"
            placeholderTextColor={t.textSoft}
            value={snapshot.input.text}
            onChangeText={(text) => dispatch({ type: "text.change", text })}
            multiline
            testID="cc-photo-context"
          />
        </View>

        <View style={styles.photoActions}>
          <Pressable
            style={styles.photoSecondaryButton}
            onPress={() => void dispatch({ type: "photo.menu.open" })}
            testID="cc-photo-replace"
          >
            <Text style={styles.photoSecondaryText}>Change photo</Text>
          </Pressable>
          <Pressable
            style={styles.photoPrimaryButton}
            onPress={() => void dispatch({ type: "photo.submit" })}
            testID="cc-photo-submit"
          >
            <Text style={styles.photoPrimaryText}>Submit photo</Text>
            <Icon name="sparkSend" size={16} color={t.accentInk} />
          </Pressable>
        </View>
      </View>
    </SheetShell>
  );
}

const styles = StyleSheet.create({
  photoBody: { paddingHorizontal: 22, paddingBottom: 4 },
  photoPreview: {
    width: "100%",
    aspectRatio: 1.35,
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.line,
  },
  photoPreviewFallback: {
    width: "100%",
    aspectRatio: 1.35,
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.line,
    alignItems: "center",
    justifyContent: "center",
  },
  photoContextCard: {
    marginTop: 14,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 16,
    borderCurve: "continuous",
    padding: 14,
    minHeight: 84,
  },
  photoContextInput: {
    fontFamily: font.sans[400],
    fontSize: 14.5,
    color: t.text,
    lineHeight: 21,
    minHeight: 56,
    padding: 0,
    textAlignVertical: "top",
  },
  photoActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 16,
  },
  photoSecondaryButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderCurve: "continuous",
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.line,
    alignItems: "center",
    justifyContent: "center",
  },
  photoSecondaryText: {
    fontFamily: font.sans[600],
    fontSize: 13,
    fontWeight: "600",
    color: t.textSoft,
  },
  photoPrimaryButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderCurve: "continuous",
    backgroundColor: t.accent,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  photoPrimaryText: {
    fontFamily: font.sans[700],
    fontSize: 13.5,
    fontWeight: "700",
    color: t.accentInk,
  },
});

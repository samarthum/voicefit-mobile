/**
 * SheetShell — inner shell rendered inside the gorhom BottomSheetModal.
 * Renders the optional title row (with close button) + per-state children,
 * padded for the bottom safe area.
 */
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BottomSheetScrollView, BottomSheetView } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/Icon";
import { color as t, font } from "@/lib/tokens";

export function SheetShell({
  title,
  onClose,
  children,
  showCloseButton = true,
  closeButtonTestID = "cc-close",
  scrollable = false,
}: {
  title?: string | null;
  onClose: () => void;
  children: ReactNode;
  showCloseButton?: boolean;
  closeButtonTestID?: string;
  /**
   * Render the body inside a `BottomSheetScrollView` instead of a static
   * `BottomSheetView`. Use for states that contain a `BottomSheetTextInput`
   * (idle, photo context): the scroll view lets gorhom scroll the focused
   * field above the keyboard, which a static view cannot do.
   */
  scrollable?: boolean;
}) {
  const insets = useSafeAreaInsets();

  const titleRow = title ? (
    <View style={sheetShellStyles.sheetTitleRow}>
      <Text style={sheetShellStyles.sheetTitleText}>{title}</Text>
      {showCloseButton ? (
        <Pressable
          style={sheetShellStyles.sheetCloseCircle}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          testID={closeButtonTestID}
        >
          <Icon name="close" size={14} color={t.textSoft} />
        </Pressable>
      ) : (
        <View style={sheetShellStyles.sheetCloseCircle} />
      )}
    </View>
  ) : null;

  if (scrollable) {
    return (
      <BottomSheetScrollView
        contentContainerStyle={[sheetShellStyles.sheetContent, { paddingBottom: insets.bottom + 22 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        {titleRow}
        {children}
      </BottomSheetScrollView>
    );
  }

  return (
    <BottomSheetView style={[sheetShellStyles.sheetContent, { paddingBottom: insets.bottom + 22 }]}>
      {titleRow}
      {children}
    </BottomSheetView>
  );
}

export const sheetShellStyles = StyleSheet.create({
  sheetContent: { paddingTop: 0 },
  sheetTitleRow: {
    paddingHorizontal: 22,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitleText: {
    fontFamily: font.sans[600],
    fontSize: 20,
    fontWeight: "600",
    letterSpacing: -0.4,
    color: t.text,
  },
  sheetCloseCircle: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: t.surface,
    alignItems: "center",
    justifyContent: "center",
  },
});

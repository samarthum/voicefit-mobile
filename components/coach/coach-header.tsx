import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Icon } from "@/components/Icon";
import { color as token, font, radius as rad } from "@/lib/tokens";

type CoachHeaderProps = {
  showMenu: boolean;
  onBackPress: () => void;
  onMenuPress: () => void;
  onDismissMenu: () => void;
  onEditProfilePress: () => void;
  onClearConversationPress: () => void;
};

export function CoachHeader({
  showMenu,
  onBackPress,
  onMenuPress,
  onDismissMenu,
  onEditProfilePress,
  onClearConversationPress,
}: CoachHeaderProps) {
  const handleEditProfilePress = () => {
    onDismissMenu();
    onEditProfilePress();
  };

  const handleClearConversationPress = () => {
    onDismissMenu();
    onClearConversationPress();
  };

  return (
    <>
      {showMenu ? (
        <Pressable
          style={styles.menuBackdrop}
          onPress={onDismissMenu}
          accessibilityRole="button"
          accessibilityLabel="Dismiss coach menu"
        />
      ) : null}

      <View style={styles.header}>
        {/* NUI-11: back chevron → <Icon name="back" /> */}
        <Pressable
          style={styles.headerCircleButton}
          hitSlop={8}
          onPress={onBackPress}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon name="back" size={18} color={token.text} />
        </Pressable>

        <View style={styles.headerCenter}>
          <View style={styles.headerSparkleOrb}>
            {/* Sparkle inline SVG — no exact semantic match in Icon for a filled sparkle orb */}
            <SparkleInkGlyph />
          </View>
          <View>
            <Text style={styles.headerTitle}>Coach</Text>
            <View style={styles.headerStatusRow}>
              <View style={styles.headerStatusDot} />
              <Text style={styles.headerStatusText}>Online</Text>
            </View>
          </View>
        </View>

        <View>
          {/* NUI-11: ellipsis → <Icon name="ellipsisHorizontal" /> */}
          <Pressable
            style={styles.headerCircleButton}
            hitSlop={8}
            onPress={onMenuPress}
            accessibilityRole="button"
            accessibilityLabel="Open coach menu"
          >
            <Icon name="ellipsisHorizontal" size={20} color={token.text} />
          </Pressable>

          {showMenu ? (
            <View style={styles.menuDropdown}>
              <Pressable
                style={styles.menuItem}
                onPress={handleEditProfilePress}
                accessibilityRole="button"
              >
                <Text style={styles.menuItemText}>Edit profile</Text>
              </Pressable>
              <View style={styles.menuDivider} />
              <Pressable
                style={styles.menuItem}
                onPress={handleClearConversationPress}
                accessibilityRole="button"
              >
                <Text style={[styles.menuItemText, styles.menuItemDestructive]}>
                  Clear conversation
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    </>
  );
}

// SparkleInkGlyph — bespoke filled sparkle for the coach orb.
// Icon.tsx has "sparkle" (sparkles/auto-awesome) but this is a distinct
// smaller filled shape used as an orb avatar — keep as inline SVG.
function SparkleInkGlyph() {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
      <Path
        d="M7 1L8.2 5.3L12.5 6.5L8.2 7.7L7 12L5.8 7.7L1.5 6.5L5.8 5.3L7 1Z"
        fill={token.accentInk}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  menuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: token.line,
    backgroundColor: token.bg,
    zIndex: 60,
  },
  headerCircleButton: {
    width: 32,
    height: 32,
    borderRadius: rad.pill,
    // NUI-2: pill shape — skip borderCurve per spec
    backgroundColor: token.surface,
    borderWidth: 1,
    borderColor: token.line,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerSparkleOrb: {
    width: 32,
    height: 32,
    borderRadius: rad.pill,
    // NUI-2: pill shape — skip borderCurve per spec
    backgroundColor: token.accent,
    alignItems: "center",
    justifyContent: "center",
    // NUI-1: boxShadow replaces the legacy RN shadow props
    boxShadow: `0 0 10px ${token.accent}66`,
  },
  headerTitle: {
    fontFamily: font.sans[600],
    fontSize: 15,
    fontWeight: "600",
    color: token.text,
    letterSpacing: -0.15,
  },
  headerStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  headerStatusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: token.accent,
  },
  headerStatusText: {
    fontFamily: font.sans[500],
    fontSize: 10.5,
    fontWeight: "500",
    color: token.accent,
    letterSpacing: 1.05,
  },
  menuDropdown: {
    position: "absolute",
    top: 40,
    right: 0,
    width: 200,
    backgroundColor: token.surface,
    borderRadius: rad.sm,
    borderCurve: "continuous", // NUI-2
    borderWidth: 1,
    borderColor: token.line2,
    // NUI-1: boxShadow replaces the legacy RN shadow/elevation props
    boxShadow: "0 20px 40px rgba(0,0,0,0.40)",
    zIndex: 100,
    overflow: "hidden",
  },
  menuItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuItemText: {
    fontFamily: font.sans[500],
    fontSize: 14,
    color: token.text,
  },
  menuItemDestructive: {
    color: token.negative,
  },
  menuDivider: {
    height: 1,
    backgroundColor: token.line,
  },
});

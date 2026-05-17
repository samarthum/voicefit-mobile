import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { color as token, font, radius as rad } from "../../lib/tokens";

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
        <Pressable
          style={styles.headerCircleButton}
          hitSlop={8}
          onPress={onBackPress}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <BackChevronGlyph />
        </Pressable>

        <View style={styles.headerCenter}>
          <View style={styles.headerSparkleOrb}>
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
          <Pressable
            style={styles.headerCircleButton}
            hitSlop={8}
            onPress={onMenuPress}
            accessibilityRole="button"
            accessibilityLabel="Open coach menu"
          >
            <MoreGlyph />
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

function BackChevronGlyph() {
  return (
    <Svg width={10} height={16} viewBox="0 0 10 16" fill="none">
      <Path
        d="M9 1L1 8L9 15"
        stroke={token.text}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

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

function MoreGlyph() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 13C12.5523 13 13 12.5523 13 12C13 11.4477 12.5523 11 12 11C11.4477 11 11 11.4477 11 12C11 12.5523 11.4477 13 12 13Z"
        fill={token.text}
        stroke={token.text}
        strokeWidth={2}
      />
      <Path
        d="M19 13C19.5523 13 20 12.5523 20 12C20 11.4477 19.5523 11 19 11C18.4477 11 18 11.4477 18 12C18 12.5523 18.4477 13 19 13Z"
        fill={token.text}
        stroke={token.text}
        strokeWidth={2}
      />
      <Path
        d="M5 13C5.55228 13 6 12.5523 6 12C6 11.4477 5.55228 11 5 11C4.44772 11 4 11.4477 4 12C4 12.5523 4.44772 13 5 13Z"
        fill={token.text}
        stroke={token.text}
        strokeWidth={2}
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
    backgroundColor: token.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: token.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
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
    borderWidth: 1,
    borderColor: token.line2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 40,
    elevation: 12,
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

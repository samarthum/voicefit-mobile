import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Svg, { Circle, Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color as token, font } from "../lib/tokens";

const COLORS = {
  bg: token.bg,
  border: token.line,
  active: token.text,
  activeIcon: token.accent,
  inactive: token.textMute,
};

function TabIcon({ kind, tint }: { kind: "home" | "workouts" | "settings"; tint: string }) {
  if (kind === "home") {
    return (
      <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
        <Path d="M3 8L9 3L15 8V15H11V11H7V15H3V8Z" stroke={tint} strokeWidth={1.5} strokeLinejoin="round" />
      </Svg>
    );
  }
  if (kind === "workouts") {
    return (
      <Svg width={20} height={18} viewBox="0 0 20 18" fill="none">
        <Path d="M3 6V12M7 4V14M10 6V12M13 4V14M17 6V12" stroke={tint} strokeWidth={1.6} strokeLinecap="round" />
      </Svg>
    );
  }
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Circle cx={9} cy={7} r={3} stroke={tint} strokeWidth={1.5} />
      <Path d="M2 16C2 13 5 11 9 11C13 11 16 13 16 16" stroke={tint} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

export function FakeTabBar({ active }: { active: "home" | "workouts" | "settings" }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const tabs = [
    { key: "home", label: "Today", href: "/(tabs)/dashboard" },
    { key: "workouts", label: "Train", href: "/(tabs)/workouts" },
    { key: "settings", label: "You", href: "/(tabs)/settings" },
  ] as const;

  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {tabs.map((tab) => {
        const selected = tab.key === active;
        const labelColor = selected ? COLORS.active : COLORS.inactive;
        const iconColor = selected ? COLORS.activeIcon : COLORS.inactive;

        return (
          <Pressable key={tab.key} style={styles.tabItem} onPress={() => router.replace(tab.href)}>
            <TabIcon kind={tab.key} tint={iconColor} />
            <Text style={[styles.tabLabel, { color: labelColor }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 10,
    backgroundColor: COLORS.bg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-start",
  },
  tabItem: {
    alignItems: "center",
    gap: 4,
  },
  tabLabel: {
    fontFamily: font.sans[600],
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 0.4,
  },
});

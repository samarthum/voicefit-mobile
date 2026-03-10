import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Svg, { Circle, Path } from "react-native-svg";

const COLORS = {
  bg: "#FFFFFF",
  border: "#E8E8E8",
  active: "#1A1A1A",
  inactive: "#8E8E93",
};

function HomeTabIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M4 10.5L12 4L20 10.5V20H4V10.5Z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M9.5 20V13.5H14.5V20" stroke={color} strokeWidth={2} strokeLinejoin="round" />
    </Svg>
  );
}

function WorkoutsTabIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M4 10H7V14H4V10Z" fill={color} />
      <Path d="M17 10H20V14H17V10Z" fill={color} />
      <Path d="M7 11H17V13H7V11Z" fill={color} />
      <Path d="M2 9H4V15H2V9Z" fill={color} />
      <Path d="M20 9H22V15H20V9Z" fill={color} />
    </Svg>
  );
}

function SettingsTabIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={3.2} stroke={color} strokeWidth={2} />
      <Path
        d="M12 2.5V5M12 19V21.5M21.5 12H19M5 12H2.5M18.7 5.3L17 7M7 17L5.3 18.7M18.7 18.7L17 17M7 7L5.3 5.3"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function FakeTabBar({ active }: { active: "home" | "workouts" | "settings" }) {
  const router = useRouter();

  const tabs = [
    { key: "home", label: "Home", icon: HomeTabIcon, href: "/(tabs)/dashboard" },
    { key: "workouts", label: "Workouts", icon: WorkoutsTabIcon, href: "/(tabs)/workouts" },
    { key: "settings", label: "Settings", icon: SettingsTabIcon, href: "/(tabs)/settings" },
  ] as const;

  return (
    <View style={styles.tabBar}>
      {tabs.map((tab) => {
        const selected = tab.key === active;
        const color = selected ? COLORS.active : COLORS.inactive;
        const Icon = tab.icon;

        return (
          <Pressable key={tab.key} style={styles.tabItem} onPress={() => router.replace(tab.href)}>
            <Icon color={color} />
            <Text style={[styles.tabLabel, { color }]}>{tab.label}</Text>
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
    height: 83,
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
    fontSize: 10,
    fontWeight: "500",
  },
});

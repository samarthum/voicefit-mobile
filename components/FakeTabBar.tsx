import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

const COLORS = {
  bg: "#FFFFFF",
  border: "#E8E8E8",
  active: "#1A1A1A",
  inactive: "#8E8E93",
};

export function FakeTabBar({ active }: { active: "home" | "workouts" | "settings" }) {
  const router = useRouter();

  const tabs = [
    { key: "home", label: "Home", href: "/(tabs)/dashboard" },
    { key: "workouts", label: "Workouts", href: "/(tabs)/workouts" },
    { key: "settings", label: "Settings", href: "/(tabs)/settings" },
  ] as const;

  return (
    <View style={styles.tabBar}>
      {tabs.map((tab) => {
        const selected = tab.key === active;
        const color = selected ? COLORS.active : COLORS.inactive;
        const iconName =
          tab.key === "home"
            ? selected
              ? "home"
              : "home-outline"
            : tab.key === "workouts"
              ? selected
                ? "fitness"
                : "fitness-outline"
              : selected
                ? "settings"
                : "settings-outline";

        return (
          <Pressable key={tab.key} style={styles.tabItem} onPress={() => router.replace(tab.href)}>
            <Ionicons name={iconName} size={22} color={color} />
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

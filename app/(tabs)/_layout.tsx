import { Tabs, Redirect } from "expo-router";
import { ActivityIndicator, Platform, View } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabsLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const bypassAuthForWebPreview = __DEV__ && Platform.OS === "web";
  const insets = useSafeAreaInsets();
  const isAndroid = Platform.OS === "android";
  const tabBarPaddingBottom = isAndroid ? 18 : Math.max(insets.bottom, 10);
  const tabBarHeight = isAndroid
    ? 92
    : 83 + Math.max(insets.bottom - 10, 0);

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!isSignedIn && !bypassAuthForWebPreview) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <Tabs
      initialRouteName="dashboard"
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: "#1A1A1A",
        tabBarInactiveTintColor: "#8E8E93",
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "500",
          marginTop: 1,
        },
        tabBarIconStyle: isAndroid ? { marginTop: 2 } : undefined,
        tabBarItemStyle: isAndroid ? { justifyContent: "flex-start", paddingTop: 2 } : undefined,
        tabBarStyle: {
          height: tabBarHeight,
          borderTopWidth: 1,
          borderTopColor: "#E8E8E8",
          paddingTop: isAndroid ? 6 : 10,
          paddingBottom: tabBarPaddingBottom,
          backgroundColor: "#FFFFFF",
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          title: "Workouts",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "fitness" : "fitness-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "settings" : "settings-outline"} size={22} color={color} />
          ),
        }}
      />

      {/* Hidden from tab bar but routable */}
      <Tabs.Screen name="log" options={{ href: null }} />
      <Tabs.Screen name="feed" options={{ href: null }} />
      <Tabs.Screen name="coach" options={{ href: null }} />
      <Tabs.Screen name="meals" options={{ href: null }} />
    </Tabs>
  );
}

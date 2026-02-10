import { Tabs, Redirect } from "expo-router";
import { ActivityIndicator, Platform, View } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import Svg, { Path, Circle } from "react-native-svg";

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

export default function TabsLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const bypassAuthForWebPreview = __DEV__ && Platform.OS === "web";

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
        tabBarActiveTintColor: "#1A1A1A",
        tabBarInactiveTintColor: "#8E8E93",
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "500",
          marginTop: 2,
        },
        tabBarStyle: {
          height: 83,
          borderTopWidth: 1,
          borderTopColor: "#E8E8E8",
          paddingTop: 10,
          paddingBottom: 10,
          backgroundColor: "#FFFFFF",
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <HomeTabIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          title: "Workouts",
          tabBarIcon: ({ color }) => <WorkoutsTabIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => <SettingsTabIcon color={color} />,
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

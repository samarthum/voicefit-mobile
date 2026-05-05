import { Tabs, Redirect } from "expo-router";
import { ActivityIndicator, Platform, View } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import Svg, { Circle, Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color, font } from "../../lib/tokens";
import { isWebPreviewMode } from "../../lib/web-preview-mode";

// Line-art icons matching screens-c.jsx C_TabBar — stroke-only, currentColor-driven.
function TodayIcon({ tint }: { tint: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Path
        d="M3 8L9 3L15 8V15H11V11H7V15H3V8Z"
        stroke={tint}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function TrainIcon({ tint }: { tint: string }) {
  return (
    <Svg width={20} height={18} viewBox="0 0 20 18" fill="none">
      <Path
        d="M3 6V12M7 4V14M10 6V12M13 4V14M17 6V12"
        stroke={tint}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function YouIcon({ tint }: { tint: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Circle cx={9} cy={7} r={3} stroke={tint} strokeWidth={1.5} />
      <Path
        d="M2 16C2 13 5 11 9 11C13 11 16 13 16 16"
        stroke={tint}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export default function TabsLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const bypassAuthForWebPreview = isWebPreviewMode();
  const insets = useSafeAreaInsets();
  const isAndroid = Platform.OS === "android";
  const tabBarPaddingBottom = isAndroid ? 18 : Math.max(insets.bottom, 10);
  const tabBarHeight = isAndroid
    ? 92
    : 83 + Math.max(insets.bottom - 10, 0);

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: color.bg }}>
        <ActivityIndicator color={color.accent} />
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
        tabBarActiveTintColor: color.accent,
        tabBarInactiveTintColor: color.textMute,
        tabBarLabelStyle: {
          fontFamily: font.sans[600],
          fontSize: 10.5,
          fontWeight: "600",
          letterSpacing: 0.4,
          marginTop: 1,
        },
        tabBarIconStyle: isAndroid ? { marginTop: 2 } : undefined,
        tabBarItemStyle: isAndroid ? { justifyContent: "flex-start", paddingTop: 2 } : undefined,
        tabBarStyle: {
          height: tabBarHeight,
          borderTopWidth: 1,
          borderTopColor: color.line,
          paddingTop: isAndroid ? 6 : 10,
          paddingBottom: tabBarPaddingBottom,
          backgroundColor: color.bg,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Today",
          tabBarIcon: ({ color: tint }) => <TodayIcon tint={tint} />,
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          title: "Train",
          tabBarIcon: ({ color: tint }) => <TrainIcon tint={tint} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "You",
          tabBarIcon: ({ color: tint }) => <YouIcon tint={tint} />,
        }}
      />

      {/* Hidden from tab bar but routable */}
      <Tabs.Screen name="log" options={{ href: null }} />
      <Tabs.Screen name="feed" options={{ href: null }} />
      <Tabs.Screen name="coach" options={{ href: null }} />
      <Tabs.Screen name="meals" options={{ href: null }} />
      <Tabs.Screen name="trends" options={{ href: null }} />
    </Tabs>
  );
}

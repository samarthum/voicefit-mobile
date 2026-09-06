import { NativeTabs, Icon, Label, VectorIcon } from "expo-router/unstable-native-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ICON_NAMES } from "@/components/Icon";
import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { color, font } from "@/lib/tokens";
import { isWebPreviewMode } from "@/lib/web-preview-mode";

export default function TabsLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const bypass = isWebPreviewMode();

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: color.bg }}>
        <ActivityIndicator color={color.accent} />
      </View>
    );
  }

  if (!isSignedIn && !bypass) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <NativeTabs
      tintColor={color.accent}
      backgroundColor={color.surface}
      iconColor={{ default: color.textMute, selected: color.accent }}
      labelStyle={{
        default: { color: color.textMute, fontFamily: font.sans[500], fontSize: 11, fontWeight: "500" },
        selected: { color: color.accent, fontFamily: font.sans[600], fontSize: 11, fontWeight: "600" },
      }}
      indicatorColor={color.accentTintBg}
      labelVisibilityMode="labeled"
      disableTransparentOnScrollEdge
      shadowColor={color.line}
      minimizeBehavior="never"
      rippleColor={color.accentTintBg}
    >
      <NativeTabs.Trigger name="dashboard">
        <Label>Today</Label>
        <Icon src={<VectorIcon family={Ionicons} name={ICON_NAMES.home} />} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="workouts">
        <Label>Train</Label>
        <Icon src={<VectorIcon family={Ionicons} name={ICON_NAMES.dumbbell} />} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <Label>You</Label>
        <Icon src={<VectorIcon family={Ionicons} name={ICON_NAMES.person} />} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

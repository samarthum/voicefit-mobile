import { NativeTabs, Icon, Label, VectorIcon } from "expo-router/unstable-native-tabs";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { color } from "@/lib/tokens";
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
    // Untinted, the Android Material 3 bottom bar follows the SYSTEM theme
    // (dark gray surface + system indicator pill) — theme every slot with our
    // tokens so it matches the rest of the app.
    <NativeTabs
      tintColor={color.accent}
      backgroundColor={color.surface}
      iconColor={{ default: color.textMute, selected: color.accent }}
      labelStyle={{
        default: { color: color.textMute },
        selected: { color: color.accent },
      }}
      indicatorColor={color.accentRingTrack}
      rippleColor={color.accentTintBg}
    >
      <NativeTabs.Trigger name="dashboard">
        <Label>Today</Label>
        <Icon sf="house.fill" androidSrc={<VectorIcon family={MaterialIcons} name="home" />} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="workouts">
        <Label>Train</Label>
        <Icon sf="figure.strengthtraining.traditional" androidSrc={<VectorIcon family={MaterialIcons} name="fitness-center" />} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <Label>You</Label>
        <Icon sf="person.fill" androidSrc={<VectorIcon family={MaterialIcons} name="person" />} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

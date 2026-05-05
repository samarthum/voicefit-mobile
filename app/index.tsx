import { Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { color } from "../lib/tokens";
import { isWebPreviewMode } from "../lib/web-preview-mode";

export default function Index() {
  const { isLoaded, isSignedIn } = useAuth();
  const bypassAuthForWebPreview = isWebPreviewMode();

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: color.bg }}>
        <ActivityIndicator color={color.accent} />
      </View>
    );
  }

  return <Redirect href={isSignedIn || bypassAuthForWebPreview ? "/(tabs)/dashboard" : "/sign-in"} />;
}

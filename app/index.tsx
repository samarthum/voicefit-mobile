import { Redirect } from "expo-router";
import { View, ActivityIndicator, Platform } from "react-native";
import { useAuth } from "@clerk/clerk-expo";

export default function Index() {
  const { isLoaded, isSignedIn } = useAuth();
  const bypassAuthForWebPreview = __DEV__ && Platform.OS === "web";

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <Redirect href={isSignedIn || bypassAuthForWebPreview ? "/(tabs)/dashboard" : "/sign-in"} />;
}

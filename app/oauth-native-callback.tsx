import { useEffect } from "react";
import { router } from "expo-router";
import { ActivityIndicator, View } from "react-native";

export default function OAuthNativeCallbackScreen() {
  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace("/sign-in");
    }, 250);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" }}>
      <ActivityIndicator />
    </View>
  );
}


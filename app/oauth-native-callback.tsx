import { useEffect } from "react";
import { router } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { ActivityIndicator, View } from "react-native";
import { color } from "../lib/tokens";

export default function OAuthNativeCallbackScreen() {
  const { isSignedIn, isLoaded } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;
    const timer = setTimeout(() => {
      router.replace(isSignedIn ? "/(tabs)/dashboard" : "/sign-in");
    }, 250);

    return () => clearTimeout(timer);
  }, [isLoaded, isSignedIn]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: color.bg }}>
      <ActivityIndicator color={color.accent} />
    </View>
  );
}


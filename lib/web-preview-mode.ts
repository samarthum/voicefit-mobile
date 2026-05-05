import { Platform } from "react-native";

export function isWebPreviewMode(): boolean {
  if (process.env.EXPO_PUBLIC_DISABLE_WEB_PREVIEW === "1") return false;
  return __DEV__ && Platform.OS === "web";
}

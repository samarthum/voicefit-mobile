import { Link, Stack } from "expo-router";
import { View, Text } from "react-native";
import { color, type } from "@/lib/tokens";

export default function NotFound() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: color.bg }}>
      <Stack.Screen options={{ title: "Not found" }} />
      <Text style={type.titleS} selectable>This screen doesn't exist.</Text>
      <Link href="/"><Text style={{ color: color.accent }}>Go home</Text></Link>
    </View>
  );
}

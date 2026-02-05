import { View, Text, StyleSheet, Pressable } from "react-native";
import { useAuth } from "@clerk/clerk-expo";

export default function SettingsScreen() {
  const { signOut } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.body}>Expose goals and account settings.</Text>
      <Pressable style={styles.signOutButton} onPress={() => signOut()}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#FFFFFF",
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    color: "#4B5563",
  },
  signOutButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignSelf: "flex-start",
  },
  signOutText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
});

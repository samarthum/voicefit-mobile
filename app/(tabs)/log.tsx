import { View, Text, StyleSheet } from "react-native";

export default function LogScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Log</Text>
      <Text style={styles.body}>Add voice meal logging and manual metrics here.</Text>
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
});

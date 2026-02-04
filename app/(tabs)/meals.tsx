import { View, Text, StyleSheet } from "react-native";

export default function MealsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Meals</Text>
      <Text style={styles.body}>List recent meals and allow edits later.</Text>
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

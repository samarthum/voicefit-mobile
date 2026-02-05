import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { useQuery } from "@tanstack/react-query";
import type { DashboardData } from "@voicefit/contracts/types";
import { apiRequest } from "../../lib/api-client";

export default function DashboardScreen() {
  const { getToken } = useAuth();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ["dashboard", timezone],
    queryFn: async () => {
      const token = await getToken();
      if (!token) {
        throw new Error("Not signed in");
      }
      return apiRequest<DashboardData>(`/api/dashboard?timezone=${encodeURIComponent(timezone)}`, {
        token,
      });
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dashboard</Text>
      {isLoading ? (
        <ActivityIndicator />
      ) : error ? (
        <Text style={styles.error}>{(error as Error).message}</Text>
      ) : data ? (
        <View style={styles.card}>
          <Text style={styles.label}>Calories</Text>
          <Text style={styles.value}>
            {data.today.calories.consumed} / {data.today.calories.goal} kcal
          </Text>

          <Text style={styles.label}>Steps</Text>
          <Text style={styles.value}>
            {data.today.steps.count ?? 0} / {data.today.steps.goal} steps
          </Text>

          <Text style={styles.label}>Weight</Text>
          <Text style={styles.value}>
            {data.today.weight ?? "--"} kg
          </Text>
        </View>
      ) : (
        <Text style={styles.body}>No data yet.</Text>
      )}
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
  error: {
    color: "#DC2626",
  },
  card: {
    marginTop: 12,
    padding: 16,
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
  },
  label: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 8,
  },
  value: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
});

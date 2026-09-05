import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Redirect, Stack } from "expo-router";
import { getTimings } from "@/lib/performance-log";

export default function DiagnosticsScreen() {
  const [records, setRecords] = useState(getTimings);
  useEffect(() => {
    if (!__DEV__) return;
    const timer = setInterval(() => setRecords(getTimings()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (!__DEV__) return <Redirect href="/" />;
  return <View style={{ flex: 1, backgroundColor: "white" }}>
    <Stack.Screen options={{ headerShown: true, title: "Development timings" }} />
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, gap: 16 }}>
      <Text>Development build only. API durations start after authentication and include response parsing. Coach timings include authentication and stream startup. Screen timings measure focus until data is ready, including cache hits. These are not screen-paint or frame-rate measurements.</Text>
      {records.map((record) => <Text selectable key={record.sequence} style={{ fontSize: 14, color: "#222" }}>
        {record.sequence}. {record.kind} {record.method} {record.route}{"\n"}
        {record.outcome} · {record.durationMs} ms total{record.headersMs !== undefined ? ` · ${record.headersMs} ms headers · ${record.bodyMs} ms body` : ""}{record.status !== undefined ? ` · HTTP ${record.status}` : ""}
      </Text>)}
    </ScrollView>
  </View>;
}

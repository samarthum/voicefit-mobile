import { useRef } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { RepeatMealFlow } from "@/components/meal-repeat/RepeatMealFlow";
import { toLocalDateString } from "@/components/command-center/helpers";

export default function RepeatMealScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const sourceId = typeof id === "string" ? id : undefined;
  const savedDay = useRef<string | null>(null);
  return <>
    <Stack.Screen options={{ headerShown: true, title: "Repeat meal" }} />
    <RepeatMealFlow key={sourceId ?? "choose"} initialMealId={sourceId} onClose={() => savedDay.current ? router.replace({ pathname: "/meals", params: { date: savedDay.current } }) : router.back()}
      onSaved={(meal) => {
        // Keep confirmation + undo visible; destination is selected only on Done.
        savedDay.current = toLocalDateString(new Date(meal.eatenAt));
      }} />
  </>;
}

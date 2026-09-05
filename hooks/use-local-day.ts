import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { toLocalDateString } from "@/components/command-center/helpers";

// Refresh even if the screen has not rendered since yesterday. Foreground
// refresh also handles device clock/timezone changes while the app slept.
export function useLocalDay() {
  const [day, setDay] = useState(() => toLocalDateString(new Date()));
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      clearTimeout(timer);
      const now = new Date();
      setDay(toLocalDateString(now));
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = setTimeout(refresh, Math.max(1000, midnight.getTime() - now.getTime() + 50));
    };
    refresh();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => { clearTimeout(timer); subscription.remove(); };
  }, []);
  return day;
}

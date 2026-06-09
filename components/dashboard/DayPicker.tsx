import { Pressable, StyleSheet, Text, View } from "react-native";
import { color as token, font } from "@/lib/tokens";
import { haptic } from "@/lib/haptics";

export type DayOption = {
  date: string;
  dayNum: string;
  dayLabel: string;
};

type Props = {
  dayOptions: DayOption[];
  selectedDate: string;
  loggedDates: Set<string>;
  onSelectDate: (date: string) => void;
};

export function DayPicker({ dayOptions, selectedDate, loggedDates, onSelectDate }: Props) {
  return (
    <View style={styles.dayPickerRow}>
      {dayOptions.map((day) => {
        const active = day.date === selectedDate;
        const hasData = loggedDates.has(day.date);
        const faded = !active && !hasData;

        return (
          <Pressable
            key={day.date}
            style={[styles.dayItem, active && styles.dayItemActive]}
            testID={`home-day-${day.date}`}
            onPress={() => {
              haptic.selection();
              onSelectDate(day.date);
            }}
          >
            <Text style={[styles.dayLabel, active && styles.dayLabelActive, faded && styles.dayLabelFaded]}>
              {day.dayLabel}
            </Text>
            <Text style={[styles.dayNum, active && styles.dayNumActive, faded && styles.dayNumFaded]}>
              {day.dayNum}
            </Text>
            <View
              style={[
                styles.dayDot,
                active && styles.dayDotActive,
                !active && !hasData && styles.dayDotEmpty,
              ]}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  dayPickerRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
    marginBottom: 20,
  },
  dayItem: {
    flex: 1,
    borderRadius: 12,
    borderCurve: "continuous",
    paddingVertical: 10,
    paddingHorizontal: 0,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: token.line,
    backgroundColor: "transparent",
  },
  dayItemActive: {
    backgroundColor: token.accent,
    borderColor: "transparent",
  },
  dayLabel: {
    fontFamily: font.sans[600],
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1,
    color: token.text,
    opacity: 0.75,
  },
  dayLabelActive: {
    color: token.accentInk,
    opacity: 0.75,
  },
  dayLabelFaded: {
    color: token.textMute,
  },
  dayNum: {
    fontFamily: font.mono[500],
    fontSize: 18,
    fontWeight: "500",
    color: token.text,
    lineHeight: 18,
    marginTop: 3,
  },
  dayNumActive: {
    color: token.accentInk,
  },
  dayNumFaded: {
    color: token.textMute,
    fontWeight: "500",
  },
  dayDot: {
    width: 3,
    height: 3,
    borderRadius: 3,
    borderCurve: "continuous",
    marginTop: 5,
    backgroundColor: token.accent,
  },
  dayDotActive: {
    backgroundColor: token.accentInk,
  },
  dayDotEmpty: {
    backgroundColor: "transparent",
  },
});

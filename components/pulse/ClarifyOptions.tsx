import { Pressable, StyleSheet, Text, View } from "react-native";
import { color, font } from "../../lib/tokens";

export type ClarifyOption = {
  id: string;
  title: string;
  subtitle?: string;
};

export type ClarifyOptionsProps = {
  options: ClarifyOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function ClarifyOptions({ options, selectedId, onSelect }: ClarifyOptionsProps) {
  return (
    <View style={styles.list}>
      {options.map((opt) => {
        const active = opt.id === selectedId;
        return (
          <Pressable
            key={opt.id}
            onPress={() => onSelect(opt.id)}
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: active ? color.accentTintBg : color.surface,
                borderColor: active ? color.accent : color.line,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <View
              style={[
                styles.radio,
                {
                  borderColor: active ? color.accent : color.line2,
                  backgroundColor: active ? color.accent : "transparent",
                },
              ]}
            >
              {active ? <View style={styles.radioDot} /> : null}
            </View>
            <View style={styles.copy}>
              <Text style={styles.title}>{opt.title}</Text>
              {opt.subtitle ? <Text style={styles.subtitle}>{opt.subtitle}</Text> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: color.accentInk,
  },
  copy: { flex: 1 },
  title: {
    fontFamily: font.sans[600],
    fontWeight: "600",
    fontSize: 14,
    color: color.text,
    letterSpacing: -0.07,
  },
  subtitle: {
    fontFamily: font.mono[400],
    fontSize: 11.5,
    color: color.textMute,
    marginTop: 2,
    letterSpacing: 0.23,
  },
});

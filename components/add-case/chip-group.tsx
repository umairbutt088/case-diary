import { Pressable, ScrollView, StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { theme } from "@/constants/theme";

type Props = {
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
};

export function ChipGroup({ options, value, onChange }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {options.map((opt) => {
        const selected = value === opt;
        return (
          <Pressable
            key={opt}
            style={[styles.chip, selected && styles.chipSelected]}
            onPress={() => onChange(opt)}
          >
            <ThemedText
              style={[styles.chipText, selected && styles.chipTextSelected]}
            >
              {opt}
            </ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: theme.colors.gray60,
  },
  chipSelected: {
    backgroundColor: theme.colors.themeBlack,
  },
  chipText: {
    fontSize: 15,
    color: theme.colors.gray50,
  },
  chipTextSelected: {
    color: theme.colors.pureWhite,
    fontWeight: "600",
  },
});

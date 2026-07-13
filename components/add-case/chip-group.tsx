import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import type { AppColors } from "@/constants/color-palette";
import { useAppTheme } from "@/context/app-theme-context";
import { useThemePalette } from "@/hooks/use-theme-palette";

type Props = {
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
};

function createChipGroupStyles(C: AppColors, onPrimary: string) {
  return StyleSheet.create({
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
      backgroundColor: C.gray60,
    },
    chipSelected: {
      backgroundColor: C.themeBlack,
    },
    chipText: {
      fontSize: 15,
    },
    chipTextSelected: {
      color: onPrimary,
      fontWeight: "600",
    },
  });
}

export function ChipGroup({ options, value, onChange }: Props) {
  const C = useThemePalette();
  const { isDark } = useAppTheme();
  const onPrimary = C.textInverse;
  const styles = useMemo(
    () => createChipGroupStyles(C, onPrimary),
    [C, onPrimary],
  );

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
            <ThemedText type="default"
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

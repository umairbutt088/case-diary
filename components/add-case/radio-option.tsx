import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import type { AppColors } from "@/constants/color-palette";
import { useThemePalette } from "@/hooks/use-theme-palette";

type Props = {
  label: string;
  selected: boolean;
  onSelect: () => void;
};

function createRadioOptionStyles(C: AppColors) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },
    outer: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: C.borderGray,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    outerSelected: {
      borderColor: C.themeBlack,
    },
    inner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: C.themeBlack,
    },
    label: {
      fontSize: 16,
      flex: 1,
    },
  });
}

export function RadioOption({ label, selected, onSelect }: Props) {
  const C = useThemePalette();
  const styles = useMemo(() => createRadioOptionStyles(C), [C]);

  return (
    <Pressable
      style={styles.row}
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
    >
      <View style={[styles.outer, selected && styles.outerSelected]}>
        {selected ? <View style={styles.inner} /> : null}
      </View>
      <ThemedText type="label" style={styles.label}>{label}</ThemedText>
    </Pressable>
  );
}

import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import type { AppColors } from "@/constants/color-palette";
import { useThemePalette } from "@/hooks/use-theme-palette";

function createSegmentedStyles(C: AppColors) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      backgroundColor: "transparent",
      width: "100%",
      paddingVertical: 10,
      justifyContent: "space-around",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.borderGray,
    },
    btnWrapper: {
      width: "45%",
    },
    btn: {
      paddingVertical: 10,
      alignItems: "center",
      borderRadius: 12,
      backgroundColor: C.grey100,
      borderWidth: 1,
      borderColor: "transparent",
    },
    btnActive: {
      backgroundColor: C.themeBlack,
      borderColor: C.themeBlack,
    },
    text: {
      fontSize: 15,
      fontWeight: "600",
      color: C.gray50,
    },
    textActive: {
      color: C.pureWhite,
    },
  });
}

export type SegmentedOption<T extends string = string> = {
  label: string;
  value: T;
};

type Props<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  left: SegmentedOption<T>;
  right: SegmentedOption<T>;
  /** Optional a11y hint for the group */
  accessibilityLabel?: string;
};

/**
 * Two-option segmented control (same visual pattern as Home Today / Weekly).
 */
export function SegmentedTwoOption<T extends string>({
  value,
  onChange,
  left,
  right,
  accessibilityLabel = "Choose an option",
}: Props<T>) {
  const C = useThemePalette();
  const styles = useMemo(() => createSegmentedStyles(C), [C]);
  const leftSelected = value === left.value;
  const rightSelected = value === right.value;

  return (
    <View
      style={styles.row}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={styles.btnWrapper}>
        <Pressable
          style={[styles.btn, leftSelected && styles.btnActive]}
          onPress={() => onChange(left.value)}
          accessibilityRole="radio"
          accessibilityState={{ checked: leftSelected }}
          accessibilityLabel={left.label}
        >
          <ThemedText style={[styles.text, leftSelected && styles.textActive]}>
            {left.label}
          </ThemedText>
        </Pressable>
      </View>
      <View style={styles.btnWrapper}>
        <Pressable
          style={[styles.btn, rightSelected && styles.btnActive]}
          onPress={() => onChange(right.value)}
          accessibilityRole="radio"
          accessibilityState={{ checked: rightSelected }}
          accessibilityLabel={right.label}
        >
          <ThemedText style={[styles.text, rightSelected && styles.textActive]}>
            {right.label}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

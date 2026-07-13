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
      paddingHorizontal: 8,
      justifyContent: "space-around",
      gap: 6,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.borderGray,
    },
    btn: {
      flex: 1,
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
      fontSize: 14,
      fontWeight: "600",
    },
    textActive: {
      color: C.textInverse,
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
  /** Prefer `options` for 2+ choices. */
  options?: SegmentedOption<T>[];
  /** @deprecated Use `options` instead. */
  left?: SegmentedOption<T>;
  /** @deprecated Use `options` instead. */
  right?: SegmentedOption<T>;
  accessibilityLabel?: string;
};

/**
 * Segmented control for 2+ options (Appearance, Today/Weekly, etc.).
 */
export function SegmentedTwoOption<T extends string>({
  value,
  onChange,
  options,
  left,
  right,
  accessibilityLabel = "Choose an option",
}: Props<T>) {
  const C = useThemePalette();
  const styles = useMemo(() => createSegmentedStyles(C), [C]);
  const items =
    options ??
    (left && right ? [left, right] : ([] as SegmentedOption<T>[]));

  return (
    <View
      style={styles.row}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
    >
      {items.map((item) => {
        const selected = value === item.value;
        return (
          <Pressable
            key={item.value}
            style={[styles.btn, selected && styles.btnActive]}
            onPress={() => onChange(item.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={item.label}
          >
            <ThemedText
              type="secondary"
              style={[styles.text, selected && styles.textActive]}
            >
              {item.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

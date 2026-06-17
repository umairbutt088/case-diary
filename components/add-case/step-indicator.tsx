import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import type { AppColors } from "@/constants/color-palette";
import { useThemePalette } from "@/hooks/use-theme-palette";

const TOTAL_STEPS = 3;

type Props = {
  currentStep: number;
};

function createStepIndicatorStyles(C: AppColors) {
  return StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: 20,
      paddingBottom: 12,
      paddingHorizontal: 20,
    },
    label: {
      fontSize: 14,
      color: C.gray50,
      fontWeight: "500",
    },
    dots: {
      flexDirection: "row",
      gap: 8,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    dotActive: {
      backgroundColor: C.themeBlack,
      width: 20,
    },
    dotInactive: {
      backgroundColor: C.grey100,
    },
  });
}

export function StepIndicator({ currentStep }: Props) {
  const C = useThemePalette();
  const styles = useMemo(() => createStepIndicatorStyles(C), [C]);

  return (
    <View style={styles.container}>
      <ThemedText style={styles.label}>
        Step {currentStep} of {TOTAL_STEPS}
      </ThemedText>
      <View style={styles.dots}>
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i + 1 === currentStep ? styles.dotActive : styles.dotInactive,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

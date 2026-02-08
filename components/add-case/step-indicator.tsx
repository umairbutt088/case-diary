import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { theme } from "@/constants/theme";

const TOTAL_STEPS = 4;

type Props = {
  currentStep: number;
};

export function StepIndicator({ currentStep }: Props) {
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

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  label: {
    fontSize: 14,
    color: theme.colors.gray50,
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
    backgroundColor: theme.colors.themeBlack,
  },
  dotInactive: {
    backgroundColor: theme.colors.grey100,
  },
});

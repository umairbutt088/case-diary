import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import type { AppColors } from "@/constants/color-palette";
import { useThemePalette } from "@/hooks/use-theme-palette";

type Props = {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
};

function createFormFieldStyles(C: AppColors) {
  return StyleSheet.create({
    wrap: {
      marginBottom: 20,
    },
    label: {
      fontSize: 14,
      fontWeight: "600",
      color: C.black90,
      marginBottom: 4,
    },
    hint: {
      fontSize: 13,
      marginBottom: 8,
    },
  });
}

export function FormField({ label, required, hint, children }: Props) {
  const C = useThemePalette();
  const styles = useMemo(() => createFormFieldStyles(C), [C]);

  return (
    <View style={styles.wrap}>
      <ThemedText style={styles.label}>
        {label}
        {required ? " *" : ""}
      </ThemedText>
      {hint ? (
        <ThemedText style={styles.hint} lightColor={C.gray50} darkColor={C.gray50}>
          {hint}
        </ThemedText>
      ) : null}
      {children}
    </View>
  );
}

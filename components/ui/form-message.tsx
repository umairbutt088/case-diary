import { useMemo } from "react";
import { StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import type { AppColors } from "@/constants/color-palette";
import { useThemePalette } from "@/hooks/use-theme-palette";

type FormMessageProps = {
  message: string;
  type?: "error" | "success";
};

function createFormMessageStyles(C: AppColors) {
  return StyleSheet.create({
    text: {
      color: C.themeRed,
      fontSize: 14,
      marginBottom: 8,
    },
    success: {
      color: C.themeGreen,
    },
  });
}

export function FormMessage({ message, type = "error" }: FormMessageProps) {
  const C = useThemePalette();
  const styles = useMemo(() => createFormMessageStyles(C), [C]);
  return (
    <ThemedText type="default" style={[styles.text, type === "success" && styles.success]}>
      {message}
    </ThemedText>
  );
}

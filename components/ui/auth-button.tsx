import { useMemo } from "react";
import { ActivityIndicator, StyleSheet } from "react-native";

import { Bounceable } from "./bounceable";

import { ThemedText } from "@/components/themed-text";
import type { AppColors } from "@/constants/color-palette";
import { useAppTheme } from "@/context/app-theme-context";
import { useThemePalette } from "@/hooks/use-theme-palette";

type AuthButtonProps = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
};

function createAuthButtonStyles(C: AppColors, onPrimary: string) {
  return StyleSheet.create({
    button: {
      backgroundColor: C.themeBlack,
      paddingVertical: 16,
      borderRadius: 8,
      alignItems: "center",
    },
    disabled: {
      opacity: 0.7,
    },
    label: {
      color: onPrimary,
      fontWeight: "600",
      fontSize: 20,
    },
  });
}

export function AuthButton({
  label,
  onPress,
  loading = false,
  disabled = false,
}: AuthButtonProps) {
  const C = useThemePalette();
  const { isDark } = useAppTheme();
  const onPrimary = isDark ? C.black : C.pureWhite;
  const styles = useMemo(
    () => createAuthButtonStyles(C, onPrimary),
    [C, onPrimary],
  );

  return (
    <Bounceable
      style={[styles.button, (loading || disabled) && styles.disabled]}
      onPress={onPress}
      disabled={disabled || loading}
      activeScale={0.97}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator color={onPrimary} />
      ) : (
        <ThemedText style={styles.label}>{label}</ThemedText>
      )}
    </Bounceable>
  );
}

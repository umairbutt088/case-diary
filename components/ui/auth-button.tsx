import { ActivityIndicator, StyleSheet } from "react-native";
import { Bounceable } from "./bounceable";

import { ThemedText } from "@/components/themed-text";
import { theme } from "@/constants/theme";

type AuthButtonProps = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
};

export function AuthButton({
  label,
  onPress,
  loading = false,
  disabled = false,
}: AuthButtonProps) {
  return (
    <Bounceable
      style={[styles.button, (loading || disabled) && styles.disabled]}
      onPress={onPress}
      disabled={disabled || loading}
      activeScale={0.97}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator color={theme.colors.white} />
      ) : (
        <ThemedText style={styles.label}>{label}</ThemedText>
      )}
    </Bounceable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: theme.colors.black,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  disabled: {
    opacity: 0.7,
  },
  label: {
    color: theme.colors.white,
    fontWeight: "600",
    fontSize: 20,
  },
});

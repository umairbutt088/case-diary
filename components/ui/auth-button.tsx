import { ActivityIndicator, Pressable, StyleSheet } from "react-native";

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
    <Pressable
      style={[styles.button, (loading || disabled) && styles.disabled]}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator color={theme.colors.black} />
      ) : (
        <ThemedText style={styles.label}>{label}</ThemedText>
      )}
    </Pressable>
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

import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

type TermsCheckboxProps = {
  checked: boolean;
  onToggle: () => void;
  label: React.ReactNode;
  error?: string | null;
  disabled?: boolean;
};

export function TermsCheckbox({
  checked,
  onToggle,
  label,
  error,
  disabled,
}: TermsCheckboxProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  return (
    <>
      <Pressable
        style={styles.row}
        onPress={onToggle}
        disabled={disabled}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
      >
        <MaterialIcons
          name={checked ? "check-box" : "check-box-outline-blank"}
          size={24}
          color={checked ? colors.tint : colors.icon}
        />
        <ThemedText style={styles.label}>{label}</ThemedText>
      </Pressable>
      {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 4,
    gap: 10,
  },
  label: {
    flex: 1,
    fontSize: 14,
  },
  error: {
    color: "#c00",
    fontSize: 14,
    marginBottom: 8,
  },
});

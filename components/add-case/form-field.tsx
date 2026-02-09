import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { theme } from "@/constants/theme";

type Props = {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
};

export function FormField({ label, required, hint, children }: Props) {
  return (
    <View style={styles.wrap}>
      <ThemedText style={styles.label}>
        {label}
        {required ? " *" : ""}
      </ThemedText>
      {hint ? (
        <ThemedText
          style={styles.hint}
          lightColor={theme.colors.gray50}
          darkColor={theme.colors.gray50}
        >
          {hint}
        </ThemedText>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.black90,
    marginBottom: 4,
  },
  hint: {
    fontSize: 13,
    marginBottom: 8,
  },
});

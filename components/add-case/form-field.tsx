import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { theme } from "@/constants/theme";

type Props = {
  label: string;
  required?: boolean;
  children: React.ReactNode;
};

export function FormField({ label, required, children }: Props) {
  return (
    <View style={styles.wrap}>
      <ThemedText style={styles.label}>
        {label}
        {required ? " *" : ""}
      </ThemedText>
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
    marginBottom: 8,
  },
});

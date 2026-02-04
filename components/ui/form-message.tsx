import { StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";

type FormMessageProps = {
  message: string;
  type?: "error" | "success";
};

export function FormMessage({ message, type = "error" }: FormMessageProps) {
  return (
    <ThemedText style={[styles.text, type === "success" && styles.success]}>
      {message}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  text: {
    color: "#c00",
    fontSize: 14,
    marginBottom: 8,
  },
  success: {
    color: "#0a7ea4",
  },
});

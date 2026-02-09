import type { TextInputProps } from "react-native";
import { StyleSheet, TextInput } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

type FormInputProps = TextInputProps & {
  error?: string | null;
  onClearError?: () => void;
  /** Use when the input is on a light background (e.g. auth screens) so text stays visible. */
  lightBackground?: boolean;
};

export function FormInput({
  error,
  onClearError,
  lightBackground,
  onChangeText,
  style,
  ...rest
}: FormInputProps) {
  const colorScheme = useColorScheme();
  const colors = lightBackground
    ? Colors.light
    : Colors[colorScheme ?? "light"];

  const handleChange = (text: string) => {
    if (onClearError) onClearError();
    onChangeText?.(text);
  };

  return (
    <>
      <TextInput
        style={[
          styles.input,
          { color: colors.text, borderColor: colors.icon },
          style,
        ]}
        placeholderTextColor={colors.icon}
        onChangeText={handleChange}
        {...rest}
      />
      {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
    </>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 4,
  },
  error: {
    color: "#c00",
    fontSize: 14,
    marginBottom: 8,
  },
});

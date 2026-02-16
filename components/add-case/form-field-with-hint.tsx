import type { TextInputProps } from "react-native";
import { StyleSheet, TextInput, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { theme } from "@/constants/theme";

type Props = {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  /** Optional style for the TextInput (e.g. minHeight for multiline) */
  inputStyle?: TextInputProps["style"];
} & Pick<
  TextInputProps,
  | "value"
  | "onChangeText"
  | "placeholder"
  | "editable"
  | "multiline"
  | "numberOfLines"
  | "placeholderTextColor"
  | "onFocus"
>;

export function FormFieldWithHint({
  label,
  required,
  hint,
  error,
  value,
  onChangeText,
  placeholder,
  editable = true,
  multiline,
  numberOfLines,
  placeholderTextColor = theme.colors.gray50,
  onFocus,
  inputStyle,
}: Props) {
  return (
    <View style={styles.wrap}>
      {label ? (
        <ThemedText style={styles.label}>
          {label}
          {required ? " *" : ""}
        </ThemedText>
      ) : null}
      <View
        style={[
          styles.inputRow,
          multiline && styles.inputRowMultiline,
          error && styles.inputRowError,
        ]}
      >
        <TextInput
          style={[styles.input, multiline && styles.inputMultiline, inputStyle]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={placeholderTextColor}
          editable={editable}
          multiline={multiline}
          numberOfLines={numberOfLines}
          textAlignVertical={multiline ? "top" : "center"}
          onFocus={onFocus}
        />
      </View>
      {hint ? (
        <ThemedText
          style={styles.hint}
          lightColor={theme.colors.gray50}
          darkColor={theme.colors.gray50}
        >
          {hint}
        </ThemedText>
      ) : null}
      {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.black,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.themeGray3,
    borderRadius: 10,
    paddingLeft: 14,
    paddingRight: 14,
    minHeight: 48,
  },
  inputRowMultiline: {
    alignItems: "flex-start",
    minHeight: 100,
  },
  inputRowError: {
    borderColor: theme.colors.themeRed,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.black,
    paddingVertical: 12,
    minHeight: 44,
    maxHeight: 120,
  },
  inputMultiline: {
    minHeight: 100,
    maxHeight: 200,
  },
  hint: {
    fontSize: 13,
    marginTop: 6,
  },
  error: {
    fontSize: 13,
    color: theme.colors.themeRed,
    marginTop: 4,
  },
});

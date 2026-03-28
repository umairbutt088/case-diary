import type { TextInputProps } from "react-native";
import { useMemo } from "react";
import { StyleSheet, TextInput, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import type { AppColors } from "@/constants/color-palette";
import { useThemePalette } from "@/hooks/use-theme-palette";

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
  | "keyboardType"
  | "autoCapitalize"
>;

function createFormFieldWithHintStyles(C: AppColors) {
  return StyleSheet.create({
    wrap: {
      marginBottom: 20,
    },
    label: {
      fontSize: 15,
      fontWeight: "700",
      color: C.black,
      marginBottom: 8,
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: C.themeGray3,
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
      borderColor: C.themeRed,
    },
    input: {
      flex: 1,
      fontSize: 16,
      color: C.black,
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
      color: C.themeRed,
      marginTop: 4,
    },
  });
}

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
  placeholderTextColor,
  onFocus,
  keyboardType,
  autoCapitalize,
  inputStyle,
}: Props) {
  const C = useThemePalette();
  const styles = useMemo(() => createFormFieldWithHintStyles(C), [C]);
  const ph = placeholderTextColor ?? C.gray50;

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
          placeholderTextColor={ph}
          editable={editable}
          multiline={multiline}
          numberOfLines={numberOfLines}
          textAlignVertical={multiline ? "top" : "center"}
          onFocus={onFocus}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
        />
      </View>
      {hint ? (
        <ThemedText style={styles.hint} lightColor={C.gray50} darkColor={C.gray50}>
          {hint}
        </ThemedText>
      ) : null}
      {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
    </View>
  );
}

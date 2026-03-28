import { useMemo } from "react";
import type { TextInputProps } from "react-native";
import { StyleSheet, TextInput } from "react-native";

import { ThemedText } from "@/components/themed-text";
import type { AppColors } from "@/constants/color-palette";
import { useThemePalette } from "@/hooks/use-theme-palette";

type FormInputProps = TextInputProps & {
  error?: string | null;
  onClearError?: () => void;
  /** Elevated field (e.g. auth) — gray card surface in dark mode. */
  lightBackground?: boolean;
};

function createFormInputStyles(C: AppColors) {
  return StyleSheet.create({
    error: {
      color: C.themeRed,
      fontSize: 14,
      marginBottom: 8,
    },
  });
}

export function FormInput({
  error,
  onClearError,
  lightBackground,
  onChangeText,
  style,
  ...rest
}: FormInputProps) {
  const C = useThemePalette();
  const themed = useMemo(() => createFormInputStyles(C), [C]);

  const handleChange = (text: string) => {
    if (onClearError) onClearError();
    onChangeText?.(text);
  };

  return (
    <>
      <TextInput
        style={[
          styles.input,
          {
            color: C.black,
            borderColor: C.borderGray,
            backgroundColor: lightBackground ? C.pureWhite : "transparent",
          },
          style,
        ]}
        placeholderTextColor={C.gray50}
        onChangeText={handleChange}
        {...rest}
      />
      {error ? <ThemedText style={themed.error}>{error}</ThemedText> : null}
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
});

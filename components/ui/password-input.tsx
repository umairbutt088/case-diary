import { MaterialIcons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import type { TextInputProps } from "react-native";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import type { AppColors } from "@/constants/color-palette";
import { useThemePalette } from "@/hooks/use-theme-palette";

type PasswordInputProps = TextInputProps & {
  error?: string | null;
  onClearError?: () => void;
  /** Elevated field (e.g. auth) — gray card surface in dark mode. */
  lightBackground?: boolean;
};

function createPasswordInputStyles(C: AppColors) {
  return StyleSheet.create({
    error: {
      color: C.themeRed,
      fontSize: 14,
      marginBottom: 8,
    },
  });
}

export function PasswordInput({
  error,
  onClearError,
  lightBackground,
  onChangeText,
  style,
  ...rest
}: PasswordInputProps) {
  const [show, setShow] = useState(false);
  const C = useThemePalette();
  const themed = useMemo(() => createPasswordInputStyles(C), [C]);

  const handleChange = (text: string) => {
    if (onClearError) onClearError();
    onChangeText?.(text);
  };

  return (
    <>
      <View style={styles.wrapper}>
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
          secureTextEntry={!show}
          onChangeText={handleChange}
          {...rest}
        />
        <Pressable
          style={styles.eye}
          onPress={() => setShow((v) => !v)}
          hitSlop={12}
        >
          <MaterialIcons
            name={show ? "visibility-off" : "visibility"}
            size={24}
            color={C.gray50}
          />
        </Pressable>
      </View>
      {error ? <ThemedText style={themed.error}>{error}</ThemedText> : null}
    </>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    paddingRight: 48,
  },
  eye: {
    position: "absolute",
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
});

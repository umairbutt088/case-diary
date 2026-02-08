import { MaterialIcons } from "@expo/vector-icons";
import { useState } from "react";
import type { TextInputProps } from "react-native";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

type PasswordInputProps = TextInputProps & {
  error?: string | null;
  onClearError?: () => void;
  /** Use when the input is on a light background (e.g. auth screens) so text stays visible. */
  lightBackground?: boolean;
};

export function PasswordInput({
  error,
  onClearError,
  lightBackground,
  onChangeText,
  style,
  ...rest
}: PasswordInputProps) {
  const [show, setShow] = useState(false);
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
      <View style={styles.wrapper}>
        <TextInput
          style={[
            styles.input,
            { color: colors.text, borderColor: colors.icon },
            style,
          ]}
          placeholderTextColor={colors.icon}
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
            color={colors.icon}
          />
        </Pressable>
      </View>
      {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
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
  error: {
    color: "#c00",
    fontSize: 14,
    marginBottom: 8,
  },
});

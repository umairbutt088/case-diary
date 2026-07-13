import { MaterialIcons } from "@expo/vector-icons";
import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import type { AppColors } from "@/constants/color-palette";
import { useThemePalette } from "@/hooks/use-theme-palette";

type TermsCheckboxProps = {
  checked: boolean;
  onToggle: () => void;
  termsLabel?: string;
  privacyLabel?: string;
  onTermsPress?: () => void;
  onPrivacyPress?: () => void;
  error?: string | null;
  disabled?: boolean;
};

function createTermsCheckboxStyles(C: AppColors) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 16,
      marginBottom: 4,
      gap: 10,
    },
    labelWrap: {
      flex: 1,
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
    },
    label: {
      fontSize: 14,
    },
    link: {
      textDecorationLine: "underline",
      fontSize: 14,
      color: C.btnBlue,
    },
    error: {
      color: C.themeRed,
      fontSize: 14,
      marginBottom: 8,
    },
  });
}

export function TermsCheckbox({
  checked,
  onToggle,
  termsLabel = "Terms of Service",
  privacyLabel = "Privacy Policy",
  onTermsPress,
  onPrivacyPress,
  error,
  disabled,
}: TermsCheckboxProps) {
  const C = useThemePalette();
  const styles = useMemo(() => createTermsCheckboxStyles(C), [C]);

  return (
    <>
      <View style={styles.row}>
        <Pressable
          onPress={onToggle}
          disabled={disabled}
          hitSlop={8}
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
          accessibilityLabel="Accept terms and privacy policy"
        >
          <MaterialIcons
            name={checked ? "check-box" : "check-box-outline-blank"}
            size={24}
            color={checked ? C.themeBlack : C.gray50}
          />
        </Pressable>
        <View style={styles.labelWrap}>
          <ThemedText type="label" style={styles.label}>I agree to the </ThemedText>
          <Pressable
            onPress={onTermsPress}
            disabled={disabled}
            accessibilityRole="link"
            accessibilityLabel={termsLabel}
          >
            <ThemedText type="link" style={styles.link}>{termsLabel}</ThemedText>
          </Pressable>
          <ThemedText type="label" style={styles.label}> and </ThemedText>
          <Pressable
            onPress={onPrivacyPress}
            disabled={disabled}
            accessibilityRole="link"
            accessibilityLabel={privacyLabel}
          >
            <ThemedText type="link" style={styles.link}>{privacyLabel}</ThemedText>
          </Pressable>
          <ThemedText type="label" style={styles.label}> by using this app.</ThemedText>
        </View>
      </View>
      {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
    </>
  );
}

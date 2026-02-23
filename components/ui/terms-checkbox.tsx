import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Colors, theme } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

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
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

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
            color={checked ? theme.colors.black : theme.colors.gray30}
          />
        </Pressable>
        <View style={styles.labelWrap}>
          <ThemedText style={styles.label}>I agree to the </ThemedText>
          <Pressable
            onPress={onTermsPress}
            disabled={disabled}
            accessibilityRole="link"
            accessibilityLabel={termsLabel}
          >
            <ThemedText type="link" style={styles.link}>
              {termsLabel}
            </ThemedText>
          </Pressable>
          <ThemedText style={styles.label}> and </ThemedText>
          <Pressable
            onPress={onPrivacyPress}
            disabled={disabled}
            accessibilityRole="link"
            accessibilityLabel={privacyLabel}
          >
            <ThemedText type="link" style={styles.link}>
              {privacyLabel}
            </ThemedText>
          </Pressable>
          <ThemedText style={styles.label}> by using this app.</ThemedText>
        </View>
      </View>
      {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
    </>
  );
}

const styles = StyleSheet.create({
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
    color: theme.colors.black,
  },
  link: {
    textDecorationLine: "underline",
    fontSize: 14,
  },
  error: {
    color: "#c00",
    fontSize: 14,
    marginBottom: 8,
  },
});

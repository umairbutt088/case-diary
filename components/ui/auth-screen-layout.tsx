import { Link } from "expo-router";
import { type ReactNode } from "react";
import { Pressable, StyleSheet } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors, theme } from "@/constants/theme";

type AuthScreenLayoutProps = {
  title: string;
  children: ReactNode;
  footerLink?: { linkHeader: string; linkLabel: string; href: string };
};

export function AuthScreenLayout({
  title,
  children,
  footerLink,
}: AuthScreenLayoutProps) {
  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        extraScrollHeight={24}
      >
        <ThemedText type="title" style={styles.title}>
          {title}
        </ThemedText>
        {children}
        {footerLink ? (
          <ThemedView style={styles.footer}>
            <ThemedText style={styles.footerLinkHeader}>
              {footerLink.linkHeader}{" "}
            </ThemedText>
            <Link href={footerLink.href as any} asChild>
              <Pressable accessibilityRole="link">
                <ThemedText type="link">{footerLink.linkLabel}</ThemedText>
              </Pressable>
            </Link>
          </ThemedView>
        ) : null}
      </KeyboardAwareScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  scroll: {
    flexGrow: 1,
    padding: 24,
    justifyContent: "center",
  },
  title: {
    marginBottom: 100,
    textAlign: "center",
    color: theme.colors.black,
    fontWeight: "900",
  },
  footer: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    backgroundColor: theme.colors.background,
  },
  footerLinkHeader: {
    color: theme.colors.black,
  },
});

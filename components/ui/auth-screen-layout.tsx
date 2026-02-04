import { Link } from "expo-router";
import { type ReactNode } from "react";
import { Pressable, StyleSheet } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

type AuthScreenLayoutProps = {
  title: string;
  children: ReactNode;
  footerLink?: { label: string; href: string };
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
          <Link href={footerLink.href as any} asChild>
            <Pressable style={styles.footer} accessibilityRole="link">
              <ThemedText type="link">{footerLink.label}</ThemedText>
            </Pressable>
          </Link>
        ) : null}
      </KeyboardAwareScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 48,
  },
  title: {
    marginBottom: 24,
  },
  footer: {
    marginTop: 24,
    alignItems: "center",
  },
});

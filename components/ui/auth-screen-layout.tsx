import { Link } from "expo-router";
import { type ReactNode, useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

import { ThemedText } from "@/components/themed-text";
import type { AppColors } from "@/constants/color-palette";
import { useThemePalette } from "@/hooks/use-theme-palette";

type AuthScreenLayoutProps = {
  title: string;
  children: ReactNode;
  footerLink?: { linkHeader: string; linkLabel: string; href: string };
};

function createAuthLayoutStyles(C: AppColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.background,
    },
    scroll: {
      flexGrow: 1,
      padding: 24,
      justifyContent: "center",
    },
    title: {
      marginBottom: 100,
      textAlign: "center",
      fontWeight: "900",
      color: C.black,
    },
    footer: {
      marginTop: 24,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      flexWrap: "wrap",
    },
    footerLinkHeader: {
      color: C.black,
      fontSize: 16,
    },
  });
}

export function AuthScreenLayout({
  title,
  children,
  footerLink,
}: AuthScreenLayoutProps) {
  const C = useThemePalette();
  const styles = useMemo(() => createAuthLayoutStyles(C), [C]);

  return (
    <View style={styles.container}>
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
          <View style={styles.footer}>
            <ThemedText style={styles.footerLinkHeader}>
              {footerLink.linkHeader}{" "}
            </ThemedText>
            <Link href={footerLink.href as any} asChild>
              <Pressable accessibilityRole="link">
                <ThemedText type="link">{footerLink.linkLabel}</ThemedText>
              </Pressable>
            </Link>
          </View>
        ) : null}
      </KeyboardAwareScrollView>
    </View>
  );
}

import { useRouter } from "expo-router";
import { useEffect, useMemo } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import type { AppColors } from "@/constants/color-palette";
import { useAuth } from "@/context/auth-context";
import { useThemePalette } from "@/hooks/use-theme-palette";

/**
 * Central auth navigator: routes based on session.
 * Login/signup screens must NOT navigate after success; this component reacts to auth state.
 */
function createAuthOverlayStyles(C: AppColors) {
  return StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 999,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: C.background,
    },
    loadingText: {
      marginTop: 12,
      color: C.black,
    },
  });
}

export function AuthNavigator({ children }: { children: React.ReactNode }) {
  const { session, isLoading } = useAuth();
  const router = useRouter();
  const C = useThemePalette();
  const overlayStyles = useMemo(() => createAuthOverlayStyles(C), [C]);

  const isAuthenticated = !!session?.user;

  // Wait until session loading is complete before showing app content
  const ready = !isLoading;

  // Single effect: whenever auth or onboarding state is known, navigate after a tick
  // (defer so React has committed session state and router is ready)
  useEffect(() => {
    if (!ready) return;

    const target = isAuthenticated ? "/(tabs)" : "/(auth)/login";

    const id = setTimeout(() => {
      router.replace(target as any);
    }, 0);

    return () => clearTimeout(id);
  }, [ready, isAuthenticated, router]);

  return (
    <>
      {children}
      {!ready ? (
        <View style={overlayStyles.overlay}>
          <ActivityIndicator size="large" color={C.black} />
          <ThemedText style={overlayStyles.loadingText}>
            Starting app...
          </ThemedText>
        </View>
      ) : null}
    </>
  );
}

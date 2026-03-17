import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { theme } from "@/constants/theme";
import { useAuth } from "@/context/auth-context";

/**
 * Central auth navigator: routes based on session.
 * Login/signup screens must NOT navigate after success; this component reacts to auth state.
 */
export function AuthNavigator({ children }: { children: React.ReactNode }) {
  const { session, isLoading } = useAuth();
  const router = useRouter();

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
        <ThemedView style={styles.overlay}>
          <ActivityIndicator size="large" color={theme.colors.black} />
          <ThemedText style={styles.loadingText}>Starting app...</ThemedText>
        </ThemedView>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.96)",
  },
  loadingText: {
    marginTop: 12,
  },
});

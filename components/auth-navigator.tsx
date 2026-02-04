import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { ActivityIndicator, StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAuth } from "@/context/auth-context";

/**
 * Central auth navigator: routes based on session and onboarding.
 * Login/signup screens must NOT navigate after success; this component reacts to auth state.
 */
export function AuthNavigator({ children }: { children: React.ReactNode }) {
  const { session, isLoading, onboardingCompleted } = useAuth();
  const router = useRouter();
  const initialNavDone = useRef(false);

  const isAuthenticated = !!session?.user;
  const onboardingDone = onboardingCompleted === true;

  // Wait until we know both session and onboarding state before showing app content
  const ready = !isLoading && onboardingCompleted !== null;

  // Single effect: whenever auth or onboarding state is known, navigate after a tick
  // (defer so React has committed session state and router is ready)
  useEffect(() => {
    if (!ready) return;

    const target = isAuthenticated
      ? "/(tabs)"
      : !onboardingDone
      ? "/(auth)/onboarding"
      : "/(auth)/login";

    const id = setTimeout(() => {
      router.replace(target as any);
      initialNavDone.current = true;
    }, 0);

    return () => clearTimeout(id);
  }, [ready, isAuthenticated, onboardingDone, router]);

  if (!ready) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" />
        <ThemedText style={styles.loadingText}>Loading…</ThemedText>
      </ThemedView>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
  },
});

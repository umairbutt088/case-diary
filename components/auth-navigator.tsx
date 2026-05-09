import { useRouter } from "expo-router";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  InteractionManager,
  StyleSheet,
  View,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import type { AppColors } from "@/constants/color-palette";
import { useAuth } from "@/context/auth-context";
import { useThemePalette } from "@/hooks/use-theme-palette";

/** Matches native splash letterbox (`app.json`) so nothing “wrong” flashes between splash and the real screen. */
const ROUTE_GATE_BG = "#F8F8F8";

/**
 * Central auth navigator: routes based on session.
 * Login/signup screens must NOT navigate after success; this component reacts to auth state.
 */
function createAuthOverlayStyles(C: AppColors) {
  return StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 9999,
      justifyContent: "center",
      alignItems: "center",
    },
    loadingText: {
      marginTop: 12,
      color: C.black,
    },
  });
}

export function AuthNavigator({ children }: { children: React.ReactNode }) {
  const { session, isLoading, expectsPasswordChange } = useAuth();
  const router = useRouter();
  const C = useThemePalette();
  const overlayStyles = useMemo(() => createAuthOverlayStyles(C), [C]);

  const isAuthenticated = !!session?.user;
  const ready = !isLoading;
  const targetRoute =
    isAuthenticated && expectsPasswordChange
      ? "/(auth)/reset-password"
      : isAuthenticated
        ? "/(tabs)"
        : "/(auth)/login";

  /** After `ready`, cover the stack until `router.replace` has visibly applied (prevents one frame of tabs/home). */
  const [routeSettled, setRouteSettled] = useState(false);
  const routeGateGeneration = useRef(0);

  useLayoutEffect(() => {
    if (!ready) {
      setRouteSettled(false);
      return;
    }

    setRouteSettled(false);
    router.replace(targetRoute as any);

    const gen = ++routeGateGeneration.current;
    let raf1 = 0;
    let raf2 = 0;

    const task = InteractionManager.runAfterInteractions(() => {
      if (gen !== routeGateGeneration.current) return;
      raf1 = requestAnimationFrame(() => {
        if (gen !== routeGateGeneration.current) return;
        raf2 = requestAnimationFrame(() => {
          if (gen !== routeGateGeneration.current) return;
          setRouteSettled(true);
        });
      });
    });

    return () => {
      task.cancel?.();
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [ready, isAuthenticated, expectsPasswordChange, targetRoute, router]);

  const showAuthLoading = !ready;
  const showRouteGate = ready && !routeSettled;
  const overlayVisible = showAuthLoading || showRouteGate;
  const overlayBackground = showAuthLoading ? C.background : ROUTE_GATE_BG;

  return (
    <>
      {children}
      {overlayVisible ? (
        <View style={[overlayStyles.overlay, { backgroundColor: overlayBackground }]}>
          {showAuthLoading ? (
            <>
              <ActivityIndicator size="large" color={C.black} />
              <ThemedText style={overlayStyles.loadingText}>
                Starting app...
              </ThemedText>
            </>
          ) : null}
        </View>
      ) : null}
    </>
  );
}

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
    },
  });
}

export function AuthNavigator({ children }: { children: React.ReactNode }) {
  const {
    session,
    isLoading,
    isAccessLoading,
    expectsPasswordChange,
  } = useAuth();
  const router = useRouter();
  const C = useThemePalette();
  const overlayStyles = useMemo(() => createAuthOverlayStyles(C), [C]);

  const isAuthenticated = !!session?.user;
  const ready = !isLoading && (!isAuthenticated || !isAccessLoading);
  const targetRoute = useMemo(
    () =>
      isAuthenticated && expectsPasswordChange
        ? "/(auth)/reset-password"
        : isAuthenticated
          ? "/(tabs)"
          : "/(auth)/login",
    [expectsPasswordChange, isAuthenticated],
  );

  /** After `ready`, cover the stack until `router.replace` has visibly applied (prevents one frame of tabs/home). */
  const [routeSettled, setRouteSettled] = useState(false);
  const routeGateGeneration = useRef(0);
  const lastReplacedRoute = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (!ready) {
      setRouteSettled(false);
      lastReplacedRoute.current = null;
      return;
    }

    if (lastReplacedRoute.current === targetRoute) {
      setRouteSettled(true);
      return;
    }

    setRouteSettled(false);
    lastReplacedRoute.current = targetRoute;
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
  }, [ready, targetRoute, router]);

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
              <ActivityIndicator size="large" color={C.textPrimary} />
              <ThemedText type="default" style={overlayStyles.loadingText}>
                Starting app...
              </ThemedText>
            </>
          ) : null}
        </View>
      ) : null}
    </>
  );
}

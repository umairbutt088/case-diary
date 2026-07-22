import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { BackHandler } from "react-native";

function isFromHomeParam(value: string | string[] | undefined): boolean {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "home";
}

export function useHomeBackNavigation() {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string | string[] }>();

  const fromHome = useMemo(() => isFromHomeParam(params.from), [params.from]);

  const goBack = useCallback(() => {
    // Prefer pop: Home → push(cases-overview) → replace("/(tabs)") left a second
    // Home under the first, so iOS swipe-back unstacked duplicate Homes.
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)");
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      if (!fromHome) return;
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        goBack();
        return true;
      });
      return () => sub.remove();
    }, [fromHome, goBack]),
  );

  return { fromHome, goBack };
}

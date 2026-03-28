import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  APPEARANCE_STORAGE_KEY,
  type AppearancePreference,
  darkAppColors,
  lightAppColors,
  type AppColors,
} from "@/constants/color-palette";

type AppThemeContextValue = {
  /** User-selected appearance (persisted). */
  preference: AppearancePreference;
  setPreference: (next: AppearancePreference) => Promise<void>;
  isDark: boolean;
  colors: AppColors;
  /** True after AsyncStorage has been read. */
  ready: boolean;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] =
    useState<AppearancePreference>("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(APPEARANCE_STORAGE_KEY);
        if (!cancelled && (raw === "dark" || raw === "light")) {
          setPreferenceState(raw);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setPreference = useCallback(async (next: AppearancePreference) => {
    setPreferenceState(next);
    await AsyncStorage.setItem(APPEARANCE_STORAGE_KEY, next);
  }, []);

  const isDark = preference === "dark";
  const colors = useMemo(
    () => (isDark ? darkAppColors : lightAppColors),
    [isDark],
  );

  const value = useMemo(
    () => ({
      preference,
      setPreference,
      isDark,
      colors,
      ready,
    }),
    [preference, setPreference, isDark, colors, ready],
  );

  return (
    <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>
  );
}

export function useAppTheme(): AppThemeContextValue {
  const ctx = useContext(AppThemeContext);
  if (!ctx) {
    throw new Error("useAppTheme must be used within AppThemeProvider");
  }
  return ctx;
}

/** Safe for optional use (e.g. before tests mount provider). */
export function useAppThemeOptional(): AppThemeContextValue | null {
  return useContext(AppThemeContext);
}

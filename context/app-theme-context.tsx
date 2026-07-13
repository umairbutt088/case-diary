import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Appearance, type ColorSchemeName } from "react-native";

import {
  APPEARANCE_STORAGE_KEY,
  type AppearancePreference,
  darkAppColors,
  lightAppColors,
  type AppColors,
} from "@/constants/color-palette";

/** One-time: move older light/dark defaults to system so device appearance works. */
const APPEARANCE_SYSTEM_MIGRATION_KEY =
  "@legal_diary/appearance_follow_system_v1";

type AppThemeContextValue = {
  /** User-selected appearance (persisted). `"system"` follows the device. */
  preference: AppearancePreference;
  setPreference: (next: AppearancePreference) => Promise<void>;
  isDark: boolean;
  colors: AppColors;
  /** True after AsyncStorage has been read. */
  ready: boolean;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

function isValidPreference(value: string | null): value is AppearancePreference {
  return value === "system" || value === "light" || value === "dark";
}

function resolveSystemIsDark(scheme: ColorSchemeName | null | undefined): boolean {
  return scheme === "dark";
}

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(() =>
    Appearance.getColorScheme(),
  );
  const [preference, setPreferenceState] =
    useState<AppearancePreference>("system");
  const [ready, setReady] = useState(false);

  // Keep in sync when the device / simulator toggles appearance.
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme);
    });
    // Re-read in case the scheme changed before the listener attached.
    setSystemScheme(Appearance.getColorScheme());
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const migrated = await AsyncStorage.getItem(
          APPEARANCE_SYSTEM_MIGRATION_KEY,
        );
        if (!migrated) {
          // Previous builds only stored light/dark and overrode the OS.
          // Switch defaults to System so simulator / device toggles work.
          await AsyncStorage.setItem(APPEARANCE_STORAGE_KEY, "system");
          await AsyncStorage.setItem(APPEARANCE_SYSTEM_MIGRATION_KEY, "1");
          if (!cancelled) setPreferenceState("system");
        } else {
          const raw = await AsyncStorage.getItem(APPEARANCE_STORAGE_KEY);
          if (!cancelled && isValidPreference(raw)) {
            setPreferenceState(raw);
          }
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

  const isDark = useMemo(() => {
    if (preference === "system") {
      return resolveSystemIsDark(systemScheme);
    }
    return preference === "dark";
  }, [preference, systemScheme]);

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

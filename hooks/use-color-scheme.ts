import { useColorScheme as useRNColorScheme } from "react-native";

import { useAppThemeOptional } from "@/context/app-theme-context";

/**
 * Appearance for the app: follows user preference from AppThemeProvider
 * when mounted; otherwise falls back to the system color scheme.
 */
export function useColorScheme(): "light" | "dark" {
  const app = useAppThemeOptional();
  const system = useRNColorScheme();
  if (app?.ready) {
    return app.isDark ? "dark" : "light";
  }
  return system === "dark" ? "dark" : "light";
}

import { useEffect, useState } from "react";
import { Appearance, type ColorSchemeName } from "react-native";

import { useAppThemeOptional } from "@/context/app-theme-context";

/**
 * Resolved light/dark for the app.
 * Prefer AppThemeProvider (supports System / Light / Dark); otherwise fall back
 * to the device color scheme via Appearance.
 */
export function useColorScheme(): "light" | "dark" {
  const app = useAppThemeOptional();
  const [system, setSystem] = useState<ColorSchemeName>(() =>
    Appearance.getColorScheme(),
  );

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystem(colorScheme);
    });
    setSystem(Appearance.getColorScheme());
    return () => sub.remove();
  }, []);

  if (app?.ready) {
    return app.isDark ? "dark" : "light";
  }
  return system === "dark" ? "dark" : "light";
}

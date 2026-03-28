import { useAppTheme } from "@/context/app-theme-context";
import type { AppColors } from "@/constants/color-palette";

/**
 * Resolved semantic colors for the current appearance.
 * Prefer this over static `theme.colors` in components.
 */
export function useThemePalette(): AppColors {
  return useAppTheme().colors;
}

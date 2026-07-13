import { theme } from "@/constants/theme";

/**
 * Full app color shape (same as theme.colors). Use lightAppColors / darkAppColors
 * everywhere via useThemePalette() so light/dark stays consistent.
 */
export type AppColors = typeof theme.colors;

const base = theme.colors;

/** Light mode — semantic text hierarchy on warm surfaces. */
export const lightAppColors: AppColors = {
  ...base,
  text: base.textPrimary,
  black: base.textPrimary,
  black80: base.textPrimary,
  black90: base.textPrimary,
  blackish: base.textPrimary,
  gray50: base.textSecondary,
  gray70: base.textMuted,
  fadeBlack: base.textMuted,
  darkGray: base.textMuted,
  gray80: base.textMuted,
  themePlaceholder: base.textMuted,
};

/**
 * Dark mode: navy surfaces, semantic text hierarchy, readable accents.
 */
export const darkAppColors: AppColors = {
  ...base,
  textPrimary: "#F5F5F7",
  textSecondary: "#C7C7CC",
  textMuted: "#8E8E93",
  textAccent: "#E8C872",
  textLink: "#6EB6FF",
  textInverse: "#FFFFFF",
  text: "#F5F5F7",
  background: "#0F1118",
  themeWhite: "#0F1118",
  pureWhite: "#252830",
  white: "#252830",
  black: "#F5F5F7",
  themeBlack: "#48484A",
  black80: "#F5F5F7",
  black90: "#FFFFFF",
  blackish: "#F5F5F7",
  gray50: "#C7C7CC",
  gray70: "#8E8E93",
  gray40: "#636366",
  gray30: "#8E8E93",
  borderGray: "#3A3D47",
  themeGray3: "#3A3D47",
  themeGray2: "#3A3D47",
  themeGray4: "#3A3D47",
  grey100: "#1C1F28",
  inputbg: "#1C1F28",
  gray60: "#1C1F28",
  gray100: "#1C1F28",
  btnGray: "#252830",
  GrayBtnTitle: "#F5F5F7",
  cream50: "#1C1F28",
  cream: "#1C1F28",
  cream60: "#1C1F28",
  cream70: "#1C1F28",
  cream80: "#1C1F28",
  cream100: "#252830",
  backgroundCream: "#0F1118",
  dullwhite: "#252830",
  fadeBlack: "#8E8E93",
  darkGray: "#8E8E93",
  gray80: "#8E8E93",
  themePlaceholder: "#8E8E93",
  themeRed: "#FF453A",
  themeGreen: "#32D74B",
  btnBlue: "#6EB6FF",
  blue: "#6EB6FF",
  blue100: "#6EB6FF",
  btnGreen: "#32D74B",
  red: "#FF453A",
  red100: "#3A2020",
  red200: "#FF453A",
  themeWarm: "#FF9F0A",
  orange: "#FF9F0A",
};

export const APPEARANCE_STORAGE_KEY = "@legal_diary/appearance_preference";

export type AppearancePreference = "light" | "dark";

/**
 * Bottom sheets and centered modals: in dark mode use a surface darker than
 * `pureWhite` (which reads too light on OLED next to a black screen).
 */
export function modalSheetBackground(colors: AppColors, isDark: boolean): string {
  return isDark ? colors.grey100 : colors.pureWhite;
}

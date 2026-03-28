import { theme } from "@/constants/theme";

/**
 * Full app color shape (same as theme.colors). Use lightAppColors / darkAppColors
 * everywhere via useThemePalette() so light/dark stays consistent.
 */
export type AppColors = typeof theme.colors;

const base = theme.colors;

/** Current light mode — same as legacy theme.colors. */
export const lightAppColors: AppColors = base;

/**
 * Dark mode: black screen, gray surfaces/cards, white primary text,
 * primary actions use gray instead of near-black.
 */
export const darkAppColors: AppColors = {
  ...base,
  text: "#FFFFFF",
  background: "#000000",
  themeWhite: "#000000",
  pureWhite: "#3A3A3C",
  white: "#3A3A3C",
  black: "#FFFFFF",
  themeBlack: "#8E8E93",
  black80: "#F2F2F7",
  black90: "#FFFFFF",
  gray50: "#ABABAB",
  gray70: "#8E8E93",
  gray40: "#636366",
  gray30: "#8E8E93",
  borderGray: "#48484A",
  themeGray3: "#48484A",
  themeGray2: "#48484A",
  themeGray4: "#48484A",
  grey100: "#2C2C2C",
  inputbg: "#2C2C2C",
  gray60: "#2C2C2C",
  gray100: "#2C2C2C",
  btnGray: "#3A3A3C",
  GrayBtnTitle: "#FFFFFF",
  cream50: "#2C2C2C",
  cream: "#2C2C2C",
  cream60: "#2C2C2C",
  cream70: "#2C2C2C",
  cream80: "#2C2C2C",
  cream100: "#3A3A3C",
  backgroundCream: "#000000",
  dullwhite: "#3A3A3C",
  fadeBlack: "#ABABAB",
  darkGray: "#ABABAB",
  gray80: "#ABABAB",
  themePlaceholder: "#8E8E93",
  blackish: "#E5E5E5",
  /** System-style accents (readable on dark) */
  themeRed: "#FF453A",
  themeGreen: "#32D74B",
  btnBlue: "#0A84FF",
  blue: "#0A84FF",
  blue100: "#0A84FF",
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

import { Dimensions, Platform } from "react-native";

// BarFly-style color palette
const colors = {
  orange: "#F97316",
  orangeLight: "#FFB07D",
  themeBlack: "#1A1A1A",
  themeWhite: "#F9FAFB",
  themeGray: "#667085",
  themeGray2: "#DDDDDD",
  themeGray3: "#E5E5E5",
  themeGray4: "#DCDCDC",
  themeGreen: "#039855",
  themeWarm: "#DC6803",
  themeRed: "#D92D20",
  themePlaceholder: "#475467",
  background: "#F9F9FB",
  backgroundCream: "#FFFBF6",
  borderGray: "#D0D5DD",
  red: "#F04438",
  white: "#ffffff",
  inputbg: "#F9F9FB",
  btnBlue: "#2D6BEE",
  btnGreen: "#3FB575",
  blue100: "#0088FF",
  blue: "#007AF2",
  moderateBlue: "#387ca0",
  black80: "#211F1F",
  fadeBlack: "#898D88",
  black90: "#101828",
  gray70: "#98A2B3",
  gray80: "#898D88",
  gray30: "#858585",
  gray40: "#D9D9D9",
  gray50: "#667085",
  grey100: "#E8E8E8",
  pureWhite: "#fff",
  gray100: "#F1F5FF",
  gray60: "#F5F5F5",
  darkGray: "#898D88",
  dullwhite: "#E5E5E5",
  lightBlue: "#486484",
  red100: "#FFE9E9",
  red200: "#FF0000",
  blackish: "#171717",
  black: "#000000",
  btnGray: "#EFEFEF",
  GrayBtnTitle: "#121212",
  orange50: "#FF5D50",
  pink50: "#FF796F",
  primary: "#781E28",
  secondary: "#9F5C5D",
  secondary2: "#7B333A",
  cream: "#FFF6F1",
  cream50: "#FCF0E8",
  cream100: "#F6DDCF",
  cream60: "#FCE5C6",
  cream70: "#F5EDE6",
  cream80: "#FFF7EF",
  zodiacColour: "#C09442",
  green: "#4CAF50",
};

const spacesFrom1 = Array.from({ length: 64 }, (_, i) => i + 1);
const spaces = [0.5, ...spacesFrom1];
const spacesMultiplier = spaces.map((space) => space * 4);

const fontWeights = {
  hairline: "100",
  thin: "200",
  light: "300",
  normal: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
  extrabold: "800",
  black: "900",
};

const fontSize = {
  inputTitle: 12,
  xxxSmallText: 8,
  xxSmallText: 10,
  descText: 13,
  xSmallText: 14,
  smallText15: 15,
  smallText: 16,
  smallTitle: 18,
  titleMedium: 20,
  titleNormal: 24,
  xNormal: 26,
  titleBig: 28,
  xTitle: 30,
  yTitle: 20,
};

const paddings = {
  top: spacesMultiplier[5],
  horizontal: spacesMultiplier[5],
};

const X_WIDTH = 375;
const X_HEIGHT = 812;
const SE_HEIGHT = 667;
const XSMAX_WIDTH = 414;
const XSMAX_HEIGHT = 896;
const XII_WIDTH = 390;
const XII_HEIGHT = 844;
const XIII_WIDTH = 428;
const XIII_HEIGHT = 926;

const { height, width } = Dimensions.get("window");

const barHeight = () => {
  if (Platform.OS === "ios" && !Platform.isPad) {
    if (width === X_WIDTH && height === X_HEIGHT) return 40;
    if (width === X_WIDTH && height === SE_HEIGHT) return 17;
    if (width === XSMAX_WIDTH && height === XSMAX_HEIGHT) return 41;
    if (width === XII_WIDTH && height === XII_HEIGHT) return 44;
    if (width === XIII_WIDTH && height === XIII_HEIGHT) return 44;
    return 20;
  }
  return 0;
};

const StatusBarHeight = Platform.select({
  ios: barHeight(),
  android: 0,
  default: 0,
});

const dimensions = {
  screenWidth: Dimensions.get("window").width,
  screenHeight: Dimensions.get("window").height,
  statusBar: StatusBarHeight,
  bottomTabs: {
    height: 80,
    paddingBottom: spaces[5],
  },
  headerHeight: Platform.OS === "ios" ? 64 : 50,
  artworkSummary: 140,
};

const animations = {
  bottomTabBar: {
    duration: 500,
  },
  discoverOverlay: {
    duration: 500,
  },
  discoverSwipe: {
    duration: 500,
  },
};

const shadow = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  android: {
    elevation: 5,
  },
});

// Theme object (BarFly-style)
export const theme = {
  fontFamilies: {
    bold: "System",
    text: "System",
    semibold: "System",
    light: "System",
    boldTitle: "System",
    textLato: "System",
  },
  colors: {
    text: colors.black,
    ...colors,
  },
  space: spacesMultiplier,
  fontWeights,
  paddings,
  dimensions,
  animations,
  fontSize,
  shadow,
};

// Light/dark palettes for useColorScheme and useThemeColor (uses theme colors)
export const Colors = {
  light: {
    text: colors.black,
    background: colors.background,
    tint: colors.primary,
    icon: colors.themeGray,
    tabIconDefault: colors.gray50,
    tabIconSelected: colors.primary,
    black: colors.black,
  },
  dark: {
    text: colors.themeWhite,
    background: colors.themeBlack,
    tint: colors.themeWhite,
    icon: colors.gray70,
    tabIconDefault: colors.gray70,
    tabIconSelected: colors.themeWhite,
    black: colors.themeWhite,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

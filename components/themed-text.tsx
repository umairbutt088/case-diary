import { StyleSheet, Text, type TextProps, type TextStyle } from "react-native";

import { useAppTheme } from "@/context/app-theme-context";

export type ThemedTextType =
  | "default"
  | "title"
  | "defaultSemiBold"
  | "subtitle"
  | "link"
  | "label"
  | "secondary"
  | "muted"
  | "accent"
  | "caption";

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: ThemedTextType;
};

function resolveTypeColor(
  type: ThemedTextType,
  colors: ReturnType<typeof useAppTheme>["colors"],
): string {
  switch (type) {
    case "label":
    case "secondary":
      return colors.textSecondary;
    case "muted":
    case "caption":
      return colors.textMuted;
    case "accent":
    case "title":
    case "subtitle":
      return colors.textAccent;
    case "link":
      return colors.textLink;
    default:
      return colors.textPrimary;
  }
}

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = "default",
  ...rest
}: ThemedTextProps) {
  const { isDark, colors } = useAppTheme();
  const override = isDark ? darkColor : lightColor;
  const typeColor = resolveTypeColor(type, colors);
  const flatStyle = StyleSheet.flatten(style) as TextStyle | undefined;
  /** Explicit override, else keep semantic/status colors from style (red, inverse), else type token. */
  const styleColor = flatStyle?.color;
  const keepStyleColor =
    styleColor != null &&
    styleColor !== colors.textPrimary &&
    styleColor !== colors.textSecondary &&
    styleColor !== colors.textMuted &&
    styleColor !== colors.textAccent &&
    styleColor !== colors.textLink &&
    styleColor !== colors.black &&
    styleColor !== colors.gray50;
  const color = override ?? (keepStyleColor ? styleColor : typeColor);

  return (
    <Text
      style={[
        typeStyles[type],
        style,
        { color },
      ]}
      {...rest}
    />
  );
}

const typeStyles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 24,
  },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  label: {
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },
  secondary: {
    fontSize: 14,
    lineHeight: 20,
  },
  muted: {
    fontSize: 13,
    lineHeight: 18,
  },
  caption: {
    fontSize: 11,
    lineHeight: 14,
  },
  accent: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
  },
  link: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
  },
});

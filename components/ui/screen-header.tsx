import { ThemedText } from "@/components/themed-text";
import { useThemePalette } from "@/hooks/use-theme-palette";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Bounceable } from "./bounceable";

interface ScreenHeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  leftComponent?: React.ReactNode;
  rightComponent?: React.ReactNode;
  onTitleLongPress?: () => void;
  titleAccessibilityLabel?: string;
}

export function ScreenHeader({
  title,
  showBack = true,
  onBack,
  leftComponent,
  rightComponent,
  onTitleLongPress,
  titleAccessibilityLabel,
}: ScreenHeaderProps) {
  const router = useRouter();
  const C = useThemePalette();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        header: {
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: C.themeGray3,
          backgroundColor: C.background,
        },
        backBtn: {
          padding: 4,
          marginRight: 8,
          flexShrink: 0,
        },
        leftWrap: {
          marginRight: 8,
          flexDirection: "row",
          alignItems: "center",
          flexShrink: 0,
        },
        headerTitleWrap: {
          flex: 1,
          flexShrink: 1,
          minWidth: 0,
          justifyContent: "center",
        },
        headerTitle: {
          fontSize: 18,
          fontWeight: "700",
        },
        rightWrap: {
          flexDirection: "row",
          alignItems: "center",
          flexShrink: 0,
          marginLeft: 8,
        },
      }),
    [C],
  );

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  const titleContent = (
    <ThemedText type="accent"
      style={styles.headerTitle}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.65}
    >
      {title}
    </ThemedText>
  );

  return (
    <View style={styles.header}>
      {showBack && (
        <Bounceable onPress={handleBack} style={styles.backBtn} activeScale={0.9}>
          <MaterialIcons name="arrow-back" size={24} color={C.textAccent} />
        </Bounceable>
      )}
      {leftComponent && <View style={styles.leftWrap}>{leftComponent}</View>}

      {onTitleLongPress ? (
        <Bounceable
          style={styles.headerTitleWrap}
          onLongPress={onTitleLongPress}
          accessibilityLabel={titleAccessibilityLabel || title}
          accessibilityHint="Long press for full title"
          activeScale={0.98}
        >
          {titleContent}
        </Bounceable>
      ) : (
        <View style={styles.headerTitleWrap}>
          {titleContent}
        </View>
      )}

      {rightComponent && (
        <View style={styles.rightWrap}>{rightComponent}</View>
      )}
    </View>
  );
}

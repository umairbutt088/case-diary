import { ActivityIndicator, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import type { AppColors } from "@/constants/color-palette";
import { useThemePalette } from "@/hooks/use-theme-palette";

type Props = {
  loading: boolean;
  hasMore: boolean;
  itemCount: number;
};

function createStyles(C: AppColors) {
  return StyleSheet.create({
    wrap: {
      paddingVertical: 16,
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    text: {
      fontSize: 12,
      color: C.gray50,
    },
  });
}

export function ListPageFooter({ loading, hasMore, itemCount }: Props) {
  const C = useThemePalette();
  const styles = createStyles(C);

  if (loading) {
    return (
      <View style={styles.wrap}>
        <ActivityIndicator size="small" color={C.black} />
      </View>
    );
  }

  if (!hasMore && itemCount > 0) {
    return (
      <View style={styles.wrap}>
        <ThemedText style={styles.text}>End of list</ThemedText>
      </View>
    );
  }

  return null;
}

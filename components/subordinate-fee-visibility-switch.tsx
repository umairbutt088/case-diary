import { useMemo } from "react";
import { StyleSheet, Switch, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import type { AppColors } from "@/constants/color-palette";
import { useThemePalette } from "@/hooks/use-theme-palette";

type Props = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
};

function createStyles(C: AppColors) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      marginTop: 14,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.borderGray,
      backgroundColor: C.cream50,
    },
    copy: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      fontSize: 15,
      fontWeight: "600",
      color: C.black,
    },
    hint: {
      marginTop: 4,
      fontSize: 12,
      lineHeight: 17,
      color: C.gray50,
    },
  });
}

export function SubordinateFeeVisibilitySwitch({
  value,
  onValueChange,
  disabled = false,
}: Props) {
  const C = useThemePalette();
  const styles = useMemo(() => createStyles(C), [C]);

  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <ThemedText style={styles.title}>Show fees to subordinates</ThemedText>
        <ThemedText style={styles.hint}>
          When off, subordinates cannot see case fees or payment history for this
          case.
        </ThemedText>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: C.grey100, true: C.themeBlack }}
        thumbColor={C.pureWhite}
      />
    </View>
  );
}

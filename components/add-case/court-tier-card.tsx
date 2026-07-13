import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import type { AppColors } from "@/constants/color-palette";
import { useThemePalette } from "@/hooks/use-theme-palette";

type Props = {
  label: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
};

function createCourtTierCardStyles(C: AppColors) {
  return StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
      paddingHorizontal: 16,
      marginBottom: 10,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: C.borderGray,
      backgroundColor: C.pureWhite,
    },
    cardSelected: {
      borderColor: C.themeBlack,
      backgroundColor: C.gray100,
    },
    content: {
      flex: 1,
      marginRight: 12,
    },
    label: {
      fontSize: 16,
      fontWeight: "600",
      marginBottom: 4,
    },
    labelSelected: {
    },
    description: {
      fontSize: 13,
      lineHeight: 18,
    },
  });
}

export function CourtTierCard({
  label,
  description,
  selected,
  onSelect,
}: Props) {
  const C = useThemePalette();
  const styles = useMemo(() => createCourtTierCardStyles(C), [C]);

  return (
    <Pressable
      style={[styles.card, selected && styles.cardSelected]}
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
    >
      <View style={styles.content}>
        <ThemedText type="label" style={[styles.label, selected && styles.labelSelected]}>
          {label}
        </ThemedText>
        <ThemedText
          style={styles.description}
          type="secondary"
        >
          {description}
        </ThemedText>
      </View>
      {selected ? (
        <MaterialIcons name="check-circle" size={24} color={C.textAccent} />
      ) : null}
    </Pressable>
  );
}

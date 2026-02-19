import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { theme } from "@/constants/theme";

type Props = {
  label: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
};

export function CourtTierCard({
  label,
  description,
  selected,
  onSelect,
}: Props) {
  return (
    <Pressable
      style={[styles.card, selected && styles.cardSelected]}
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
    >
      <View style={styles.content}>
        <ThemedText style={[styles.label, selected && styles.labelSelected]}>
          {label}
        </ThemedText>
        <ThemedText
          style={styles.description}
          lightColor={theme.colors.gray50}
          darkColor={theme.colors.gray50}
        >
          {description}
        </ThemedText>
      </View>
      {selected ? (
        <MaterialIcons
          name="check-circle"
          size={24}
          color={theme.colors.themeBlack}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: theme.colors.borderGray,
    backgroundColor: theme.colors.pureWhite,
  },
  cardSelected: {
    borderColor: theme.colors.themeBlack,
    backgroundColor: theme.colors.gray100,
  },
  content: {
    flex: 1,
    marginRight: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.black,
    marginBottom: 4,
  },
  labelSelected: {
    color: theme.colors.themeBlack,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
  },
});

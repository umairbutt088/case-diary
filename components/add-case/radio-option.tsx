import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { theme } from "@/constants/theme";

type Props = {
  label: string;
  selected: boolean;
  onSelect: () => void;
};

export function RadioOption({ label, selected, onSelect }: Props) {
  return (
    <Pressable
      style={styles.row}
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
    >
      <View style={[styles.outer, selected && styles.outerSelected]}>
        {selected ? <View style={styles.inner} /> : null}
      </View>
      <ThemedText style={styles.label}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  outer: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: theme.colors.borderGray,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  outerSelected: {
    borderColor: theme.colors.themeBlack,
  },
  inner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.themeBlack,
  },
  label: {
    fontSize: 16,
    flex: 1,
  },
});

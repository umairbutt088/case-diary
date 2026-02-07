import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { theme } from "@/constants/theme";

export type CalendarCaseItem = {
  id: string;
  title: string;
  subtitle: string;
  date: string; // YYYY-MM-DD
};

type Props = {
  caseItem: CalendarCaseItem;
};

export function CalendarCaseCard({ caseItem }: Props) {
  return (
    <View style={styles.card}>
      <ThemedText style={styles.title}>{caseItem.title}</ThemedText>
      <ThemedText style={styles.subtitle}>{caseItem.subtitle}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.pureWhite,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.themeGray3,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.black,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.gray50,
  },
});

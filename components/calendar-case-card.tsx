import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { theme } from "@/constants/theme";
import { formatCaseDate, isCaseOverdue } from "@/types/case";

export type CalendarCaseItem = {
  id: string;
  title: string;
  subtitle: string;
  date: string; // selected date (YYYY-MM-DD)
  nextHearingDate: string | null;
  updatedAt: string;
};

type Props = {
  caseItem: CalendarCaseItem;
};

export function CalendarCaseCard({ caseItem }: Props) {
  const router = useRouter();
  const isOverdue = isCaseOverdue({
    nextHearingDate: caseItem.nextHearingDate,
    updatedAt: caseItem.updatedAt,
  });

  const openCase = () => {
    router.push(`/case/${caseItem.id}`);
  };

  return (
    <Pressable style={styles.card} onPress={openCase}>
      <View style={styles.titleRow}>
        <ThemedText style={styles.title}>{caseItem.title}</ThemedText>
        {isOverdue ? (
          <View style={styles.overdueBadge}>
            <ThemedText style={styles.overdueBadgeText}>OVERDUE</ThemedText>
          </View>
        ) : null}
      </View>
      <ThemedText style={styles.subtitle}>{caseItem.subtitle}</ThemedText>
      <ThemedText style={[styles.dateText, isOverdue && styles.dateTextOverdue]}>
        Next: {formatCaseDate(caseItem.nextHearingDate)}
      </ThemedText>
    </Pressable>
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
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.gray50,
    marginBottom: 6,
  },
  dateText: {
    fontSize: 13,
    color: theme.colors.gray50,
  },
  dateTextOverdue: {
    color: theme.colors.themeRed,
    fontWeight: "700",
  },
  overdueBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: theme.colors.themeRed + "22",
    borderWidth: 1,
    borderColor: theme.colors.themeRed,
  },
  overdueBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.3,
    color: theme.colors.themeRed,
  },
});

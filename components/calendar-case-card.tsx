import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import type { AppColors } from "@/constants/color-palette";
import { useThemePalette } from "@/hooks/use-theme-palette";
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

function createCalendarCaseCardStyles(C: AppColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: C.pureWhite,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: C.themeGray3,
    },
    title: {
      fontSize: 16,
      fontWeight: "700",
      color: C.black,
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
      color: C.gray50,
      marginBottom: 6,
    },
    dateText: {
      fontSize: 13,
      color: C.gray50,
    },
    dateTextOverdue: {
      color: C.themeRed,
      fontWeight: "700",
    },
    overdueBadge: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: C.themeRed + "22",
      borderWidth: 1,
      borderColor: C.themeRed,
    },
    overdueBadgeText: {
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0.3,
      color: C.themeRed,
    },
  });
}

export function CalendarCaseCard({ caseItem }: Props) {
  const router = useRouter();
  const C = useThemePalette();
  const styles = useMemo(() => createCalendarCaseCardStyles(C), [C]);
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

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
      marginBottom: 6,
    },
    dateText: {
      fontSize: 13,
    },
    dateTextOverdue: {
      color: C.themeRed,
      fontWeight: "700",
    },
    overdueBadge: {
      marginLeft: 8,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: C.themeRed + "22",
      borderWidth: 1,
      borderColor: C.themeRed,
      maxWidth: "100%",
    },
    overdueBadgeText: {
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0.3,
      color: C.themeRed,
    },
    titleTextWrap: {
      flex: 1,
      minWidth: 0,
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
        <View style={styles.titleTextWrap}>
          <ThemedText type="accent" style={styles.title} numberOfLines={1}>
            {caseItem.title}
          </ThemedText>
        </View>
        {isOverdue ? (
          <View style={styles.overdueBadge}>
            <ThemedText type="default" style={styles.overdueBadgeText}>OVERDUE</ThemedText>
          </View>
        ) : null}
      </View>
      <ThemedText type="accent" style={styles.subtitle}>{caseItem.subtitle}</ThemedText>
      <ThemedText type="default" style={[styles.dateText, isOverdue && styles.dateTextOverdue]}>
        Next: {formatCaseDate(caseItem.nextHearingDate)}
      </ThemedText>
    </Pressable>
  );
}

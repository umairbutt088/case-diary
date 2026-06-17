/**
 * Owner overview of fee records across active and disposed cases (not trash).
 */
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { Bounceable } from "@/components/ui/bounceable";
import { ScreenHeader } from "@/components/ui/screen-header";
import type { AppColors } from "@/constants/color-palette";
import { theme } from "@/constants/theme";
import { useAuth } from "@/context/auth-context";
import { useHomeBackNavigation } from "@/hooks/use-home-back-navigation";
import { useOwnerOnlyGuard } from "@/hooks/use-owner-only-guard";
import { useThemePalette } from "@/hooks/use-theme-palette";
import {
  getCaseFeeStatus,
  hasRecordedFee,
  summarizeCaseFees,
  type CaseFeeOverviewItem,
  type CaseFeeStatus,
} from "@/lib/case-fees-overview";
import { formatFeeAmount, getRemainingFee } from "@/lib/case-fees";
import { supabase } from "@/lib/supabase";
import type { CaseRow } from "@/types/case";
import { getCaseDisplayTitle } from "@/types/case";

type FeeFilter = "all" | CaseFeeStatus;

function createStyles(C: AppColors) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: C.background,
    },
    summaryCard: {
      marginHorizontal: 16,
      marginTop: 12,
      marginBottom: 8,
      padding: 16,
      borderRadius: 16,
      backgroundColor: C.pureWhite,
      borderWidth: 1,
      borderColor: C.borderGray,
      ...theme.shadow,
    },
    summaryTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: C.gray50,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      marginBottom: 12,
    },
    summaryGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    summaryStat: {
      flexGrow: 1,
      flexBasis: "30%",
      minWidth: 96,
      padding: 10,
      borderRadius: 12,
      backgroundColor: C.cream50,
      borderWidth: 1,
      borderColor: C.borderGray,
    },
    summaryLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: C.gray50,
      textTransform: "uppercase",
      letterSpacing: 0.3,
    },
    summaryValue: {
      marginTop: 4,
      fontSize: 15,
      fontWeight: "700",
      color: C.black,
    },
    filterRow: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    filterBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: C.borderGray,
      backgroundColor: C.pureWhite,
    },
    filterBtnActive: {
      borderColor: C.themeBlack,
      backgroundColor: C.themeBlack,
    },
    filterBtnText: {
      fontSize: 13,
      fontWeight: "600",
      color: C.black,
    },
    filterBtnTextActive: {
      color: C.pureWhite,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingBottom: 40,
    },
    card: {
      backgroundColor: C.pureWhite,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.borderGray,
      padding: 14,
      marginBottom: 10,
      ...theme.shadow,
    },
    cardTop: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 10,
    },
    cardTitle: {
      flex: 1,
      fontSize: 15,
      fontWeight: "600",
      color: C.black,
    },
    statusPill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: C.grey100,
    },
    statusPillDisposed: {
      backgroundColor: C.zodiacColour + "18",
    },
    statusPillText: {
      fontSize: 10,
      fontWeight: "700",
      color: C.gray50,
      textTransform: "uppercase",
      letterSpacing: 0.3,
    },
    statusPillTextDisposed: {
      color: C.zodiacColour,
    },
    feeRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
      marginTop: 10,
    },
    feeStat: {
      minWidth: 88,
    },
    feeLabel: {
      fontSize: 11,
      color: C.gray50,
      fontWeight: "600",
    },
    feeValue: {
      marginTop: 2,
      fontSize: 14,
      fontWeight: "700",
      color: C.black,
    },
    feeValueRemaining: {
      color: C.themeRed,
    },
    feeValueComplete: {
      color: C.themeGreen,
    },
    noFeeText: {
      marginTop: 8,
      fontSize: 13,
      color: C.gray50,
      fontStyle: "italic",
    },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 32,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: C.themeBlack,
      textAlign: "center",
    },
    emptySubtitle: {
      marginTop: 8,
      fontSize: 14,
      color: C.gray50,
      textAlign: "center",
      lineHeight: 20,
    },
  });
}

const FILTERS: { key: FeeFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "disposed", label: "Disposed" },
];

export default function CaseFeesOverviewScreen() {
  const router = useRouter();
  const { goBack } = useHomeBackNavigation();
  const ownerGuard = useOwnerOnlyGuard();
  const { session, effectiveOwnerId } = useAuth();
  const C = useThemePalette();
  const styles = useMemo(() => createStyles(C), [C]);

  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState<CaseFeeOverviewItem[]>([]);
  const [filter, setFilter] = useState<FeeFilter>("all");

  const fetchCases = useCallback(async () => {
    if (!session?.user?.id || !effectiveOwnerId) {
      setCases([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("cases")
      .select("*")
      .eq("user_id", effectiveOwnerId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false });

    setLoading(false);
    if (error) {
      setCases([]);
      return;
    }

    const rows = ((data as CaseRow[]) ?? []).map((row) => ({
      ...row,
      feeStatus: getCaseFeeStatus(row),
    }));
    setCases(rows);
  }, [effectiveOwnerId, session?.user?.id]);

  useFocusEffect(
    useCallback(() => {
      void fetchCases();
    }, [fetchCases]),
  );

  const filteredCases = useMemo(() => {
    if (filter === "all") return cases;
    return cases.filter((row) => row.feeStatus === filter);
  }, [cases, filter]);

  const summary = useMemo(
    () => summarizeCaseFees(filteredCases),
    [filteredCases],
  );

  const renderCase = ({ item }: { item: CaseFeeOverviewItem }) => {
    const title = getCaseDisplayTitle(item);
    const remaining = getRemainingFee(item.total_fee, item.fee_received);
    const hasFees = hasRecordedFee(item);
    const isDisposed = item.feeStatus === "disposed";

    return (
      <Bounceable
        style={styles.card}
        onPress={() => router.push(`/case/${item.id}`)}
        accessibilityLabel={`${title}, fee record`}
      >
        <View style={styles.cardTop}>
          <ThemedText style={styles.cardTitle} numberOfLines={2}>
            {title}
          </ThemedText>
          <View
            style={[styles.statusPill, isDisposed && styles.statusPillDisposed]}
          >
            <ThemedText
              style={[
                styles.statusPillText,
                isDisposed && styles.statusPillTextDisposed,
              ]}
            >
              {isDisposed ? "Disposed" : "Active"}
            </ThemedText>
          </View>
        </View>

        {hasFees ? (
          <View style={styles.feeRow}>
            <View style={styles.feeStat}>
              <ThemedText style={styles.feeLabel}>Total</ThemedText>
              <ThemedText style={styles.feeValue}>
                {formatFeeAmount(item.total_fee)}
              </ThemedText>
            </View>
            <View style={styles.feeStat}>
              <ThemedText style={styles.feeLabel}>Received</ThemedText>
              <ThemedText style={styles.feeValue}>
                {formatFeeAmount(item.fee_received)}
              </ThemedText>
            </View>
            <View style={styles.feeStat}>
              <ThemedText style={styles.feeLabel}>Remaining</ThemedText>
              <ThemedText
                style={[
                  styles.feeValue,
                  remaining != null && remaining > 0
                    ? styles.feeValueRemaining
                    : remaining === 0
                      ? styles.feeValueComplete
                      : null,
                ]}
              >
                {formatFeeAmount(remaining)}
              </ThemedText>
            </View>
          </View>
        ) : (
          <ThemedText style={styles.noFeeText}>No fee recorded yet</ThemedText>
        )}
      </Bounceable>
    );
  };

  if (ownerGuard.blocked) return null;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScreenHeader title="Case fees" onBack={goBack} />

      <View style={styles.summaryCard}>
        <ThemedText style={styles.summaryTitle}>Fee summary</ThemedText>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryStat}>
            <ThemedText style={styles.summaryLabel}>Cases</ThemedText>
            <ThemedText style={styles.summaryValue}>{summary.caseCount}</ThemedText>
          </View>
          <View style={styles.summaryStat}>
            <ThemedText style={styles.summaryLabel}>With fees</ThemedText>
            <ThemedText style={styles.summaryValue}>
              {summary.casesWithFees}
            </ThemedText>
          </View>
          <View style={styles.summaryStat}>
            <ThemedText style={styles.summaryLabel}>Billed</ThemedText>
            <ThemedText style={styles.summaryValue}>
              {formatFeeAmount(summary.totalBilled)}
            </ThemedText>
          </View>
          <View style={styles.summaryStat}>
            <ThemedText style={styles.summaryLabel}>Received</ThemedText>
            <ThemedText style={styles.summaryValue}>
              {formatFeeAmount(summary.totalReceived)}
            </ThemedText>
          </View>
          <View style={styles.summaryStat}>
            <ThemedText style={styles.summaryLabel}>Remaining</ThemedText>
            <ThemedText style={styles.summaryValue}>
              {formatFeeAmount(summary.totalRemaining)}
            </ThemedText>
          </View>
        </View>
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((item) => {
          const active = filter === item.key;
          return (
            <Pressable
              key={item.key}
              style={[styles.filterBtn, active && styles.filterBtnActive]}
              onPress={() => setFilter(item.key)}
            >
              <ThemedText
                style={[styles.filterBtnText, active && styles.filterBtnTextActive]}
              >
                {item.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={C.black} />
        </View>
      ) : filteredCases.length === 0 ? (
        <View style={styles.centered}>
          <MaterialIcons name="payments" size={40} color={C.gray50} />
          <ThemedText style={styles.emptyTitle}>No cases found</ThemedText>
          <ThemedText style={styles.emptySubtitle}>
            Active and disposed cases with fee records appear here.
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={filteredCases}
          keyExtractor={(item) => item.id}
          renderItem={renderCase}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

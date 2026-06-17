import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CaseFeePaymentListItem } from "@/components/case-fee-payment-list-item";
import { ThemedText } from "@/components/themed-text";
import { ScreenHeader } from "@/components/ui/screen-header";
import type { AppColors } from "@/constants/color-palette";
import { theme } from "@/constants/theme";
import { useAuth } from "@/context/auth-context";
import { useAccessGuard } from "@/hooks/use-access-guard";
import { useThemePalette } from "@/hooks/use-theme-palette";
import { formatFeeAmount, getRemainingFee } from "@/lib/case-fees";
import { getCaseFeePayments } from "@/lib/case-fee-payments";
import { supabase } from "@/lib/supabase";
import { formatCaseDate, getCaseDisplayTitle, type CaseRow } from "@/types/case";
import type { CaseFeePaymentRow } from "@/types/case-fee-payment";

const PAYMENTS_PAGE_SIZE = 20;

function createFeePaymentsStyles(C: AppColors) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: C.background,
    },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    content: {
      padding: 20,
      paddingBottom: 40,
    },
    caseTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: C.black,
      marginBottom: 8,
    },
    summaryRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 16,
    },
    summaryPill: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: C.grey100,
    },
    summaryPillText: {
      fontSize: 12,
      fontWeight: "600",
      color: C.gray50,
    },
    emptyText: {
      fontSize: 15,
      color: C.gray50,
    },
    errorText: {
      marginBottom: 10,
      color: C.themeRed,
      fontSize: 14,
    },
    loadingMoreWrap: {
      marginTop: 8,
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    loadingMoreText: {
      fontSize: 13,
      color: C.gray50,
    },
    cardShadow: {
      ...theme.shadow,
    },
  });
}

export default function CaseFeePaymentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, effectiveOwnerId } = useAuth();
  const accessGuard = useAccessGuard("view_cases");
  const C = useThemePalette();
  const styles = useMemo(() => createFeePaymentsStyles(C), [C]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("Payment history");
  const [caseData, setCaseData] = useState<CaseRow | null>(null);
  const [payments, setPayments] = useState<CaseFeePaymentRow[]>([]);
  const [hasMore, setHasMore] = useState(false);

  const loadPayments = useCallback(
    async ({ reset, offset = 0 }: { reset: boolean; offset?: number }) => {
      if (!id || !session?.user?.id || !effectiveOwnerId) {
        setLoading(false);
        setError("Invalid case.");
        return;
      }

      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      try {
        const pageOffset = reset ? 0 : Math.max(0, offset);
        const chunk = await getCaseFeePayments(id, effectiveOwnerId, {
          limit: PAYMENTS_PAGE_SIZE,
          offset: pageOffset,
        });

        if (reset) {
          setPayments(chunk);
        } else {
          setPayments((prev) => {
            const existingIds = new Set(prev.map((entry) => entry.id));
            const nextEntries = chunk.filter((entry) => !existingIds.has(entry.id));
            return [...prev, ...nextEntries];
          });
        }

        setHasMore(chunk.length === PAYMENTS_PAGE_SIZE);
      } catch {
        setError("Failed to load payment history.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [id, session?.user?.id, effectiveOwnerId],
  );

  useEffect(() => {
    if (!id || !session?.user?.id || !effectiveOwnerId) {
      setLoading(false);
      setError("Invalid case.");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.from("cases").select("*").eq("id", id).single();
        if (cancelled) return;
        if (data) {
          const row = data as CaseRow;
          setCaseData(row);
          setTitle(getCaseDisplayTitle(row));
        }
        await loadPayments({ reset: true, offset: 0 });
      } catch {
        if (cancelled) return;
        setError("Failed to load payment history.");
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, session?.user?.id, effectiveOwnerId, loadPayments]);

  if (accessGuard.blocked) {
    return null;
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ScreenHeader title="Payment history" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={C.black} />
        </View>
      </SafeAreaView>
    );
  }

  const remaining = caseData
    ? getRemainingFee(caseData.total_fee, caseData.fee_received)
    : null;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScreenHeader title="Payment history" />
      <FlatList
        data={payments}
        keyExtractor={(payment) => payment.id}
        style={{ backgroundColor: C.background }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onEndReachedThreshold={0.35}
        onEndReached={() => {
          if (!hasMore || loadingMore || loading) return;
          void loadPayments({ reset: false, offset: payments.length });
        }}
        ListHeaderComponent={
          <>
            <ThemedText style={styles.caseTitle}>{title}</ThemedText>
            {caseData ? (
              <View style={styles.summaryRow}>
                <View style={styles.summaryPill}>
                  <ThemedText style={styles.summaryPillText}>
                    Total {formatFeeAmount(caseData.total_fee)}
                  </ThemedText>
                </View>
                <View style={styles.summaryPill}>
                  <ThemedText style={styles.summaryPillText}>
                    Received {formatFeeAmount(caseData.fee_received)}
                  </ThemedText>
                </View>
                <View style={styles.summaryPill}>
                  <ThemedText style={styles.summaryPillText}>
                    Remaining {formatFeeAmount(remaining)}
                  </ThemedText>
                </View>
              </View>
            ) : null}
            {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
          </>
        }
        ListEmptyComponent={
          <ThemedText style={styles.emptyText}>No payments recorded yet.</ThemedText>
        }
        renderItem={({ item }) => (
          <View style={styles.cardShadow}>
            <CaseFeePaymentListItem payment={item} C={C} variant="card" />
          </View>
        )}
        ListFooterComponent={
          hasMore ? (
            <View style={styles.loadingMoreWrap}>
              {loadingMore ? (
                <ActivityIndicator size="small" color={C.black} />
              ) : (
                <ThemedText style={styles.loadingMoreText}>
                  Scroll for more payments
                </ThemedText>
              )}
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

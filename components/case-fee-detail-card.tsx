import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, View } from "react-native";

import { CaseFeeSummary } from "@/components/add-case/case-fee-fields";
import { CaseFeePaymentListItem } from "@/components/case-fee-payment-list-item";
import { CaseFeePaymentModal } from "@/components/case-fee-payment-modal";
import { ThemedText } from "@/components/themed-text";
import { Bounceable } from "@/components/ui/bounceable";
import type { AppColors } from "@/constants/color-palette";
import { theme } from "@/constants/theme";
import { useThemePalette } from "@/hooks/use-theme-palette";
import { toFeeNumber } from "@/lib/case-fees";
import {
  getCaseFeePayments,
  recordCaseFeePayment,
} from "@/lib/case-fee-payments";
import type { CaseFeePaymentRow } from "@/types/case-fee-payment";

const PREVIEW_LIMIT = 2;

type Props = {
  caseId: string;
  userId: string;
  totalFee: number | string | null | undefined;
  feeReceived: number | string | null | undefined;
  canRecord: boolean;
  isOnline: boolean;
  onFeeUpdated: (feeReceived: number) => void;
};

function createStyles(C: AppColors) {
  return StyleSheet.create({
    wrap: {
      marginBottom: 20,
    },
    recordBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 12,
      marginBottom: 4,
      paddingVertical: 12,
      borderRadius: 10,
      backgroundColor: C.cream50,
      borderWidth: 1,
      borderColor: C.borderGray,
    },
    recordBtnText: {
      fontSize: 15,
      fontWeight: "600",
    },
    historyCard: {
      marginTop: 12,
      marginBottom: 4,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: C.borderGray,
      backgroundColor: C.pureWhite,
      padding: 20,
      ...theme.shadow,
    },
    historyTitle: {
      fontSize: 13,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 12,
    },
    emptyText: {
      fontSize: 13,
      lineHeight: 18,
    },
    loading: {
      paddingVertical: 8,
      alignItems: "center",
    },
    seeAllBtn: {
      marginTop: 8,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: C.borderGray,
    },
    seeAllBtnText: {
      fontSize: 14,
      fontWeight: "600",
    },
  });
}

export function CaseFeeDetailCard({
  caseId,
  userId,
  totalFee,
  feeReceived,
  canRecord,
  isOnline,
  onFeeUpdated,
}: Props) {
  const router = useRouter();
  const C = useThemePalette();
  const styles = useMemo(() => createStyles(C), [C]);
  const [payments, setPayments] = useState<CaseFeePaymentRow[]>([]);
  const [hasMorePayments, setHasMorePayments] = useState(false);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const loadPayments = useCallback(async () => {
    if (!caseId || !userId) {
      setPayments([]);
      setHasMorePayments(false);
      setLoadingPayments(false);
      return;
    }
    setLoadingPayments(true);
    const rows = await getCaseFeePayments(caseId, userId, {
      limit: PREVIEW_LIMIT + 1,
    });
    setHasMorePayments(rows.length > PREVIEW_LIMIT);
    setPayments(rows.slice(0, PREVIEW_LIMIT));
    setLoadingPayments(false);
  }, [caseId, userId]);

  useEffect(() => {
    void loadPayments();
  }, [loadPayments]);

  const handleOpenPayment = useCallback(() => {
    if (!canRecord) return;
    if (!isOnline) {
      Alert.alert(
        "Offline",
        "Recording fee payments requires an internet connection.",
      );
      return;
    }
    setPaymentError(null);
    setShowPaymentModal(true);
  }, [canRecord, isOnline]);

  const handleSavePayment = useCallback(
    async (amount: number, paymentDate: string, note: string) => {
      setSavingPayment(true);
      setPaymentError(null);
      const result = await recordCaseFeePayment({
        caseId,
        userId,
        amount,
        paymentDate,
        note,
        currentTotalFee: totalFee,
        currentFeeReceived: feeReceived,
      });
      setSavingPayment(false);

      if (!result.ok) {
        setPaymentError(result.message);
        Alert.alert("Could not save payment", result.message);
        return false;
      }

      onFeeUpdated(result.feeReceived);
      await loadPayments();
      setShowPaymentModal(false);
      return true;
    },
    [caseId, feeReceived, loadPayments, onFeeUpdated, totalFee, userId],
  );

  const hasTotalFee = toFeeNumber(totalFee) != null;

  return (
    <View style={styles.wrap}>
      <CaseFeeSummary totalFee={totalFee} feeReceived={feeReceived} />

      {canRecord ? (
        <Bounceable style={styles.recordBtn} onPress={handleOpenPayment}>
          <MaterialIcons name="add-circle-outline" size={20} color={C.textPrimary} />
          <ThemedText style={styles.recordBtnText}>Record fee payment</ThemedText>
        </Bounceable>
      ) : null}

      <View style={styles.historyCard}>
        <ThemedText type="accent" style={styles.historyTitle}>Payment history</ThemedText>
        {loadingPayments ? (
          <View style={styles.loading}>
            <ActivityIndicator size="small" color={C.textPrimary} />
          </View>
        ) : payments.length === 0 ? (
          <ThemedText type="muted" style={styles.emptyText}>
            {hasTotalFee
              ? "No payments recorded yet. Tap Record fee payment when the client pays."
              : "Set a total case fee in Edit case, then record payments here during trial."}
          </ThemedText>
        ) : (
          payments.map((payment, index) => (
            <CaseFeePaymentListItem
              key={payment.id}
              payment={payment}
              C={C}
              variant="list"
              isLast={index === payments.length - 1 && !hasMorePayments}
            />
          ))
        )}

        {hasMorePayments ? (
          <Bounceable
            style={styles.seeAllBtn}
            onPress={() => router.push(`/case/${caseId}/fee-payments`)}
          >
            <ThemedText style={styles.seeAllBtnText}>See all payments</ThemedText>
            <MaterialIcons name="chevron-right" size={18} color={C.textPrimary} />
          </Bounceable>
        ) : null}
      </View>

      <CaseFeePaymentModal
        visible={showPaymentModal}
        onClose={() => {
          if (!savingPayment) setShowPaymentModal(false);
        }}
        onSave={handleSavePayment}
        saving={savingPayment}
      />

      {paymentError && !showPaymentModal ? (
        <ThemedText type="muted" style={[styles.emptyText, { marginHorizontal: 16 }]}>
          {paymentError}
        </ThemedText>
      ) : null}
    </View>
  );
}

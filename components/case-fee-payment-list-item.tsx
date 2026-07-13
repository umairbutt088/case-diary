import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import type { AppColors } from "@/constants/color-palette";
import { theme } from "@/constants/theme";
import { formatFeeAmount } from "@/lib/case-fees";
import { formatCaseDate } from "@/types/case";
import type { CaseFeePaymentRow } from "@/types/case-fee-payment";

type Props = {
  payment: CaseFeePaymentRow;
  C: AppColors;
  variant?: "compact" | "card" | "list";
  isLast?: boolean;
};

export function CaseFeePaymentListItem({
  payment,
  C,
  variant = "compact",
  isLast = false,
}: Props) {
  const styles =
    variant === "card"
      ? createCardStyles(C)
      : variant === "list"
        ? createListStyles(C, isLast)
        : createCompactStyles(C);

  return (
    <View style={styles.paymentItem}>
      <View style={styles.paymentTop}>
        <ThemedText type="success" style={styles.paymentAmount}>
          {formatFeeAmount(payment.amount)}
        </ThemedText>
        <ThemedText type="default" style={styles.paymentDate}>
          {formatCaseDate(payment.payment_date)}
        </ThemedText>
      </View>
      {payment.note?.trim() ? (
        <ThemedText type="muted" style={styles.paymentNote}>{payment.note.trim()}</ThemedText>
      ) : null}
    </View>
  );
}

function createListStyles(C: AppColors, isLast: boolean) {
  return StyleSheet.create({
    paymentItem: {
      paddingVertical: 12,
      borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
      borderBottomColor: C.borderGray,
    },
    paymentTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 8,
    },
    paymentAmount: {
      fontSize: 15,
      fontWeight: "700",
    },
    paymentDate: {
      fontSize: 12,
    },
    paymentNote: {
      fontSize: 13,
      marginTop: 4,
      lineHeight: 18,
    },
  });
}

function createCompactStyles(C: AppColors) {
  return StyleSheet.create({
    paymentItem: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: C.grey100,
      backgroundColor: C.background,
      paddingHorizontal: 12,
      paddingVertical: 10,
      ...theme.shadow,
    },
    paymentTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 8,
    },
    paymentAmount: {
      fontSize: 15,
      fontWeight: "700",
    },
    paymentDate: {
      fontSize: 12,
    },
    paymentNote: {
      fontSize: 13,
      marginTop: 4,
      lineHeight: 18,
    },
  });
}

function createCardStyles(C: AppColors) {
  return StyleSheet.create({
    paymentItem: {
      borderRadius: 12,
      backgroundColor: C.pureWhite,
      padding: 14,
      marginBottom: 12,
    },
    paymentTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 8,
      marginBottom: 4,
    },
    paymentAmount: {
      fontSize: 17,
      fontWeight: "700",
    },
    paymentDate: {
      fontSize: 13,
    },
    paymentNote: {
      fontSize: 14,
      lineHeight: 20,
    },
  });
}

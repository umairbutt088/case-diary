import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useMemo } from "react";
import { StyleSheet, TextInput, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import type { AppColors } from "@/constants/color-palette";
import { theme } from "@/constants/theme";
import { useAppTheme } from "@/context/app-theme-context";
import { useThemePalette } from "@/hooks/use-theme-palette";
import {
  formatFeeAmount,
  getRemainingFee,
  parseFeeInput,
  toFeeNumber,
} from "@/lib/case-fees";

type EditableProps = {
  mode?: "edit";
  totalFee: string;
  feeReceived: string;
  onTotalFeeChange: (value: string) => void;
  onFeeReceivedChange: (value: string) => void;
  totalFeeError?: string | null;
  feeReceivedError?: string | null;
  receivedLabel?: string;
};

type ReadOnlyProps = {
  mode: "readOnly";
  totalFee: number | string | null | undefined;
  feeReceived: number | string | null | undefined;
  hint?: string;
};

type Props = EditableProps | ReadOnlyProps;

function getFeeProgress(
  total: number | null,
  received: number | null,
): number {
  if (total == null || total <= 0) return 0;
  const paid = received ?? 0;
  return Math.min(100, Math.round((paid / total) * 100));
}

function createCaseFeeStyles(C: AppColors, onPrimary: string) {
  return StyleSheet.create({
    card: {
      marginBottom: 20,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: C.borderGray,
      backgroundColor: C.pureWhite,
      ...theme.shadow,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.grey100,
      backgroundColor: C.cream50,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
    },
    headerIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: C.themeBlack,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: "700",
    },
    headerSubtitle: {
      fontSize: 12,
      marginTop: 2,
    },
    body: {
      padding: 16,
      gap: 14,
    },
    inputRow: {
      flexDirection: "row",
      gap: 10,
    },
    inputCol: {
      flex: 1,
    },
    fieldLabelWrap: {
      minHeight: 32,
      marginBottom: 6,
      justifyContent: "flex-end",
    },
    fieldLabel: {
      fontSize: 12,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.4,
      lineHeight: 16,
    },
    inputBox: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: C.themeGray3,
      borderRadius: 12,
      backgroundColor: C.background,
      paddingHorizontal: 12,
      minHeight: 48,
    },
    inputBoxError: {
      borderColor: C.themeRed,
    },
    currencyPrefix: {
      fontSize: 14,
      fontWeight: "700",
      marginRight: 6,
    },
    input: {
      flex: 1,
      fontSize: 17,
      fontWeight: "600",
      paddingVertical: 10,
    },
    readOnlyValue: {
      fontSize: 17,
      fontWeight: "700",
      paddingVertical: 10,
      flex: 1,
    },
    errorText: {
      fontSize: 12,
      color: C.themeRed,
      marginTop: 4,
    },
    progressBlock: {
      gap: 8,
    },
    progressLabels: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    progressLabel: {
      fontSize: 13,
      fontWeight: "600",
    },
    progressPercent: {
      fontSize: 13,
      fontWeight: "700",
    },
    progressTrack: {
      height: 8,
      borderRadius: 999,
      backgroundColor: C.grey100,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      borderRadius: 999,
      backgroundColor: C.themeBlack,
    },
    progressFillComplete: {
      backgroundColor: C.themeGreen,
    },
    remainingCard: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderRadius: 12,
      backgroundColor: C.themeBlack,
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    remainingLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: onPrimary,
      opacity: 0.85,
    },
    remainingAmount: {
      fontSize: 20,
      fontWeight: "800",
      color: onPrimary,
      letterSpacing: -0.3,
    },
    hint: {
      fontSize: 12,
      lineHeight: 17,
      paddingHorizontal: 16,
      paddingBottom: 14,
    },
    statPill: {
      alignSelf: "flex-start",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: C.grey100,
    },
    statPillText: {
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.3,
    },
  });
}

function FeeInputField({
  label,
  value,
  onChangeText,
  error,
  readOnly,
  displayValue,
}: {
  label: string;
  value?: string;
  onChangeText?: (v: string) => void;
  error?: string | null;
  readOnly?: boolean;
  displayValue?: string;
}) {
  const C = useThemePalette();
  const { isDark } = useAppTheme();
  const onPrimary = C.textInverse;
  const styles = useMemo(
    () => createCaseFeeStyles(C, onPrimary),
    [C, onPrimary],
  );

  return (
    <View style={styles.inputCol}>
      <View style={styles.fieldLabelWrap}>
        <ThemedText type="label" style={styles.fieldLabel}>{label}</ThemedText>
      </View>
      <View style={[styles.inputBox, error ? styles.inputBoxError : null]}>
        <ThemedText type="default" style={styles.currencyPrefix}>Rs</ThemedText>
        {readOnly ? (
          <ThemedText type="defaultSemiBold" style={styles.readOnlyValue} numberOfLines={1}>
            {displayValue ?? "—"}
          </ThemedText>
        ) : (
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={onChangeText}
            placeholder="0"
            placeholderTextColor={C.textMuted}
            keyboardType="number-pad"
          />
        )}
      </View>
      {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
    </View>
  );
}

export function CaseFeeFields(props: Props) {
  const C = useThemePalette();
  const { isDark } = useAppTheme();
  const onPrimary = C.textInverse;
  const styles = useMemo(
    () => createCaseFeeStyles(C, onPrimary),
    [C, onPrimary],
  );

  const isReadOnly = props.mode === "readOnly";

  const totalNum = useMemo(() => {
    if (isReadOnly) return toFeeNumber(props.totalFee);
    return parseFeeInput(props.totalFee);
  }, [isReadOnly, props]);

  const receivedNum = useMemo(() => {
    if (isReadOnly) return toFeeNumber(props.feeReceived);
    return parseFeeInput(props.feeReceived);
  }, [isReadOnly, props]);

  const remaining = useMemo(
    () => getRemainingFee(totalNum, receivedNum),
    [totalNum, receivedNum],
  );

  const progress = useMemo(
    () => getFeeProgress(totalNum, receivedNum),
    [totalNum, receivedNum],
  );

  const isFullyPaid = totalNum != null && totalNum > 0 && (remaining ?? 0) === 0;

  const receivedLabel = isReadOnly
    ? "Received"
    : (props.receivedLabel ?? "Advance received");

  const formatInputDisplay = (amount: number | null) => {
    if (amount == null) return "—";
    return amount.toLocaleString("en-PK", {
      maximumFractionDigits: 2,
    });
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerIconWrap}>
          <MaterialIcons name="payments" size={20} color={onPrimary} />
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText type="accent" style={styles.headerTitle}>Case fees</ThemedText>
          <ThemedText type="accent" style={styles.headerSubtitle}>
            {isReadOnly
              ? "Fee collection overview"
              : "Track agreed fee and advance received"}
          </ThemedText>
        </View>
        {isFullyPaid ? (
          <View style={styles.statPill}>
            <ThemedText type="default" style={styles.statPillText}>Paid in full</ThemedText>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <View style={styles.inputRow}>
          <FeeInputField
            label="Total fee"
            value={isReadOnly ? undefined : props.totalFee}
            onChangeText={isReadOnly ? undefined : props.onTotalFeeChange}
            error={isReadOnly ? undefined : props.totalFeeError}
            readOnly={isReadOnly}
            displayValue={formatInputDisplay(totalNum)}
          />
          <FeeInputField
            label={receivedLabel}
            value={isReadOnly ? undefined : props.feeReceived}
            onChangeText={isReadOnly ? undefined : props.onFeeReceivedChange}
            error={isReadOnly ? undefined : props.feeReceivedError}
            readOnly={isReadOnly}
            displayValue={formatInputDisplay(receivedNum)}
          />
        </View>

        {totalNum != null && totalNum > 0 ? (
          <View style={styles.progressBlock}>
            <View style={styles.progressLabels}>
              <ThemedText type="label" style={styles.progressLabel}>Collected</ThemedText>
              <ThemedText type="default" style={styles.progressPercent}>{progress}%</ThemedText>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  isFullyPaid && styles.progressFillComplete,
                  { width: `${progress}%` },
                ]}
              />
            </View>
          </View>
        ) : null}

        <View style={styles.remainingCard}>
          <ThemedText type="label" style={styles.remainingLabel}>Remaining</ThemedText>
          <ThemedText type="default" style={styles.remainingAmount}>
            {formatFeeAmount(remaining)}
          </ThemedText>
        </View>
      </View>

      {isReadOnly && props.hint ? (
        <ThemedText type="muted" style={styles.hint}>{props.hint}</ThemedText>
      ) : null}
    </View>
  );
}

/** Read-only fee summary for case detail screens. */
export function CaseFeeSummary({
  totalFee,
  feeReceived,
  hint,
}: Omit<ReadOnlyProps, "mode">) {
  return (
    <CaseFeeFields
      mode="readOnly"
      totalFee={totalFee}
      feeReceived={feeReceived}
      hint={hint}
    />
  );
}

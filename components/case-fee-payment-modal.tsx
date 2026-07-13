import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { SafeAreaView } from "react-native-safe-area-context";

import { DateField } from "@/components/add-case/date-field";
import { FormFieldWithHint } from "@/components/add-case/form-field-with-hint";
import { ThemedText } from "@/components/themed-text";
import {
  type AppColors,
  modalSheetBackground,
} from "@/constants/color-palette";
import { useAppTheme } from "@/context/app-theme-context";
import { useThemePalette } from "@/hooks/use-theme-palette";
import { parseFeeInput } from "@/lib/case-fees";
import { getTodayISO } from "@/types/case";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSave: (amount: number, paymentDate: string, note: string) => Promise<boolean>;
  saving?: boolean;
};

function createStyles(C: AppColors, onPrimary: string, modalSheet: string) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: "flex-end",
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.4)",
    },
    sheet: {
      backgroundColor: modalSheet,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      maxHeight: "92%",
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: C.grey100,
    },
    title: {
      fontSize: 18,
      fontWeight: "700",
    },
    cancel: {
      fontSize: 16,
      color: C.btnBlue,
      fontWeight: "500",
    },
    scroll: {
      maxHeight: 520,
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 40,
      flexGrow: 1,
    },
    errorText: {
      fontSize: 14,
      marginTop: 8,
    },
    saveBtn: {
      backgroundColor: C.themeBlack,
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: "center",
      marginTop: 24,
    },
    saveBtnText: {
      fontSize: 16,
      fontWeight: "600",
      color: onPrimary,
    },
  });
}

export function CaseFeePaymentModal({
  visible,
  onClose,
  onSave,
  saving = false,
}: Props) {
  const C = useThemePalette();
  const { isDark } = useAppTheme();
  const onPrimary = C.textInverse;
  const modalSheet = modalSheetBackground(C, isDark);
  const styles = useMemo(
    () => createStyles(C, onPrimary, modalSheet),
    [C, onPrimary, modalSheet],
  );
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(getTodayISO());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setAmount("");
      setPaymentDate(getTodayISO());
      setNote("");
      setError(null);
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    if (saving) return;
    Keyboard.dismiss();
    onClose();
  }, [onClose, saving]);

  const handleSave = useCallback(async () => {
    const parsed = parseFeeInput(amount);
    if (parsed == null || parsed <= 0) {
      setError("Enter a valid amount greater than zero.");
      return;
    }
    if (!paymentDate.trim()) {
      setError("Payment date is required.");
      return;
    }
    setError(null);
    Keyboard.dismiss();
    await onSave(parsed, paymentDate.trim(), note.trim());
  }, [amount, note, onSave, paymentDate]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <SafeAreaView style={styles.overlay} edges={["top", "bottom"]}>
          <Pressable style={styles.backdrop} onPress={handleClose} />
          <View style={styles.sheet}>
            <View style={styles.header}>
              <ThemedText type="accent" style={styles.title}>
                Record fee payment
              </ThemedText>
              <Pressable onPress={handleClose} hitSlop={12} disabled={saving}>
                <ThemedText type="default" style={styles.cancel}>
                  Cancel
                </ThemedText>
              </Pressable>
            </View>
            <KeyboardAwareScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              enableOnAndroid
              extraScrollHeight={24}
              enableAutomaticScroll
              keyboardOpeningTime={0}
            >
              <FormFieldWithHint
                label="Amount received"
                required
                value={amount}
                onChangeText={(v) => {
                  setAmount(v);
                  setError(null);
                }}
                placeholder="e.g. 5000"
                keyboardType="number-pad"
              />
              <DateField
                label="Payment date"
                value={paymentDate}
                onChange={setPaymentDate}
                placeholder="e.g. 08/09/2025"
              />
              <FormFieldWithHint
                label="Note (optional)"
                value={note}
                onChangeText={setNote}
                placeholder="e.g. After hearing on 12 March"
                multiline
                numberOfLines={3}
              />
              {error ? (
                <ThemedText type="danger" style={styles.errorText}>{error}</ThemedText>
              ) : null}
              <Pressable
                style={styles.saveBtn}
                onPress={() => void handleSave()}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={onPrimary} />
                ) : (
                  <ThemedText style={styles.saveBtnText}>Save payment</ThemedText>
                )}
              </Pressable>
            </KeyboardAwareScrollView>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

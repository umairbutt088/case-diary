import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DateField } from "@/components/add-case/date-field";
import { ThemedText } from "@/components/themed-text";
import {
  type AppColors,
  modalSheetBackground,
} from "@/constants/color-palette";
import { useAppTheme } from "@/context/app-theme-context";
import { useThemePalette } from "@/hooks/use-theme-palette";
import { getTodayISO } from "@/types/case";

export type DisposeCaseFormValues = {
  disposedDate: string;
  note: string;
};

type Props = {
  visible: boolean;
  saving?: boolean;
  onSave: (values: DisposeCaseFormValues) => void;
  onCancel: () => void;
};

function createStyles(C: AppColors, onPrimary: string, modalSheet: string) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: "flex-end",
    },
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.4)",
    },
    sheetSafeArea: {
      backgroundColor: modalSheet,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
    },
    sheet: {
      padding: 20,
      paddingBottom: 24,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    title: {
      fontSize: 18,
      fontWeight: "700",
    },
    cancelText: {
      fontSize: 16,
      color: C.btnBlue,
      fontWeight: "500",
    },
    hint: {
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 16,
    },
    label: {
      fontSize: 13,
      fontWeight: "600",
      marginBottom: 6,
    },
    input: {
      color: C.textPrimary,
      borderWidth: 1,
      borderColor: C.borderGray,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      backgroundColor: C.background,
      marginBottom: 14,
    },
    noteInput: {
      minHeight: 72,
      textAlignVertical: "top",
    },
    saveBtn: {
      backgroundColor: C.themeBlack,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 4,
    },
    saveBtnText: {
      fontSize: 16,
      fontWeight: "600",
      color: onPrimary,
    },
  });
}

export function DisposeCaseModal({
  visible,
  saving = false,
  onSave,
  onCancel,
}: Props) {
  const C = useThemePalette();
  const { isDark } = useAppTheme();
  const onPrimary = C.textInverse;
  const modalSheet = modalSheetBackground(C, isDark);
  const styles = useMemo(
    () => createStyles(C, onPrimary, modalSheet),
    [C, onPrimary, modalSheet],
  );

  const [disposedDate, setDisposedDate] = useState(getTodayISO());
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!visible) return;
    setDisposedDate(getTodayISO());
    setNote("");
  }, [visible]);

  const handleCancel = useCallback(() => {
    Keyboard.dismiss();
    onCancel();
  }, [onCancel]);

  const handleSave = useCallback(() => {
    onSave({ disposedDate, note: note.trim() });
  }, [disposedDate, note, onSave]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Pressable style={styles.backdrop} onPress={handleCancel} />
        <SafeAreaView style={styles.sheetSafeArea} edges={["bottom"]}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sheet}
          >
            <View style={styles.header}>
              <ThemedText type="accent" style={styles.title}>Dispose case</ThemedText>
              <Pressable onPress={handleCancel} hitSlop={12} disabled={saving}>
                <ThemedText type="default" style={styles.cancelText}>Cancel</ThemedText>
              </Pressable>
            </View>

            <ThemedText type="muted" style={styles.hint}>
              The case will be removed from your active diary and cause lists. You
              can find it under Disposed cases in Settings.
            </ThemedText>

            <DateField
              label="Date of disposal"
              value={disposedDate}
              onChange={setDisposedDate}
            />

            <ThemedText type="label" style={styles.label}>Note (optional)</ThemedText>
            <TextInput
              style={[styles.input, styles.noteInput]}
              value={note}
              onChangeText={setNote}
              placeholder="e.g. Decree passed, compromise, dismissed"
              placeholderTextColor={C.textMuted}
              multiline
              editable={!saving}
            />

            <Pressable style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color={onPrimary} />
              ) : (
                <ThemedText style={styles.saveBtnText}>Mark as disposed</ThemedText>
              )}
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

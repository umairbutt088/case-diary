import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { FormFieldWithHint } from "@/components/add-case/form-field-with-hint";
import { ThemedText } from "@/components/themed-text";
import {
  type AppColors,
  modalSheetBackground,
} from "@/constants/color-palette";
import { useAppTheme } from "@/context/app-theme-context";
import { useThemePalette } from "@/hooks/use-theme-palette";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSave: (value: string) => void;
  title?: string;
  fieldLabel?: string;
  placeholder?: string;
  emptyError?: string;
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
    body: {
      padding: 20,
      paddingBottom: 32,
    },
    errorText: {
      fontSize: 14,
      color: C.themeRed,
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

export function AddOtherCaseTypeModal({
  visible,
  onClose,
  onSave,
  title = "Add case type",
  fieldLabel = "Case type",
  placeholder = "Enter case type",
  emptyError = "Please enter a case type.",
}: Props) {
  const C = useThemePalette();
  const { isDark } = useAppTheme();
  const onPrimary = C.textInverse;
  const modalSheet = modalSheetBackground(C, isDark);
  const styles = useMemo(
    () => createStyles(C, onPrimary, modalSheet),
    [C, onPrimary, modalSheet],
  );
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setName("");
      setError(null);
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    onClose();
  }, [onClose]);

  const handleSave = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(emptyError);
      return;
    }
    Keyboard.dismiss();
    onSave(trimmed);
  }, [name, onSave, emptyError]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <SafeAreaView style={styles.overlay} edges={["top", "bottom"]}>
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <ThemedText type="accent" style={styles.title}>{title}</ThemedText>
            <Pressable onPress={handleClose} hitSlop={12}>
              <ThemedText type="default" style={styles.cancel}>Cancel</ThemedText>
            </Pressable>
          </View>
          <View style={styles.body}>
            <FormFieldWithHint
              label={fieldLabel}
              required
              value={name}
              onChangeText={(v) => {
                setName(v);
                setError(null);
              }}
              placeholder={placeholder}
              autoCapitalize="words"
            />
            {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
            <Pressable style={styles.saveBtn} onPress={handleSave}>
              <ThemedText style={styles.saveBtnText}>Add</ThemedText>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

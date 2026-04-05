import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import {
  type AppColors,
  modalSheetBackground,
} from "@/constants/color-palette";
import { useAppTheme } from "@/context/app-theme-context";
import { useThemePalette } from "@/hooks/use-theme-palette";

type Props = {
  visible: boolean;
  /** Pre-filled suggested name (original filename without extension). */
  suggestedName: string;
  /** Called with the final chosen name when user taps Save. */
  onConfirm: (name: string) => void;
  /** Called when user cancels — the pending file should be discarded. */
  onCancel: () => void;
  /** Show a spinner on Save while uploading. */
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
      padding: 20,
      paddingBottom: 32,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 18,
    },
    title: {
      fontSize: 18,
      fontWeight: "700",
      color: C.black,
    },
    cancelText: {
      fontSize: 16,
      color: C.btnBlue,
      fontWeight: "500",
    },
    label: {
      fontSize: 12,
      fontWeight: "600",
      color: C.gray50,
      textTransform: "uppercase",
      marginBottom: 8,
    },
    input: {
      borderWidth: 1,
      borderColor: C.borderGray,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: C.black,
      backgroundColor: C.background,
      marginBottom: 4,
    },
    hint: {
      fontSize: 12,
      color: C.gray50,
      marginBottom: 20,
    },
    saveBtn: {
      backgroundColor: C.themeBlack,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    saveBtnText: {
      fontSize: 16,
      fontWeight: "600",
      color: onPrimary,
    },
  });
}

/** Strips extension and cleans up common camera/picker filename patterns. */
function sanitizeSuggestion(raw: string): string {
  return raw
    .replace(/\.[^/.]+$/, "")          // remove extension
    .replace(/^(IMG|VID|DCIM|photo)_/i, "") // remove camera prefixes
    .replace(/[_-]+/g, " ")            // underscores/dashes → spaces
    .trim();
}

export function DocumentNameModal({
  visible,
  suggestedName,
  onConfirm,
  onCancel,
  saving = false,
}: Props) {
  const C = useThemePalette();
  const { isDark } = useAppTheme();
  const onPrimary = isDark ? C.black : C.pureWhite;
  const modalSheet = modalSheetBackground(C, isDark);
  const styles = useMemo(
    () => createStyles(C, onPrimary, modalSheet),
    [C, onPrimary, modalSheet],
  );

  const [name, setName] = useState("");
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setName(sanitizeSuggestion(suggestedName));
      // Small delay so animation settles before focusing
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [visible, suggestedName]);

  const handleSave = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) return;
    Keyboard.dismiss();
    onConfirm(trimmed);
  }, [name, onConfirm]);

  const handleCancel = useCallback(() => {
    Keyboard.dismiss();
    onCancel();
  }, [onCancel]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <SafeAreaView style={styles.overlay} edges={["top", "bottom"]}>
        <Pressable style={styles.backdrop} onPress={handleCancel} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <ThemedText style={styles.title}>Name this document</ThemedText>
            <Pressable onPress={handleCancel} hitSlop={12} disabled={saving}>
              <ThemedText style={styles.cancelText}>Cancel</ThemedText>
            </Pressable>
          </View>

          <ThemedText style={styles.label}>Document name</ThemedText>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Vakalatnama, FIR, Order Sheet"
            placeholderTextColor={C.gray50}
            returnKeyType="done"
            onSubmitEditing={handleSave}
            editable={!saving}
          />
          <ThemedText style={styles.hint}>
            Give this document a meaningful name so you can find it easily.
          </ThemedText>

          <Pressable
            style={styles.saveBtn}
            onPress={handleSave}
            disabled={saving || !name.trim()}
          >
            {saving ? (
              <ActivityIndicator size="small" color={onPrimary} />
            ) : (
              <ThemedText style={styles.saveBtnText}>Save document</ThemedText>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

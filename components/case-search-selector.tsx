import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useMemo, useState } from "react";
import {
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import {
  type AppColors,
  modalSheetBackground,
} from "@/constants/color-palette";
import { useAppTheme } from "@/context/app-theme-context";
import { useThemePalette } from "@/hooks/use-theme-palette";

export type CaseSearchMode = "name" | "number";

type Props = {
  value: string;
  mode: CaseSearchMode | null;
  onChangeText: (value: string) => void;
  onModeChange: (mode: CaseSearchMode | null) => void;
};

function createCaseSearchStyles(C: AppColors, modalSheet: string) {
  return StyleSheet.create({
    pickModeView: {
      borderWidth: 1,
      borderColor: C.borderGray,
      borderRadius: 10,
      backgroundColor: C.pureWhite,
      minHeight: 44,
      paddingHorizontal: 12,
      marginBottom: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    pickModeText: {
      flex: 1,
      fontSize: 14,
      color: C.gray50,
    },
    searchRow: {
      borderWidth: 1,
      borderColor: C.borderGray,
      borderRadius: 10,
      backgroundColor: C.pureWhite,
      minHeight: 44,
      paddingHorizontal: 8,
      marginBottom: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    modePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
      backgroundColor: C.grey100,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    modePillText: {
      fontSize: 12,
      color: C.gray50,
      fontWeight: "600",
    },
    searchInput: {
      flex: 1,
      color: C.black,
      fontSize: 14,
      paddingVertical: 10,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.35)",
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    modalCard: {
      width: "100%",
      maxWidth: 320,
      backgroundColor: modalSheet,
      borderRadius: 14,
      padding: 14,
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: C.black,
      marginBottom: 8,
    },
    modalOption: {
      paddingVertical: 12,
      paddingHorizontal: 10,
      borderRadius: 10,
    },
    modalOptionText: {
      fontSize: 15,
      color: C.black,
    },
  });
}

export function CaseSearchSelector({
  value,
  mode,
  onChangeText,
  onModeChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const C = useThemePalette();
  const { isDark } = useAppTheme();
  const modalSheet = modalSheetBackground(C, isDark);
  const styles = useMemo(
    () => createCaseSearchStyles(C, modalSheet),
    [C, modalSheet],
  );

  const placeholder =
    mode === "number" ? "Search case by number" : "Search case by name";
  const modeLabel = mode === "number" ? "Case number" : "Case name";

  if (!mode) {
    return (
      <>
        <Pressable style={styles.pickModeView} onPress={() => setOpen(true)}>
          <MaterialIcons name="search" size={18} color={C.gray50} />
          <ThemedText style={styles.pickModeText}>Choose search type</ThemedText>
          <MaterialIcons
            name="keyboard-arrow-down"
            size={22}
            color={C.gray50}
          />
        </Pressable>
        <SearchModeModal
          open={open}
          onClose={() => setOpen(false)}
          styles={styles}
          onSelect={(nextMode) => {
            onModeChange(nextMode);
            setOpen(false);
          }}
        />
      </>
    );
  }

  return (
    <>
      <View style={styles.searchRow}>
        <Pressable style={styles.modePill} onPress={() => setOpen(true)}>
          <ThemedText style={styles.modePillText}>{modeLabel}</ThemedText>
          <MaterialIcons
            name="keyboard-arrow-down"
            size={16}
            color={C.gray50}
          />
        </Pressable>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onBlur={() => {
            onChangeText("");
            onModeChange(null);
          }}
          placeholder={placeholder}
          placeholderTextColor={C.gray50}
          style={styles.searchInput}
        />
      </View>
      <SearchModeModal
        open={open}
        onClose={() => setOpen(false)}
        styles={styles}
        onSelect={(nextMode) => {
          Keyboard.dismiss();
          onModeChange(nextMode);
          onChangeText("");
          setOpen(false);
        }}
      />
    </>
  );
}

type CaseSearchStyles = ReturnType<typeof createCaseSearchStyles>;

function SearchModeModal({
  open,
  onClose,
  onSelect,
  styles,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (mode: CaseSearchMode) => void;
  styles: CaseSearchStyles;
}) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          <ThemedText style={styles.modalTitle}>Search cases by</ThemedText>
          <Pressable style={styles.modalOption} onPress={() => onSelect("name")}>
            <ThemedText style={styles.modalOptionText}>Case name</ThemedText>
          </Pressable>
          <Pressable style={styles.modalOption} onPress={() => onSelect("number")}>
            <ThemedText style={styles.modalOptionText}>Case number</ThemedText>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { FormField } from "@/components/add-case/form-field";
import { ThemedText } from "@/components/themed-text";
import {
  type AppColors,
  modalSheetBackground,
} from "@/constants/color-palette";
import { useAppTheme } from "@/context/app-theme-context";
import { useThemePalette } from "@/hooks/use-theme-palette";

type Props = {
  label: string;
  required?: boolean;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  hint?: string;
  error?: string | null;
};

function createSelectFieldStyles(C: AppColors, modalSheet: string) {
  return StyleSheet.create({
    triggerRow: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: C.borderGray,
      borderRadius: 10,
      paddingHorizontal: 14,
      minHeight: 48,
    },
    trigger: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
    },
    triggerText: {
      fontSize: 16,
      flex: 1,
      color: C.black,
    },
    placeholder: {
      color: C.gray50,
    },
    hint: {
      fontSize: 13,
      marginTop: 6,
      color: C.black,
    },
    triggerRowError: {
      borderColor: C.themeRed,
    },
    errorText: {
      fontSize: 13,
      color: C.themeRed,
      marginTop: 4,
    },
    triggerDisabled: {
      opacity: 0.6,
    },
    overlay: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(0,0,0,0.4)",
    },
    sheet: {
      backgroundColor: modalSheet,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      minHeight: 280,
      maxHeight: "70%",
    },
    sheetHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: C.grey100,
    },
    sheetTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: C.black,
    },
    sheetClose: {
      fontSize: 17,
      fontWeight: "600",
      color: C.black,
    },
    list: {
      minHeight: 120,
      maxHeight: 320,
    },
    option: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.grey100,
    },
    optionText: {
      fontSize: 16,
      color: C.black,
    },
    optionTextSelected: {
      fontWeight: "600",
      color: C.black,
    },
  });
}

export function SelectField({
  label,
  required,
  value,
  options,
  onChange,
  placeholder = "Select...",
  disabled = false,
  hint,
  error,
}: Props) {
  const C = useThemePalette();
  const { isDark } = useAppTheme();
  const modalSheet = modalSheetBackground(C, isDark);
  const styles = useMemo(
    () => createSelectFieldStyles(C, modalSheet),
    [C, modalSheet],
  );
  const [open, setOpen] = useState(false);

  const onSelect = (opt: string) => {
    onChange(opt);
    setOpen(false);
  };

  return (
    <FormField label={label} required={required}>
      <View
        style={[
          styles.triggerRow,
          disabled && styles.triggerDisabled,
          error && styles.triggerRowError,
        ]}
      >
        <Pressable
          style={styles.trigger}
          onPress={() => !disabled && setOpen(true)}
        >
          <ThemedText
            style={[styles.triggerText, !value && styles.placeholder]}
            lightColor={!value ? C.gray50 : undefined}
            darkColor={!value ? C.gray50 : undefined}
          >
            {value || placeholder}
          </ThemedText>
          <MaterialIcons name="keyboard-arrow-down" size={24} color={C.gray50} />
        </Pressable>
      </View>
      {hint ? (
        <ThemedText style={styles.hint} lightColor={C.gray50} darkColor={C.gray50}>
          {hint}
        </ThemedText>
      ) : null}
      {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
      <Modal visible={open} transparent animationType="slide">
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <ThemedText style={styles.sheetTitle}>{label}</ThemedText>
              <Pressable onPress={() => setOpen(false)}>
                <ThemedText style={styles.sheetClose}>Done</ThemedText>
              </Pressable>
            </View>
            <ScrollView style={styles.list}>
              {options.map((opt) => (
                <Pressable
                  key={opt}
                  style={styles.option}
                  onPress={() => onSelect(opt)}
                >
                  <ThemedText
                    style={[
                      styles.optionText,
                      value === opt && styles.optionTextSelected,
                    ]}
                  >
                    {opt}
                  </ThemedText>
                  {value === opt ? (
                    <MaterialIcons name="check" size={22} color={C.themeBlack} />
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </FormField>
  );
}

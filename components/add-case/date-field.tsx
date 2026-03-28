import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import {
  DateTimePickerAndroid,
  type AndroidNativeProps,
} from "@react-native-community/datetimepicker";
import { useMemo, useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, View } from "react-native";
import { Calendar } from "react-native-calendars";

import { ThemedText } from "@/components/themed-text";
import {
  type AppColors,
  modalSheetBackground,
} from "@/constants/color-palette";
import { useAppTheme } from "@/context/app-theme-context";
import { useThemePalette } from "@/hooks/use-theme-palette";

function buildDateFieldCalendarTheme(C: AppColors, modalSheet: string) {
  return {
    calendarBackground: modalSheet,
    textSectionTitleColor: C.black,
    selectedDayBackgroundColor: C.black,
    selectedDayTextColor: C.pureWhite,
    todayTextColor: C.black,
    dayTextColor: C.black,
    textDisabledColor: C.gray40,
    textInactiveColor: C.gray40,
    monthTextColor: C.black,
    arrowColor: C.black,
  };
}

/** Format YYYY-MM-DD to DD/MM/YYYY for display */
export function formatDateForDisplay(isoDate: string): string {
  if (!isoDate || isoDate.length < 10) return "";
  const [y, m, d] = isoDate.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** Parse DD/MM/YYYY or YYYY-MM-DD to Date; invalid returns today */
export function parseToDate(value: string): Date {
  const trimmed = value.trim();
  if (!trimmed) return new Date();
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    return Number.isNaN(date.getTime()) ? new Date() : date;
  }
  const dmyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    return Number.isNaN(date.getTime()) ? new Date() : date;
  }
  return new Date();
}

/** Format Date to YYYY-MM-DD */
export function formatDateToValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function createDateFieldStyles(C: AppColors, modalSheet: string) {
  return StyleSheet.create({
    wrap: {
      marginBottom: 20,
    },
    label: {
      fontSize: 15,
      fontWeight: "700",
      color: C.black,
      marginBottom: 8,
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderWidth: 1,
      borderColor: C.themeGray3,
      borderRadius: 10,
      paddingLeft: 14,
      paddingRight: 14,
      minHeight: 48,
      paddingVertical: 12,
    },
    inputRowError: {
      borderColor: C.themeRed,
    },
    inputText: {
      fontSize: 16,
      flex: 1,
    },
    placeholder: {
      opacity: 0.8,
    },
    icon: {
      marginLeft: 8,
    },
    hint: {
      fontSize: 13,
      marginTop: 6,
    },
    error: {
      fontSize: 13,
      color: C.themeRed,
      marginTop: 4,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 24,
    },
    modalContent: {
      backgroundColor: modalSheet,
      borderRadius: 16,
      paddingBottom: 24,
      width: "100%",
      maxWidth: 400,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: C.themeGray3,
    },
    modalCancel: {
      fontSize: 17,
      color: C.gray50,
    },
    modalDone: {
      fontSize: 17,
      fontWeight: "600",
      color: C.btnBlue,
    },
    pickerContainer: {
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
  });
}

type DateFieldProps = {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function DateField({
  label,
  required,
  hint,
  error,
  value,
  onChange,
  placeholder = "e.g. 08/09/2025",
}: DateFieldProps) {
  const C = useThemePalette();
  const { isDark } = useAppTheme();
  const modalSheet = modalSheetBackground(C, isDark);
  const styles = useMemo(
    () => createDateFieldStyles(C, modalSheet),
    [C, modalSheet],
  );
  const calendarTheme = useMemo(
    () => buildDateFieldCalendarTheme(C, modalSheet),
    [C, modalSheet],
  );

  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState(() => parseToDate(value));

  const displayText = value ? formatDateForDisplay(value) : "";
  const pickerDate = parseToDate(value);

  const openPicker = () => {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: pickerDate,
        mode: "date",
        display: "default",
        onChange: (_event, selectedDate) => {
          if (selectedDate) {
            onChange(formatDateToValue(selectedDate));
          }
        },
        minimumDate: new Date(1900, 0, 1),
        maximumDate: new Date(2100, 11, 31),
      } as AndroidNativeProps);
      return;
    }
    setTempDate(pickerDate);
    setShowPicker(true);
  };

  const handleConfirm = () => {
    onChange(formatDateToValue(tempDate));
    setShowPicker(false);
  };

  const handleDismiss = () => setShowPicker(false);

  return (
    <View style={styles.wrap}>
      {label ? (
        <ThemedText style={styles.label}>
          {label}
          {required ? " *" : ""}
        </ThemedText>
      ) : null}
      <Pressable
        style={[styles.inputRow, error && styles.inputRowError]}
        onPress={openPicker}
        accessibilityLabel={`Select date${
          displayText ? `: ${displayText}` : ""
        }`}
        accessibilityRole="button"
      >
        <ThemedText
          style={[styles.inputText, !displayText && styles.placeholder]}
          lightColor={displayText ? C.black : C.gray50}
          darkColor={displayText ? C.black : C.gray50}
        >
          {displayText || placeholder}
        </ThemedText>
        <MaterialIcons name="event" size={22} color={C.gray50} style={styles.icon} />
      </Pressable>
      {hint ? (
        <ThemedText style={styles.hint} lightColor={C.gray50} darkColor={C.gray50}>
          {hint}
        </ThemedText>
      ) : null}
      {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

      {Platform.OS === "ios" && (
        <Modal
          visible={showPicker}
          transparent
          animationType="slide"
          onRequestClose={handleDismiss}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={handleDismiss}
            accessibilityLabel="Close date picker"
          >
            <Pressable
              style={styles.modalContent}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.modalHeader}>
                <Pressable onPress={handleDismiss} hitSlop={12}>
                  <ThemedText style={styles.modalCancel}>Cancel</ThemedText>
                </Pressable>
                <Pressable onPress={handleConfirm} hitSlop={12}>
                  <ThemedText style={styles.modalDone}>Done</ThemedText>
                </Pressable>
              </View>
              <View style={styles.pickerContainer}>
                <Calendar
                  current={formatDateToValue(tempDate)}
                  onDayPress={({ dateString }) =>
                    setTempDate(parseToDate(dateString))
                  }
                  markedDates={{
                    [formatDateToValue(tempDate)]: {
                      selected: true,
                      selectedColor: C.black,
                      selectedTextColor: C.pureWhite,
                    },
                  }}
                  theme={calendarTheme}
                  minDate="1900-01-01"
                  maxDate="2100-12-31"
                />
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

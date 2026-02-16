import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { FormField } from "@/components/add-case/form-field";
import { ThemedText } from "@/components/themed-text";
import { theme } from "@/constants/theme";

type Props = {
  label: string;
  required?: boolean;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  hint?: string;
  error?: string | null;
};

export function SearchableSelectField({
  label,
  required,
  value,
  options,
  onChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  disabled = false,
  hint,
  error,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.trim().toLowerCase();
    return options.filter((opt) => opt.toLowerCase().includes(q));
  }, [options, search]);

  const onSelect = (opt: string) => {
    onChange(opt);
    setOpen(false);
    setSearch("");
  };

  const onClose = () => {
    setOpen(false);
    setSearch("");
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
            lightColor={!value ? theme.colors.gray50 : undefined}
            darkColor={!value ? theme.colors.gray50 : undefined}
          >
            {value || placeholder}
          </ThemedText>
          <MaterialIcons
            name="keyboard-arrow-down"
            size={24}
            color={theme.colors.gray50}
          />
        </Pressable>
      </View>
      {hint ? (
        <ThemedText
          style={styles.hint}
          lightColor={theme.colors.gray50}
          darkColor={theme.colors.gray50}
        >
          {hint}
        </ThemedText>
      ) : null}
      {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
      <Modal visible={open} transparent animationType="slide">
        <Pressable style={styles.overlay} onPress={onClose}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <ThemedText style={styles.sheetTitle}>{label}</ThemedText>
              <Pressable onPress={onClose}>
                <ThemedText style={styles.sheetClose}>Done</ThemedText>
              </Pressable>
            </View>
            <View style={styles.searchRow}>
              <MaterialIcons
                name="search"
                size={20}
                color={theme.colors.gray50}
                style={styles.searchIcon}
              />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder={searchPlaceholder}
                placeholderTextColor={theme.colors.gray50}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <ScrollView
              style={styles.list}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {filteredOptions.length === 0 ? (
                <ThemedText
                  style={styles.emptyText}
                  lightColor={theme.colors.gray50}
                  darkColor={theme.colors.gray50}
                >
                  {search.trim() ? "No matches" : "No options"}
                </ThemedText>
              ) : (
                filteredOptions.map((opt) => (
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
                      <MaterialIcons
                        name="check"
                        size={22}
                        color={theme.colors.themeBlack}
                      />
                    ) : null}
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </FormField>
  );
}

const styles = StyleSheet.create({
  triggerRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
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
    color: theme.colors.black,
  },
  placeholder: {
    color: theme.colors.gray50,
  },
  hint: {
    fontSize: 13,
    marginTop: 6,
    color: theme.colors.black,
  },
  triggerRowError: {
    borderColor: theme.colors.themeRed,
  },
  errorText: {
    fontSize: 13,
    color: theme.colors.themeRed,
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
    backgroundColor: theme.colors.pureWhite,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    minHeight: 320,
    maxHeight: "75%",
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.grey100,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.black,
  },
  sheetClose: {
    fontSize: 17,
    fontWeight: "600",
    color: theme.colors.black,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.black,
    paddingVertical: 12,
    minHeight: 44,
  },
  list: {
    minHeight: 160,
    maxHeight: 320,
  },
  emptyText: {
    fontSize: 15,
    padding: 24,
    textAlign: "center",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.grey100,
  },
  optionText: {
    fontSize: 16,
    color: theme.colors.black,
  },
  optionTextSelected: {
    fontWeight: "600",
    color: theme.colors.black,
  },
});

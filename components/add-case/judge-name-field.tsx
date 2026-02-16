import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { FormField } from "@/components/add-case/form-field";
import { ThemedText } from "@/components/themed-text";
import { theme } from "@/constants/theme";
import { useAuth } from "@/context/auth-context";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string | null;
};

export function JudgeNameField({
  label,
  value,
  onChange,
  placeholder = "Select or add judge name",
  hint,
  error,
}: Props) {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [judges, setJudges] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [addName, setAddName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const fetchJudges = useCallback(async () => {
    if (!session?.user?.id || !isSupabaseConfigured) {
      setJudges([]);
      return;
    }
    setLoading(true);
    const { data, error: e } = await supabase
      .from("judges")
      .select("name")
      .eq("user_id", session.user.id)
      .order("name", { ascending: true });
    setLoading(false);
    if (e) {
      setJudges([]);
      return;
    }
    const names = (data ?? [])
      .map((r: { name: string }) => r.name?.trim())
      .filter(Boolean);
    setJudges(names);
  }, [session?.user?.id]);

  useEffect(() => {
    if (open) {
      fetchJudges();
      setAddName("");
      setAddError(null);
    }
  }, [open, fetchJudges]);

  const onSelect = useCallback(
    (name: string) => {
      onChange(name);
      setOpen(false);
    },
    [onChange],
  );

  const onAddNew = useCallback(async () => {
    const name = addName.trim();
    if (!name) return;
    if (!session?.user?.id || !isSupabaseConfigured) {
      setAddError("You must be signed in to save a judge name.");
      return;
    }
    setAdding(true);
    setAddError(null);
    const { error: e } = await supabase.from("judges").insert({
      user_id: session.user.id,
      name,
    });
    setAdding(false);
    if (e) {
      if (e.code === "23505") {
        setAddError("This judge is already in your list.");
      } else {
        setAddError(e.message || "Failed to add judge.");
      }
      return;
    }
    setJudges((prev) => [...prev, name].sort());
    setAddName("");
    onChange(name);
    setOpen(false);
  }, [addName, session?.user?.id, onChange]);

  return (
    <FormField label={label} hint={hint}>
      <View style={styles.dropdownWrap}>
        <View style={[styles.triggerRow, error && styles.triggerRowError]}>
          <Pressable
            style={styles.trigger}
            onPress={() => setOpen((prev) => !prev)}
          >
            <ThemedText
              style={[styles.triggerText, !value && styles.placeholder]}
              lightColor={!value ? theme.colors.gray50 : undefined}
              darkColor={!value ? theme.colors.gray50 : undefined}
            >
              {value || placeholder}
            </ThemedText>
            <MaterialIcons
              name={open ? "keyboard-arrow-up" : "keyboard-arrow-down"}
              size={24}
              color={theme.colors.gray50}
            />
          </Pressable>
        </View>
        {open && (
          <View style={styles.dropdown}>
            <View style={styles.addRow}>
              <TextInput
                style={styles.addInput}
                value={addName}
                onChangeText={(t) => {
                  setAddName(t);
                  setAddError(null);
                }}
                placeholder="Type new judge name..."
                placeholderTextColor={theme.colors.gray50}
                editable={!adding}
                onSubmitEditing={onAddNew}
              />
              <Pressable
                style={[styles.addBtn, adding && styles.addBtnDisabled]}
                onPress={onAddNew}
                disabled={adding || !addName.trim()}
              >
                {adding ? (
                  <ActivityIndicator
                    size="small"
                    color={theme.colors.pureWhite}
                  />
                ) : (
                  <ThemedText style={styles.addBtnText}>Add</ThemedText>
                )}
              </Pressable>
            </View>
            {addError ? (
              <ThemedText style={styles.addError}>{addError}</ThemedText>
            ) : null}
            <ThemedText style={styles.listLabel}>Saved judges</ThemedText>
            {loading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="small" color={theme.colors.black} />
              </View>
            ) : judges.length === 0 ? (
              <ThemedText style={styles.emptyHint}>
                No saved judges yet. Type a name above and tap Add.
              </ThemedText>
            ) : (
              <ScrollView
                style={styles.list}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
                {judges.map((name) => (
                  <Pressable
                    key={name}
                    style={styles.option}
                    onPress={() => onSelect(name)}
                  >
                    <ThemedText
                      style={[
                        styles.optionText,
                        value === name && styles.optionTextSelected,
                      ]}
                    >
                      {name}
                    </ThemedText>
                    {value === name ? (
                      <MaterialIcons
                        name="check"
                        size={22}
                        color={theme.colors.themeBlack}
                      />
                    ) : null}
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        )}
      </View>
      {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
    </FormField>
  );
}

const styles = StyleSheet.create({
  dropdownWrap: {
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    borderRadius: 10,
    overflow: "hidden",
  },
  triggerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    minHeight: 48,
    backgroundColor: theme.colors.pureWhite,
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
  triggerRowError: {
    borderColor: theme.colors.themeRed,
  },
  errorText: {
    fontSize: 13,
    color: theme.colors.themeRed,
    marginTop: 4,
  },
  dropdown: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.grey100,
    backgroundColor: theme.colors.grey100,
    padding: 12,
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  addInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.colors.black,
    backgroundColor: theme.colors.pureWhite,
    minHeight: 44,
  },
  addBtn: {
    backgroundColor: theme.colors.themeBlack,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    minHeight: 44,
    justifyContent: "center",
  },
  addBtnDisabled: {
    opacity: 0.7,
  },
  addBtnText: {
    color: theme.colors.pureWhite,
    fontSize: 15,
    fontWeight: "600",
  },
  addError: {
    fontSize: 13,
    color: theme.colors.themeRed,
    marginTop: 8,
  },
  listLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.gray50,
    marginTop: 12,
    marginBottom: 6,
  },
  loadingWrap: {
    padding: 16,
    alignItems: "center",
  },
  emptyHint: {
    fontSize: 14,
    color: theme.colors.gray50,
  },
  list: {
    maxHeight: 200,
    backgroundColor: theme.colors.pureWhite,
    borderRadius: 10,
    overflow: "hidden",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
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

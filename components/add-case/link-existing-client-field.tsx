import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { FormField } from "@/components/add-case/form-field";
import { ThemedText } from "@/components/themed-text";
import type { AppColors } from "@/constants/color-palette";
import { useAuth } from "@/context/auth-context";
import { useThemePalette } from "@/hooks/use-theme-palette";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type Props = {
  label: string;
  value: string;
  onChange: (clientName: string | null) => void;
  refreshKey?: number;
  placeholder?: string;
  hint?: string;
};

/** Saved client names only, dedupe, sort */
function sortNames(fromClients: string[]): string[] {
  const set = new Set<string>();
  for (const n of fromClients) if (n?.trim()) set.add(n.trim());
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function createLinkExistingClientStyles(C: AppColors) {
  return StyleSheet.create({
    dropdownWrap: {
      borderWidth: 1,
      borderColor: C.borderGray,
      borderRadius: 10,
      overflow: "hidden",
    },
    triggerRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      minHeight: 48,
      backgroundColor: C.pureWhite,
      gap: 8,
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
    clearBtn: {
      paddingVertical: 8,
      paddingHorizontal: 4,
    },
    clearBtnText: {
      fontSize: 14,
      color: C.btnBlue,
      fontWeight: "500",
    },
    dropdown: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: C.grey100,
      backgroundColor: C.grey100,
      padding: 12,
    },
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: C.borderGray,
      borderRadius: 10,
      paddingHorizontal: 12,
      backgroundColor: C.pureWhite,
      marginBottom: 10,
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      color: C.black,
      paddingVertical: 10,
      minHeight: 40,
    },
    listLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: C.gray50,
      marginBottom: 6,
    },
    loadingWrap: {
      padding: 12,
      alignItems: "center",
    },
    loadingText: {
      fontSize: 14,
    },
    emptyHint: {
      fontSize: 14,
      paddingVertical: 8,
    },
    list: {
      maxHeight: 200,
      backgroundColor: C.pureWhite,
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

export function LinkExistingClientField({
  label,
  value,
  onChange,
  refreshKey = 0,
  placeholder = "Select from your saved clients",
  hint,
}: Props) {
  const { session } = useAuth();
  const C = useThemePalette();
  const styles = useMemo(() => createLinkExistingClientStyles(C), [C]);
  const [open, setOpen] = useState(false);
  const [names, setNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const fetchNames = useCallback(async () => {
    if (!session?.user?.id || !isSupabaseConfigured) {
      setNames([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("clients")
      .select("name")
      .eq("user_id", session.user.id)
      .order("name", { ascending: true });
    setLoading(false);
    if (error) {
      setNames([]);
      return;
    }
    const fromClients = (data ?? [])
      .map((r: { name: string }) => r.name?.trim())
      .filter(Boolean);
    setNames(sortNames(fromClients));
  }, [session?.user?.id]);

  useEffect(() => {
    if (open) {
      fetchNames();
      setSearch("");
    }
  }, [open, fetchNames, refreshKey]);

  const filteredNames = useMemo(() => {
    if (!search.trim()) return names;
    const q = search.trim().toLowerCase();
    return names.filter((n) => n.toLowerCase().includes(q));
  }, [names, search]);

  const displayText = value || placeholder;

  const onSelect = useCallback(
    (name: string) => {
      onChange(name);
      setOpen(false);
    },
    [onChange],
  );

  return (
    <FormField label={label} hint={hint}>
      <View style={styles.dropdownWrap}>
        <View style={styles.triggerRow}>
          <Pressable
            style={styles.trigger}
            onPress={() => setOpen((prev) => !prev)}
          >
            <ThemedText
              style={[styles.triggerText, !value && styles.placeholder]}
              lightColor={!value ? C.gray50 : undefined}
              darkColor={!value ? C.gray50 : undefined}
              numberOfLines={1}
            >
              {displayText}
            </ThemedText>
            <MaterialIcons
              name={open ? "keyboard-arrow-up" : "keyboard-arrow-down"}
              size={24}
              color={C.gray50}
            />
          </Pressable>
          {value ? (
            <Pressable
              style={styles.clearBtn}
              onPress={() => onChange(null)}
              hitSlop={8}
            >
              <ThemedText style={styles.clearBtnText}>Clear</ThemedText>
            </Pressable>
          ) : null}
        </View>
        {open && (
          <View style={styles.dropdown}>
            <View style={styles.searchRow}>
              <MaterialIcons
                name="search"
                size={20}
                color={C.gray50}
                style={styles.searchIcon}
              />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Search by name..."
                placeholderTextColor={C.gray50}
                autoCapitalize="words"
                autoCorrect={false}
                spellCheck={false}
              />
            </View>
            <ThemedText style={styles.listLabel}>
              Saved clients
            </ThemedText>
            {loading ? (
              <View style={styles.loadingWrap}>
                <ThemedText
                  style={styles.loadingText}
                  lightColor={C.gray50}
                  darkColor={C.gray50}
                >
                  Loading...
                </ThemedText>
              </View>
            ) : filteredNames.length === 0 ? (
              <ThemedText
                style={styles.emptyHint}
                lightColor={C.gray50}
                darkColor={C.gray50}
              >
                {search.trim()
                  ? "No names match."
                  : "No saved clients yet. Add a client first."}
              </ThemedText>
            ) : (
              <ScrollView
                style={styles.list}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
                {filteredNames.map((name) => (
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
                      <MaterialIcons name="check" size={22} color={C.themeBlack} />
                    ) : null}
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        )}
      </View>
    </FormField>
  );
}

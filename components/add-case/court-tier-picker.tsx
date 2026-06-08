import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";

import { FormField } from "@/components/add-case/form-field";
import { ThemedText } from "@/components/themed-text";
import { COURT_TIERS } from "@/constants/case-form";
import type { AppColors } from "@/constants/color-palette";
import { useAppTheme } from "@/context/app-theme-context";
import { useAuth } from "@/context/auth-context";
import { useThemePalette } from "@/hooks/use-theme-palette";
import { useIsOnline } from "@/hooks/use-is-online";
import {
  addCachedCustomCourtTier,
  getCachedCustomCourtTiers,
  queueAddCourtTier,
  queueDeleteCourtTier,
  removeCachedCustomCourtTier,
  setCachedCustomCourtTiers,
} from "@/lib/offline-reference-data";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type Props = {
  label: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  hint?: string;
};

type CourtTierOption = {
  value: string;
  label: string;
  source: "default" | "custom";
};

function createCourtTierPickerStyles(C: AppColors, onPrimary: string) {
  return StyleSheet.create({
    dropdownWrap: {
      borderWidth: 1,
      borderColor: C.borderGray,
      borderRadius: 10,
      overflow: "hidden",
      backgroundColor: C.pureWhite,
    },
    trigger: {
      minHeight: 48,
      paddingHorizontal: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    triggerText: {
      fontSize: 16,
      color: C.black,
      flex: 1,
    },
    placeholder: {
      color: C.gray50,
    },
    triggerRowError: {
      borderColor: C.themeRed,
    },
    dropdown: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: C.grey100,
      backgroundColor: C.grey100,
      padding: 12,
    },
    searchInput: {
      borderWidth: 1,
      borderColor: C.borderGray,
      borderRadius: 10,
      backgroundColor: C.pureWhite,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: C.black,
    },
    addRow: {
      flexDirection: "row",
      marginTop: 10,
      gap: 8,
    },
    addInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: C.borderGray,
      borderRadius: 10,
      backgroundColor: C.pureWhite,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: C.black,
    },
    addBtn: {
      minWidth: 72,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.themeBlack,
      paddingHorizontal: 12,
    },
    addBtnDisabled: {
      opacity: 0.6,
    },
    addBtnText: {
      color: onPrimary,
      fontSize: 14,
      fontWeight: "600",
    },
    list: {
      maxHeight: 220,
      marginTop: 10,
      borderRadius: 10,
      backgroundColor: C.pureWhite,
      overflow: "hidden",
    },
    option: {
      minHeight: 44,
      paddingHorizontal: 14,
      paddingVertical: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.grey100,
    },
    optionText: {
      fontSize: 15,
      color: C.black,
      flex: 1,
      marginRight: 8,
    },
    deleteAction: {
      width: 92,
      backgroundColor: C.themeRed,
      justifyContent: "center",
      alignItems: "center",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.grey100,
      gap: 4,
    },
    deleteActionDisabled: {
      opacity: 0.8,
    },
    deleteActionText: {
      color: onPrimary,
      fontSize: 12,
      fontWeight: "600",
    },
    loadingWrap: {
      paddingVertical: 14,
      alignItems: "center",
    },
    errorText: {
      color: C.themeRed,
      fontSize: 13,
      marginTop: 6,
    },
  });
}

export function CourtTierPicker({
  label,
  required = false,
  value,
  onChange,
  error,
  hint,
}: Props) {
  const { session, effectiveOwnerId } = useAuth();
  const isOnline = useIsOnline();
  const C = useThemePalette();
  const { isDark } = useAppTheme();
  const onPrimary = isDark ? C.black : C.pureWhite;
  const styles = useMemo(
    () => createCourtTierPickerStyles(C, onPrimary),
    [C, onPrimary],
  );
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [customTiers, setCustomTiers] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [newTier, setNewTier] = useState("");
  const [addingTier, setAddingTier] = useState(false);
  const [deletingTier, setDeletingTier] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  const defaultOptions = useMemo<CourtTierOption[]>(
    () => COURT_TIERS.map((tier) => ({ value: tier.value, label: tier.label, source: "default" })),
    [],
  );

  const options = useMemo<CourtTierOption[]>(() => {
    const customOptions = customTiers.map((tier) => ({
      value: tier,
      label: tier,
      source: "custom" as const,
    }));
    return [...defaultOptions, ...customOptions];
  }, [defaultOptions, customTiers]);

  const displayValue = useMemo(() => {
    const selected = options.find((opt) => opt.value === value);
    return selected?.label ?? value;
  }, [options, value]);

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) || opt.value.toLowerCase().includes(q),
    );
  }, [options, search]);

  const loadCustomTiers = useCallback(async () => {
    if (!session?.user?.id || !effectiveOwnerId || !isSupabaseConfigured) {
      setCustomTiers([]);
      setFetchError(null);
      return;
    }
    if (!isOnline) {
      const cached = await getCachedCustomCourtTiers(session.user.id);
      setCustomTiers(cached);
      setFetchError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setFetchError(null);
    const { data, error: e } = await supabase
      .from("court_tiers")
      .select("name")
      .eq("user_id", effectiveOwnerId)
      .order("name", { ascending: true });
    setLoading(false);
    if (e) {
      const msg = (e.message || "").toLowerCase();
      const isNetworkError =
        msg.includes("network request failed") ||
        msg.includes("failed to fetch") ||
        msg.includes("network error") ||
        msg.includes("fetch failed");
      if (isNetworkError) {
        const cached = await getCachedCustomCourtTiers(session.user.id);
        setCustomTiers(cached);
        setFetchError(null);
      } else {
        setFetchError(e.message || "Failed to load court tiers.");
        setCustomTiers([]);
      }
      return;
    }
    const names = ((data ?? []) as { name: string }[])
      .map((row) => row.name?.trim())
      .filter(Boolean) as string[];
    setCustomTiers(names);
    await setCachedCustomCourtTiers(session.user.id, names);
  }, [session?.user?.id, effectiveOwnerId, isOnline]);

  useEffect(() => {
    if (!open) return;
    void loadCustomTiers();
  }, [open, loadCustomTiers]);

  const handleAddTier = useCallback(async () => {
    const name = newTier.trim();
    if (!name) return;
    const duplicate = options.some(
      (opt) => opt.label.trim().toLowerCase() === name.toLowerCase(),
    );
    if (duplicate) {
      setAddError("This court tier already exists.");
      return;
    }
    if (!session?.user?.id || !effectiveOwnerId || !isSupabaseConfigured) {
      setAddError("You must be signed in to add a court tier.");
      return;
    }
    if (!isOnline) {
      await addCachedCustomCourtTier(session.user.id, name);
      await queueAddCourtTier(session.user.id, name);
      setCustomTiers((prev) => [...prev, name].sort((a, b) => a.localeCompare(b)));
      setNewTier("");
      onChange(name);
      return;
    }
    setAddingTier(true);
    setAddError(null);
    const { error: e } = await supabase.from("court_tiers").insert({
      user_id: effectiveOwnerId,
      name,
    });
    setAddingTier(false);
    if (e) {
      if (e.code === "23505") {
        setAddError("This court tier already exists.");
      } else {
        setAddError(e.message || "Failed to save court tier.");
      }
      return;
    }
    setCustomTiers((prev) => [...prev, name].sort((a, b) => a.localeCompare(b)));
    await addCachedCustomCourtTier(session.user.id, name);
    setNewTier("");
    onChange(name);
  }, [newTier, options, session?.user?.id, effectiveOwnerId, onChange, isOnline]);

  const handleDeleteTier = useCallback(
    async (tierName: string) => {
      if (!session?.user?.id || !effectiveOwnerId || !isSupabaseConfigured) {
        setAddError("You must be signed in to remove a court tier.");
        return;
      }
      if (!isOnline) {
        await queueDeleteCourtTier(session.user.id, tierName);
        await removeCachedCustomCourtTier(session.user.id, tierName);
        setCustomTiers((prev) => prev.filter((tier) => tier !== tierName));
        if (value === tierName) {
          onChange("");
        }
        return;
      }
      setDeletingTier(tierName);
      setAddError(null);
      const { error: e } = await supabase
        .from("court_tiers")
        .delete()
        .eq("user_id", effectiveOwnerId)
        .eq("name", tierName);
      setDeletingTier(null);
      if (e) {
        setAddError(e.message || "Failed to remove court tier.");
        return;
      }
      setCustomTiers((prev) => prev.filter((tier) => tier !== tierName));
      await removeCachedCustomCourtTier(session.user.id, tierName);
      if (value === tierName) {
        onChange("");
      }
    },
    [session?.user?.id, effectiveOwnerId, value, onChange, isOnline],
  );

  return (
    <FormField label={label} required={required} hint={hint}>
      <View style={[styles.dropdownWrap, error && styles.triggerRowError]}>
        <Pressable style={styles.trigger} onPress={() => setOpen((prev) => !prev)}>
          <ThemedText style={[styles.triggerText, !value && styles.placeholder]}>
            {value ? displayValue : "Select court tier"}
          </ThemedText>
          <MaterialIcons
            name={open ? "keyboard-arrow-up" : "keyboard-arrow-down"}
            size={24}
            color={C.gray50}
          />
        </Pressable>

        {open ? (
          <View style={styles.dropdown}>
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search court tiers..."
              placeholderTextColor={C.gray50}
              autoCorrect={false}
              spellCheck={false}
            />

            <View style={styles.addRow}>
              <TextInput
                style={styles.addInput}
                value={newTier}
                onChangeText={(text) => {
                  setNewTier(text);
                  setAddError(null);
                }}
                placeholder="Add new court tier"
                placeholderTextColor={C.gray50}
                autoCorrect={false}
                spellCheck={false}
              />
              <Pressable
                style={[styles.addBtn, (!newTier.trim() || addingTier) && styles.addBtnDisabled]}
                onPress={() => void handleAddTier()}
                disabled={!newTier.trim() || addingTier}
              >
                {addingTier ? (
                  <ActivityIndicator size="small" color={onPrimary} />
                ) : (
                  <ThemedText style={styles.addBtnText}>Add</ThemedText>
                )}
              </Pressable>
            </View>
            {addError ? <ThemedText style={styles.errorText}>{addError}</ThemedText> : null}
            {fetchError ? <ThemedText style={styles.errorText}>{fetchError}</ThemedText> : null}

            {loading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="small" color={C.black} />
              </View>
            ) : (
              <ScrollView
                style={styles.list}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
                {filteredOptions.map((opt) =>
                  opt.source === "custom" ? (
                    <Swipeable
                      key={`${opt.source}:${opt.value}`}
                      overshootRight={false}
                      renderRightActions={() => (
                        <Pressable
                          style={[
                            styles.deleteAction,
                            deletingTier === opt.value && styles.deleteActionDisabled,
                          ]}
                          onPress={() => void handleDeleteTier(opt.value)}
                          disabled={deletingTier === opt.value}
                        >
                          {deletingTier === opt.value ? (
                            <ActivityIndicator size="small" color={onPrimary} />
                          ) : (
                            <>
                              <MaterialIcons
                                name="delete-outline"
                                size={18}
                                color={onPrimary}
                              />
                              <ThemedText style={styles.deleteActionText}>Delete</ThemedText>
                            </>
                          )}
                        </Pressable>
                      )}
                    >
                      <Pressable
                        style={styles.option}
                        onPress={() => {
                          onChange(opt.value);
                          setOpen(false);
                          setSearch("");
                        }}
                      >
                        <ThemedText style={styles.optionText}>{opt.label}</ThemedText>
                        {value === opt.value ? (
                          <MaterialIcons name="check" size={20} color={C.themeBlack} />
                        ) : null}
                      </Pressable>
                    </Swipeable>
                  ) : (
                    <Pressable
                      key={`${opt.source}:${opt.value}`}
                      style={styles.option}
                      onPress={() => {
                        onChange(opt.value);
                        setOpen(false);
                        setSearch("");
                      }}
                    >
                      <ThemedText style={styles.optionText}>{opt.label}</ThemedText>
                      {value === opt.value ? (
                        <MaterialIcons name="check" size={20} color={C.themeBlack} />
                      ) : null}
                    </Pressable>
                  ),
                )}
              </ScrollView>
            )}
          </View>
        ) : null}
      </View>
      {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
    </FormField>
  );
}

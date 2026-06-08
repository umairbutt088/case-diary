import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";

import { FormField } from "@/components/add-case/form-field";
import { ThemedText } from "@/components/themed-text";
import type { AppColors } from "@/constants/color-palette";
import { useAuth } from "@/context/auth-context";
import { useIsOnline } from "@/hooks/use-is-online";
import { useThemePalette } from "@/hooks/use-theme-palette";
import {
  getCachedJudges,
  getCachedJudgesForTier,
  queueDeleteJudge,
  removeCachedJudge,
  setCachedJudges,
} from "@/lib/offline-reference-data";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export type JudgeRecord = {
  name: string;
  courtRoomAddress: string | null;
  courtTier: string;
};

type Props = {
  label: string;
  required?: boolean;
  value: string;
  courtTier: string;
  onChange: (value: string) => void;
  onSelectJudge?: (judge: JudgeRecord) => void;
  onPressAddJudge?: () => void;
  /** When true, "Add Judge" opens the add-judge flow even if court tier is empty (tier is chosen in the sheet). */
  allowAddJudgeWithoutCourtTier?: boolean;
  placeholder?: string;
  hint?: string;
  error?: string | null;
};

function createJudgeNameSelectorStyles(C: AppColors) {
  return StyleSheet.create({
    dropdownWrap: {
      borderWidth: 1,
      borderColor: C.borderGray,
      borderRadius: 10,
      overflow: "hidden",
      backgroundColor: C.pureWhite,
    },
    triggerRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      minHeight: 48,
      backgroundColor: C.pureWhite,
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
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: C.black,
      backgroundColor: C.pureWhite,
    },
    listLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: C.gray50,
      marginTop: 12,
      marginBottom: 6,
    },
    loadingWrap: {
      padding: 16,
      alignItems: "center",
    },
    emptyHint: {
      fontSize: 14,
      color: C.gray50,
    },
    list: {
      maxHeight: 220,
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
      color: C.pureWhite,
      fontSize: 12,
      fontWeight: "600",
    },
    optionTextWrap: {
      flex: 1,
      marginRight: 8,
    },
    optionText: {
      fontSize: 16,
      color: C.black,
    },
    optionTextSelected: {
      fontWeight: "600",
      color: C.black,
    },
    optionSubText: {
      fontSize: 12,
      color: C.gray50,
      marginTop: 2,
    },
    optionSubTextMuted: {
      fontSize: 12,
      color: C.gray50,
      marginTop: 2,
      opacity: 0.8,
    },
    addJudgeBtn: {
      marginTop: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: C.borderGray,
      backgroundColor: C.pureWhite,
      paddingVertical: 11,
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    addJudgeBtnText: {
      fontSize: 15,
      color: C.black,
      fontWeight: "600",
    },
    fetchErrorRow: {
      marginTop: 8,
      gap: 8,
    },
    retryBtn: {
      alignSelf: "flex-start",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: C.btnGray,
    },
    retryBtnText: {
      fontSize: 13,
      color: C.GrayBtnTitle,
      fontWeight: "600",
    },
    errorText: {
      fontSize: 13,
      color: C.themeRed,
      marginTop: 4,
    },
  });
}

export function JudgeNameSelector({
  label,
  required = false,
  value,
  courtTier,
  onChange,
  onSelectJudge,
  onPressAddJudge,
  allowAddJudgeWithoutCourtTier = false,
  placeholder = "Select a judge",
  hint,
  error,
}: Props) {
  const { session, effectiveOwnerId } = useAuth();
  const isOnline = useIsOnline();
  const C = useThemePalette();
  const styles = useMemo(() => createJudgeNameSelectorStyles(C), [C]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [judges, setJudges] = useState<JudgeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingJudgeName, setDeletingJudgeName] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const normalize = useCallback((name: string) => name.trim().toLowerCase(), []);

  const filteredJudges = useMemo(() => {
    const q = normalize(query);
    if (!q) return judges;
    return judges.filter((judge) => normalize(judge.name).includes(q));
  }, [query, judges, normalize]);

  const fetchJudges = useCallback(async () => {
    if (!session?.user?.id || !effectiveOwnerId || !isSupabaseConfigured || !courtTier) {
      setJudges([]);
      setFetchError(null);
      return;
    }
    if (!isOnline) {
      const cached = await getCachedJudgesForTier(session.user.id, courtTier);
      setJudges(cached);
      setFetchError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setFetchError(null);
    const { data, error: e } = await supabase
      .from("judges")
      .select("name, court_room_address, court_tier")
      .eq("user_id", effectiveOwnerId)
      .eq("court_tier", courtTier)
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
        const cached = await getCachedJudgesForTier(session.user.id, courtTier);
        setJudges(cached);
        setFetchError(null);
      } else if (msg.includes("court_tier")) {
        setFetchError(
          "Judge tier setup is missing in database. Please run latest migrations.",
        );
        setJudges([]);
      } else {
        setFetchError(e.message || "Failed to load saved judges.");
        setJudges([]);
      }
      return;
    }

    const list = ((data ?? []) as {
      name: string;
      court_room_address?: string | null;
      court_tier?: string | null;
    }[])
      .map((row) => ({
        name: row.name?.trim(),
        courtRoomAddress: row.court_room_address?.trim() || null,
        courtTier: row.court_tier ?? courtTier,
      }))
      .filter((row) => Boolean(row.name));

    setJudges(list);
    const allCached = await getCachedJudges(session.user.id);
    const otherTierJudges = allCached.filter(
      (item) => item.courtTier.toLowerCase() !== courtTier.toLowerCase(),
    );
    await setCachedJudges(session.user.id, [...otherTierJudges, ...list]);
  }, [session?.user?.id, effectiveOwnerId, courtTier, isOnline]);

  useEffect(() => {
    setOpen(false);
    setQuery("");
    setFetchError(null);
  }, [courtTier]);

  useEffect(() => {
    if (!open) return;
    fetchJudges();
  }, [open, fetchJudges]);

  const onSelect = useCallback(
    (judge: JudgeRecord) => {
      onChange(judge.name);
      onSelectJudge?.(judge);
      setOpen(false);
    },
    [onChange, onSelectJudge],
  );

  const handleDeleteJudge = useCallback(
    async (judge: JudgeRecord) => {
      if (!session?.user?.id || !effectiveOwnerId || !isSupabaseConfigured || !courtTier) {
        setFetchError("You must be signed in to delete a judge.");
        return;
      }
      if (!isOnline) {
        await queueDeleteJudge(session.user.id, {
          name: judge.name,
          courtTier,
        });
        await removeCachedJudge(session.user.id, judge.name, courtTier);
        setJudges((prev) =>
          prev.filter(
            (item) =>
              !(
                item.name === judge.name &&
                item.courtTier === judge.courtTier
              ),
          ),
        );
        if (value === judge.name) {
          onChange("");
          onSelectJudge?.({
            name: "",
            courtRoomAddress: null,
            courtTier: "",
          });
        }
        return;
      }

      setDeletingJudgeName(judge.name);
      setFetchError(null);
      const { error: e } = await supabase
        .from("judges")
        .delete()
        .eq("user_id", effectiveOwnerId)
        .eq("court_tier", courtTier)
        .eq("name", judge.name);
      setDeletingJudgeName(null);

      if (e) {
        Alert.alert("Delete failed", e.message || "Could not delete judge.");
        return;
      }

      setJudges((prev) =>
        prev.filter(
          (item) =>
            !(
              item.name === judge.name &&
              item.courtTier === judge.courtTier
            ),
        ),
      );
      await removeCachedJudge(session.user.id, judge.name, courtTier);

      if (value === judge.name) {
        onChange("");
        onSelectJudge?.({
          name: "",
          courtRoomAddress: null,
          courtTier: "",
        });
      }
    },
    [session?.user?.id, effectiveOwnerId, courtTier, value, onChange, onSelectJudge, isOnline],
  );

  const handlePressAddJudge = useCallback(() => {
    if (!courtTier && !allowAddJudgeWithoutCourtTier) {
      Alert.alert(
        "Select court tier first",
        "Please select a court tier before adding a judge. The judge will be saved under that tier.",
      );
      return;
    }
    onPressAddJudge?.();
  }, [courtTier, allowAddJudgeWithoutCourtTier, onPressAddJudge]);

  return (
    <FormField label={label} required={required} hint={hint}>
      <View style={styles.dropdownWrap}>
        <View style={[styles.triggerRow, error && styles.triggerRowError]}>
          <Pressable
            style={styles.trigger}
            onPress={() => {
              if (!courtTier) return;
              setOpen((prev) => !prev);
            }}
            disabled={!courtTier}
          >
            <ThemedText
              style={[
                styles.triggerText,
                (!value || !courtTier) && styles.placeholder,
              ]}
              lightColor={!value || !courtTier ? C.gray50 : undefined}
              darkColor={!value || !courtTier ? C.gray50 : undefined}
            >
              {!courtTier ? "Select court tier first" : value || placeholder}
            </ThemedText>
            <MaterialIcons
              name={open ? "keyboard-arrow-up" : "keyboard-arrow-down"}
              size={24}
              color={C.gray50}
            />
          </Pressable>
        </View>

        {open && (
          <View style={styles.dropdown}>
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search judges..."
              placeholderTextColor={C.gray50}
              autoCorrect={false}
              spellCheck={false}
            />

            {fetchError ? (
              <View style={styles.fetchErrorRow}>
                <ThemedText style={styles.errorText}>{fetchError}</ThemedText>
                <Pressable onPress={fetchJudges} style={styles.retryBtn}>
                  <ThemedText style={styles.retryBtnText}>Retry</ThemedText>
                </Pressable>
              </View>
            ) : null}

            <ThemedText style={styles.listLabel}>
              Saved judges ({filteredJudges.length})
            </ThemedText>

            {loading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="small" color={C.black} />
              </View>
            ) : filteredJudges.length === 0 ? (
              <ThemedText style={styles.emptyHint}>
                No judges found for this court tier.
              </ThemedText>
            ) : (
              <ScrollView
                style={styles.list}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
                {filteredJudges.map((judge) => (
                  <Swipeable
                    key={`${judge.courtTier}:${judge.name}`}
                    overshootRight={false}
                    renderRightActions={() => (
                      <Pressable
                        style={[
                          styles.deleteAction,
                          deletingJudgeName === judge.name && styles.deleteActionDisabled,
                        ]}
                        onPress={() => void handleDeleteJudge(judge)}
                        disabled={deletingJudgeName === judge.name}
                      >
                        {deletingJudgeName === judge.name ? (
                          <ActivityIndicator size="small" color={C.pureWhite} />
                        ) : (
                          <>
                            <MaterialIcons
                              name="delete-outline"
                              size={18}
                              color={C.pureWhite}
                            />
                            <ThemedText style={styles.deleteActionText}>Delete</ThemedText>
                          </>
                        )}
                      </Pressable>
                    )}
                  >
                    <Pressable
                      style={styles.option}
                      onPress={() => onSelect(judge)}
                    >
                      <View style={styles.optionTextWrap}>
                        <ThemedText
                          style={[
                            styles.optionText,
                            value === judge.name && styles.optionTextSelected,
                          ]}
                        >
                          {judge.name}
                        </ThemedText>
                        {judge.courtRoomAddress ? (
                          <ThemedText style={styles.optionSubText}>
                            {judge.courtRoomAddress}
                          </ThemedText>
                        ) : (
                          <ThemedText style={styles.optionSubTextMuted}>
                            No saved court room address
                          </ThemedText>
                        )}
                      </View>
                      {value === judge.name ? (
                        <MaterialIcons name="check" size={22} color={C.themeBlack} />
                      ) : null}
                    </Pressable>
                  </Swipeable>
                ))}
              </ScrollView>
            )}
          </View>
        )}
      </View>

      {onPressAddJudge ? (
        <Pressable style={styles.addJudgeBtn} onPress={handlePressAddJudge}>
          <MaterialIcons name="person-add-alt-1" size={18} color={C.black} />
          <ThemedText style={styles.addJudgeBtnText}>Add Judge</ThemedText>
        </Pressable>
      ) : null}

      {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
    </FormField>
  );
}

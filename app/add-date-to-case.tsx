import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    StyleSheet,
    TextInput,
    View,
} from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ScreenHeader } from "@/components/ui/screen-header";
import type { AppColors } from "@/constants/color-palette";
import { theme } from "@/constants/theme";
import { useAuth } from "@/context/auth-context";
import { useAccessGuard } from "@/hooks/use-access-guard";
import { useIsOnline } from "@/hooks/use-is-online";
import { useThemePalette } from "@/hooks/use-theme-palette";
import { getCachedCases, patchCachedCase, setCachedCases } from "@/lib/cases-cache";
import { addCaseHearingEntry } from "@/lib/case-hearings";
import { addPendingCaseUpdate } from "@/lib/offline-queue";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { CaseRow } from "@/types/case";
import { formatCaseDate, getCaseDisplayTitle } from "@/types/case";

/** Parse YYYY-MM-DD from param; fallback to today */
function getDateParam(param: string | undefined): string {
  if (!param || param.length < 10) {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  return param.slice(0, 10);
}

function createAddDateToCaseStyles(C: AppColors) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: C.background,
    },
    processCard: {
      marginHorizontal: 20,
      marginTop: 16,
      marginBottom: 16,
      paddingVertical: 14,
      paddingHorizontal: 16,
      backgroundColor: C.cream50,
      borderRadius: 12,
      borderLeftWidth: 4,
      borderLeftColor: C.btnBlue,
    },
    processTitle: {
      fontSize: 15,
      fontWeight: "600",
      marginBottom: 6,
    },
    processSteps: {
      fontSize: 14,
      lineHeight: 22,
    },
    searchWrap: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: C.pureWhite,
      marginHorizontal: 20,
      marginBottom: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: C.borderGray,
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      color: C.textPrimary,
      flex: 1,
      fontSize: 16,
      paddingVertical: 0,
    },
    errorText: {
      fontSize: 14,
      paddingHorizontal: 20,
      marginBottom: 8,
    },
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    empty: {
      fontSize: 15,
      paddingHorizontal: 20,
      paddingTop: 24,
    },
    listContent: {
      paddingHorizontal: 20,
      paddingBottom: 32,
    },
    caseRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: C.cream50,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
      marginBottom: 8,
      ...theme.shadow,
    },
    caseRowText: {
      flex: 1,
      minWidth: 0,
      marginRight: 12,
    },
    caseRowTitle: {
      fontSize: 17,
      fontWeight: "600",
    },
    caseRowSubtitle: {
      fontSize: 13,
      marginTop: 2,
    },
  });
}

export default function AddDateToCaseScreen() {
  const router = useRouter();
  const { date: dateParam } = useLocalSearchParams<{ date?: string }>();
  const selectedDate = getDateParam(dateParam);
  const formattedDate = formatCaseDate(selectedDate);
  const C = useThemePalette();
  const styles = useMemo(() => createAddDateToCaseStyles(C), [C]);

  const { session, effectiveOwnerId } = useAuth();
  const accessGuard = useAccessGuard("edit_cases");
  const isOnline = useIsOnline();
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchCases = useCallback(async () => {
    if (!session?.user?.id || !effectiveOwnerId || !isSupabaseConfigured) {
      setCases([]);
      setLoading(false);
      return;
    }
    if (!isOnline) {
      const cached = await getCachedCases(session.user.id);
      setCases(cached);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    const { data, error: e } = await supabase
      .from("cases")
      .select("*")
      .eq("user_id", effectiveOwnerId)
      .is("deleted_at", null)
      .is("disposed_at", null)
      .order("updated_at", { ascending: false });
    setLoading(false);
    if (e) {
      const msg = (e.message || "").toLowerCase();
      const isNetworkError =
        msg.includes("network request failed") ||
        msg.includes("failed to fetch") ||
        msg.includes("network error") ||
        msg.includes("fetch failed");
      if (isNetworkError) {
        const cached = await getCachedCases(session.user.id);
        setCases(cached);
        setError(null);
      } else {
        setCases([]);
        setError(e.message);
      }
      return;
    }
    const nextCases = (data as CaseRow[]) ?? [];
    setCases(nextCases);
    await setCachedCases(session.user.id, nextCases);
  }, [session?.user?.id, effectiveOwnerId, isOnline]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  const filteredCases = useMemo(() => {
    if (!search.trim()) return cases;
    const q = search.trim().toLowerCase();
    return cases.filter((c) => {
      const title = getCaseDisplayTitle(c).toLowerCase();
      const num = (c.case_number ?? "").toLowerCase();
      const type = (c.case_type ?? "").toLowerCase();
      return title.includes(q) || num.includes(q) || type.includes(q);
    });
  }, [cases, search]);

  const handleSelectCase = useCallback(
    async (caseItem: CaseRow) => {
      if (!isSupabaseConfigured) {
        setError("Database not configured");
        return;
      }
      if (!session?.user?.id || !effectiveOwnerId) return;
      setSavingId(caseItem.id);
      setError(null);
      if (!isOnline) {
        const patch = {
          next_hearing_date: selectedDate,
          updated_at: new Date().toISOString(),
        };
        await addPendingCaseUpdate(session.user.id, caseItem.id, patch);
        await patchCachedCase(session.user.id, caseItem.id, patch);
        setSavingId(null);
        router.back();
        return;
      }
      const { error: e } = await supabase
        .from("cases")
        .update({
          next_hearing_date: selectedDate,
          updated_at: new Date().toISOString(),
        })
        .eq("id", caseItem.id)
        .eq("user_id", effectiveOwnerId);

      setSavingId(null);
      if (e) {
        setError(e.message);
        return;
      }
      await patchCachedCase(session.user.id, caseItem.id, {
        next_hearing_date: selectedDate,
        updated_at: new Date().toISOString(),
      });
      const hearingResult = await addCaseHearingEntry({
        caseId: caseItem.id,
        userId: effectiveOwnerId,
        hearingDate: caseItem.next_hearing_date ?? selectedDate,
        nextHearingDate: selectedDate,
        proceeding: "Next hearing date updated",
        judgeName: caseItem.judge_name,
      });
      if (!hearingResult.ok) {
        setError(hearingResult.message);
        return;
      }
      setError(null);
      router.back();
    },
    [selectedDate, session?.user?.id, effectiveOwnerId, router, isOnline]
  );

  if (accessGuard.blocked) return null;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <ScreenHeader title={`Add date to ${formattedDate}`} />

      <Animated.View
        style={{ flex: 1, backgroundColor: C.background }}
        entering={FadeInUp.duration(400).springify().damping(20)}
      >
        <View style={styles.processCard}>
          <ThemedText type="accent" style={styles.processTitle}>How it works</ThemedText>
          <ThemedText
            style={styles.processSteps}
            type="secondary"
          >
            1. Search or scroll to find your case.{"\n"}
            2. Tap the case to set its next hearing date to {formattedDate}.
          </ThemedText>
        </View>

        <View style={styles.searchWrap}>
          <MaterialIcons
            name="search"
            size={20}
            color={C.textSecondary}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search cases by title, number, or type..."
            placeholderTextColor={C.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
          />
        </View>

        {error ? (
          <ThemedText type="danger" style={styles.errorText}>{error}</ThemedText>
        ) : null}

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={C.textPrimary} />
          </View>
        ) : filteredCases.length === 0 ? (
          <ThemedText
            style={styles.empty}
            type="secondary"
          >
            {search.trim()
              ? "No cases match your search."
              : "You have no cases yet. Add a case first."}
          </ThemedText>
        ) : (
          <FlatList
            data={filteredCases}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const isSaving = savingId === item.id;
              const title = getCaseDisplayTitle(item);
              const subtitle = item.case_number
                ? `#${item.case_number}${item.case_type ? ` · ${item.case_type}` : ""}`
                : item.case_type ?? "";

              return (
                <Pressable
                  style={styles.caseRow}
                  onPress={() => handleSelectCase(item)}
                  disabled={isSaving}
                >
                  <View style={styles.caseRowText}>
                    <ThemedText type="accent" style={styles.caseRowTitle} numberOfLines={1}>
                      {title}
                    </ThemedText>
                    {subtitle ? (
                      <ThemedText
                        style={styles.caseRowSubtitle}
                        numberOfLines={1}
                        type="secondary"
                      >
                        {subtitle}
                      </ThemedText>
                    ) : null}
                  </View>
                  {isSaving ? (
                    <ActivityIndicator size="small" color={C.textPrimary} />
                  ) : (
                    <MaterialIcons
                      name="chevron-right"
                      size={24}
                      color={C.textSecondary}
                    />
                  )}
                </Pressable>
              );
            }}
          />
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

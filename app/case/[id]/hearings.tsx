import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ScreenHeader } from "@/components/ui/screen-header";
import type { AppColors } from "@/constants/color-palette";
import { theme } from "@/constants/theme";
import { useAuth } from "@/context/auth-context";
import { useAccessGuard } from "@/hooks/use-access-guard";
import { useThemePalette } from "@/hooks/use-theme-palette";
import { getCaseHearingHistory } from "@/lib/case-hearings";
import { supabase } from "@/lib/supabase";
import { formatCaseDate, getCaseDisplayTitle, type CaseRow } from "@/types/case";
import type { CaseHearingRow } from "@/types/case-hearing";

const HEARINGS_PAGE_SIZE = 10;

function createHearingsStyles(C: AppColors) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: C.background,
    },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    content: {
      padding: 20,
      paddingBottom: 40,
    },
    caseTitle: {
      fontSize: 18,
      fontWeight: "700",
      marginBottom: 14,
    },
    card: {
      borderRadius: 12,
      backgroundColor: C.pureWhite,
      padding: 14,
      marginBottom: 12,
      ...theme.shadow,
    },
    dateText: {
      fontSize: 15,
      fontWeight: "700",
      marginBottom: 6,
    },
    judgeText: {
      fontSize: 14,
      marginBottom: 6,
    },
    proceedingText: {
      fontSize: 16,
      marginBottom: 6,
    },
    nextText: {
      fontSize: 13,
    },
    emptyText: {
      fontSize: 15,
    },
    errorText: {
      marginBottom: 10,
      color: C.themeRed,
      fontSize: 14,
    },
    loadingMoreWrap: {
      marginTop: 8,
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    loadingMoreText: {
      fontSize: 13,
    },
  });
}

export default function CaseHearingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, effectiveOwnerId } = useAuth();
  const accessGuard = useAccessGuard("view_cases");
  const C = useThemePalette();
  const styles = useMemo(() => createHearingsStyles(C), [C]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("Hearing history");
  const [hearingHistory, setHearingHistory] = useState<CaseHearingRow[]>([]);
  const [hasMore, setHasMore] = useState(false);

  const loadHearings = useCallback(
    async ({ reset, offset = 0 }: { reset: boolean; offset?: number }) => {
      if (!id || !session?.user?.id || !effectiveOwnerId) {
        setLoading(false);
        setError("Invalid case.");
        return;
      }

      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      try {
        const pageOffset = reset ? 0 : Math.max(0, offset);
        const chunk = await getCaseHearingHistory(id, effectiveOwnerId, {
          limit: HEARINGS_PAGE_SIZE,
          offset: pageOffset,
        });

        if (reset) {
          setHearingHistory(chunk);
        } else {
          setHearingHistory((prev) => {
            const existingIds = new Set(prev.map((entry) => entry.id));
            const nextEntries = chunk.filter((entry) => !existingIds.has(entry.id));
            return [...prev, ...nextEntries];
          });
        }

        setHasMore(chunk.length === HEARINGS_PAGE_SIZE);
      } catch {
        setError("Failed to load hearing history.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [id, session?.user?.id, effectiveOwnerId],
  );

  useEffect(() => {
    if (!id || !session?.user?.id || !effectiveOwnerId) {
      setLoading(false);
      setError("Invalid case.");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data: caseData } = await supabase.from("cases").select("*").eq("id", id).single();
        if (cancelled) return;
        if (caseData) {
          setTitle(getCaseDisplayTitle(caseData as CaseRow));
        }
        await loadHearings({ reset: true, offset: 0 });
      } catch {
        if (cancelled) return;
        setError("Failed to load hearing history.");
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, session?.user?.id, effectiveOwnerId, loadHearings]);

  if (accessGuard.blocked) {
    return null;
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ScreenHeader title="All hearings" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={C.textPrimary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScreenHeader title="All hearings" />
      <FlatList
        data={hearingHistory}
        keyExtractor={(entry) => entry.id}
        style={{ backgroundColor: C.background }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onEndReachedThreshold={0.35}
        onEndReached={() => {
          if (!hasMore || loadingMore || loading) return;
          void loadHearings({ reset: false, offset: hearingHistory.length });
        }}
        ListHeaderComponent={
          <>
            <ThemedText type="accent" style={styles.caseTitle}>{title}</ThemedText>
            {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
          </>
        }
        ListEmptyComponent={
          <ThemedText type="muted" style={styles.emptyText}>No hearings recorded yet.</ThemedText>
        }
        renderItem={({ item: entry }) => (
          <View style={styles.card}>
            <ThemedText type="default" style={styles.dateText}>
              {formatCaseDate(entry.hearing_date)}
            </ThemedText>
            {entry.judge_name?.trim() ? (
              <ThemedText type="default" style={styles.judgeText}>
                Judge: {entry.judge_name.trim()}
              </ThemedText>
            ) : null}
            <ThemedText type="secondary" style={styles.proceedingText}>
              {(entry.proceeding || entry.current_status || "Proceeding updated").trim()}
            </ThemedText>
            <ThemedText type="default" style={styles.nextText}>
              Next: {entry.next_status?.trim() || "—"} •{" "}
              {entry.next_hearing_date
                ? formatCaseDate(entry.next_hearing_date)
                : "No date"}
            </ThemedText>
          </View>
        )}
        ListFooterComponent={
          hasMore ? (
            <View style={styles.loadingMoreWrap}>
              {loadingMore ? (
                <ActivityIndicator size="small" color={C.textPrimary} />
              ) : (
                <ThemedText type="default" style={styles.loadingMoreText}>Scroll for more hearings</ThemedText>
              )}
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useIsFocused } from "@react-navigation/native";
import { useFocusEffect, useRouter } from "expo-router";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  Share,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { CopilotStep, useCopilot, walkthroughable } from "react-native-copilot";

import { CaseCard } from "@/components/case-card";
import {
  CaseSearchSelector,
  type CaseSearchMode,
} from "@/components/case-search-selector";
import { ThemedText } from "@/components/themed-text";
import { ScreenHeader } from "@/components/ui/screen-header";
import { theme } from "@/constants/theme";
import { useAuth } from "@/context/auth-context";
import { useIsOnline } from "@/hooks/use-is-online";
import { getCachedCases, removeCachedCase, setCachedCases } from "@/lib/cases-cache";
import { addPendingCaseDelete } from "@/lib/offline-queue";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { formatCaseDate, getCaseDisplayTitle, type CaseRow } from "@/types/case";

const WalkthroughableView = walkthroughable(View);

/** Wrapper that forwards copilot ref to a native View - required for measureLayout.
 * CopilotStep injects the copilot prop; we spread it onto a native View. */
function DiaryHeaderWithRef({
  copilot,
  title,
  rightComponent,
}: {
  copilot?: { ref: React.RefObject<View | null>; onLayout: () => void };
  title: string;
  rightComponent?: React.ReactNode;
}) {
  const copilotWalkthroughProps = copilot
    ? ({ ref: copilot.ref, onLayout: copilot.onLayout } as Record<string, unknown>)
    : {};

  return (
    <WalkthroughableView {...copilotWalkthroughProps} collapsable={false}>
      <ScreenHeader title={title} showBack={false} rightComponent={rightComponent} />
    </WalkthroughableView>
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildBulkCaseReportHtml(cases: CaseRow[]): string {
  const generatedAt = new Date().toLocaleString();
  const rowsHtml = cases
    .map((caseItem) => {
      const title = escapeHtml(getCaseDisplayTitle(caseItem));
      const caseNumber = escapeHtml(caseItem.case_number?.trim() || "—");
      const nextDate = escapeHtml(formatCaseDate(caseItem.next_hearing_date));
      const courtTier = escapeHtml(caseItem.court_tier?.trim() || "—");
      const status = escapeHtml(caseItem.next_status?.trim() || caseItem.current_status?.trim() || "—");
      return `
        <tr>
          <td>${title}</td>
          <td>${caseNumber}</td>
          <td>${nextDate}</td>
          <td>${courtTier}</td>
          <td>${status}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; margin: 24px; color: #1f1f1f; }
          h1 { margin: 0 0 8px; font-size: 22px; }
          .meta { margin-bottom: 16px; font-size: 13px; color: #5c5c5c; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #d8d8d8; padding: 8px; text-align: left; vertical-align: top; }
          th { background: #f2f2f2; font-weight: 600; }
        </style>
      </head>
      <body>
        <h1>Case Summary</h1>
        <div class="meta">Generated: ${escapeHtml(generatedAt)} • Total cases: ${cases.length}</div>
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Case No.</th>
              <th>Next hearing</th>
              <th>Court tier</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </body>
    </html>
  `;
}

export default function DiaryScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const isOnline = useIsOnline();
  const { session } = useAuth();
  const { start } = useCopilot();
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [searchMode, setSearchMode] = useState<CaseSearchMode | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedCaseIds, setSelectedCaseIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkExporting, setBulkExporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const filteredCases = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query || !searchMode) return cases;
    if (searchMode === "number") {
      return cases.filter((caseItem) =>
        (caseItem.case_number ?? "").toLowerCase().includes(query),
      );
    }
    return cases.filter((caseItem) =>
      getCaseDisplayTitle(caseItem).toLowerCase().includes(query),
    );
  }, [cases, searchQuery, searchMode]);
  const selectedCount = selectedCaseIds.size;
  const selectedCases = useMemo(
    () => filteredCases.filter((item) => selectedCaseIds.has(item.id)),
    [filteredCases, selectedCaseIds],
  );

  const isNetworkError = useCallback((message: string) => {
    const msg = (message || "").toLowerCase();
    return (
      msg.includes("network request failed") ||
      msg.includes("failed to fetch") ||
      msg.includes("network error") ||
      msg.includes("fetch failed")
    );
  }, []);

  const fetchCases = useCallback(async (isSilent = false) => {
    if (!session?.user?.id || !isSupabaseConfigured) {
      setCases([]);
      setLoading(false);
      return;
    }

    if (!isOnline) {
      const cached = await getCachedCases(session.user.id);
      setCases(cached);
      setError(null);
      setLoading(false);
      return;
    }

    // Only show loading if not silent
    if (!isSilent) {
      setLoading(true);
    }
    setError(null);
    const { data, error: e } = await supabase
      .from("cases")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (e) {
      if (isNetworkError(e.message)) {
        const cached = await getCachedCases(session.user.id);
        setCases(cached);
        setError(null);
      } else {
        setError(e.message);
        setCases([]);
      }
      return;
    }
    const nextCases = (data as CaseRow[]) ?? [];
    setCases(nextCases);
    await setCachedCases(session.user.id, nextCases);
  }, [session?.user?.id, isOnline, isNetworkError]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        await fetchCases(true);
        if (cancelled) return;
        const hasSeenTour = await AsyncStorage.getItem(
          "hasSeenDiaryTourCopilot",
        );
        if (!hasSeenTour) {
          setTimeout(() => {
            if (cancelled) return;
            requestAnimationFrame(() => {
              if (cancelled) return;
              start();
            });
            AsyncStorage.setItem("hasSeenDiaryTourCopilot", "true");
          }, 600);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [fetchCases, start]),
  );

  const handleDeleteCase = useCallback(
    (caseId: string) => {
      Alert.alert(
        "Delete case?",
        "This cannot be undone.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              if (!session?.user?.id) return;
              if (!isOnline) {
                await addPendingCaseDelete(session.user.id, caseId);
                await removeCachedCase(session.user.id, caseId);
                setCases((prev) => prev.filter((c) => c.id !== caseId));
                Alert.alert(
                  "Delete queued",
                  "Case will be deleted in cloud when internet is available.",
                );
                return;
              }
              const { error: e } = await supabase
                .from("cases")
                .delete()
                .eq("id", caseId)
                .eq("user_id", session.user.id);
              if (e) {
                Alert.alert("Error", e.message);
              } else {
                await removeCachedCase(session.user.id, caseId);
                fetchCases();
              }
            },
          },
        ]
      );
    },
    [session?.user?.id, fetchCases, isOnline]
  );

  const toggleBulkMode = useCallback(() => {
    setBulkMode((prev) => !prev);
    setSelectedCaseIds(new Set());
  }, []);

  const toggleCaseSelection = useCallback((caseId: string) => {
    setSelectedCaseIds((prev) => {
      const next = new Set(prev);
      if (next.has(caseId)) next.delete(caseId);
      else next.add(caseId);
      return next;
    });
  }, []);

  const selectAllFiltered = useCallback(() => {
    setSelectedCaseIds(new Set(filteredCases.map((item) => item.id)));
  }, [filteredCases]);

  const clearSelected = useCallback(() => {
    setSelectedCaseIds(new Set());
  }, []);

  const bulkDeleteSelected = useCallback(() => {
    if (!session?.user?.id || selectedCount === 0 || bulkDeleting) return;
    Alert.alert(
      "Delete selected cases?",
      `You are about to delete ${selectedCount} case${selectedCount === 1 ? "" : "s"}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!session?.user?.id) return;
            const ids = Array.from(selectedCaseIds);
            setBulkDeleting(true);
            if (!isOnline) {
              for (const id of ids) {
                await addPendingCaseDelete(session.user.id, id);
                await removeCachedCase(session.user.id, id);
              }
              setCases((prev) => prev.filter((item) => !selectedCaseIds.has(item.id)));
              setSelectedCaseIds(new Set());
              setBulkDeleting(false);
              Alert.alert(
                "Delete queued",
                "Selected cases will be deleted in cloud when internet is available.",
              );
              return;
            }

            const { error: e } = await supabase
              .from("cases")
              .delete()
              .eq("user_id", session.user.id)
              .in("id", ids);
            if (e) {
              setBulkDeleting(false);
              Alert.alert("Delete failed", e.message || "Could not delete selected cases.");
              return;
            }

            for (const id of ids) {
              await removeCachedCase(session.user.id, id);
            }
            setCases((prev) => prev.filter((item) => !selectedCaseIds.has(item.id)));
            setSelectedCaseIds(new Set());
            setBulkDeleting(false);
          },
        },
      ],
    );
  }, [session?.user?.id, selectedCount, bulkDeleting, selectedCaseIds, isOnline]);

  const exportSelectedAsText = useCallback(async () => {
    if (selectedCases.length === 0 || bulkExporting) return;
    setBulkExporting(true);
    try {
      const lines = selectedCases.map(
        (item, index) =>
          `${index + 1}. ${getCaseDisplayTitle(item)}\n` +
          `Case no: ${item.case_number?.trim() || "—"}\n` +
          `Next hearing: ${formatCaseDate(item.next_hearing_date)}\n` +
          `Status: ${item.next_status?.trim() || item.current_status?.trim() || "—"}\n`,
      );
      await Share.share({
        title: "Selected Cases",
        message: `Selected cases (${selectedCases.length})\n\n${lines.join("\n")}`,
      });
    } catch (e: any) {
      Alert.alert("Export failed", e?.message || "Could not share selected cases.");
    } finally {
      setBulkExporting(false);
    }
  }, [selectedCases, bulkExporting]);

  const exportSelectedAsPdf = useCallback(async () => {
    if (selectedCases.length === 0 || bulkExporting) return;
    setBulkExporting(true);
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert("Sharing unavailable", "Sharing is not available on this device.");
        return;
      }
      const html = buildBulkCaseReportHtml(selectedCases);
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        UTI: "com.adobe.pdf",
        dialogTitle: "Share selected cases PDF",
      });
    } catch (e: any) {
      Alert.alert("Export failed", e?.message || "Could not export selected cases.");
    } finally {
      setBulkExporting(false);
    }
  }, [selectedCases, bulkExporting]);

  const openBulkExportOptions = useCallback(() => {
    if (selectedCount === 0 || bulkExporting) return;
    Alert.alert("Export selected cases", "Choose format", [
      { text: "Text", onPress: () => void exportSelectedAsText() },
      { text: "PDF", onPress: () => void exportSelectedAsPdf() },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [selectedCount, bulkExporting, exportSelectedAsText, exportSelectedAsPdf]);

  const headerRight = (
    <TouchableOpacity style={styles.bulkToggleBtn} onPress={toggleBulkMode}>
      <ThemedText style={styles.bulkToggleBtnText}>{bulkMode ? "Done" : "Select"}</ThemedText>
    </TouchableOpacity>
  );

  if (loading && cases.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ScreenHeader title="Your cases" showBack={false} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.black} />
        </View>
      </SafeAreaView>
    );
  }

  if (error && cases.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <CopilotStep
          text="This is your diary of all cases. Pull down to refresh."
          order={1}
          name="diary-welcome"
          active={isFocused}
        >
          <DiaryHeaderWithRef title="Your cases" rightComponent={headerRight} />
        </CopilotStep>
        <View style={styles.container}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  if (cases.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <CopilotStep
          text="This is your diary of all cases. Add cases from the Add button or Home."
          order={1}
          name="diary-welcome"
          active={isFocused}
        >
          <DiaryHeaderWithRef title="Your cases" rightComponent={headerRight} />
        </CopilotStep>
        <View style={styles.container}>
          <ThemedText style={styles.placeholder}>
            No cases yet. Add a case from the Add button or Home.
          </ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <CopilotStep
        text="This is your diary of all cases. Pull down to refresh."
        order={1}
        name="diary-welcome"
        active={isFocused}
      >
        <DiaryHeaderWithRef title="Your cases" rightComponent={headerRight} />
      </CopilotStep>
      <Animated.View 
        style={{ flex: 1 }}
        entering={FadeInUp.duration(400).springify().damping(20)}
      >
        <View style={styles.container}>
          <CaseSearchSelector
            mode={searchMode}
            value={searchQuery}
            onModeChange={setSearchMode}
            onChangeText={setSearchQuery}
          />
          {bulkMode ? (
            <View style={styles.bulkActionsBar}>
              <ThemedText style={styles.bulkCountText}>
                {selectedCount} selected
              </ThemedText>
              <View style={styles.bulkActionsRow}>
                <TouchableOpacity style={styles.bulkActionBtn} onPress={selectAllFiltered}>
                  <ThemedText style={styles.bulkActionBtnText}>Select all</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={styles.bulkActionBtn} onPress={clearSelected}>
                  <ThemedText style={styles.bulkActionBtnText}>Clear</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.bulkActionBtn}
                  onPress={openBulkExportOptions}
                  disabled={selectedCount === 0 || bulkExporting}
                >
                  <ThemedText style={styles.bulkActionBtnText}>
                    {bulkExporting ? "Exporting..." : "Export"}
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.bulkActionBtn, styles.bulkDeleteBtn]}
                  onPress={bulkDeleteSelected}
                  disabled={selectedCount === 0 || bulkDeleting}
                >
                  <ThemedText style={styles.bulkDeleteBtnText}>
                    {bulkDeleting ? "Deleting..." : "Delete"}
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
          <FlatList
            data={filteredCases}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl
                refreshing={loading}
                onRefresh={fetchCases}
                colors={[theme.colors.black]}
                tintColor={theme.colors.black}
              />
            }
            renderItem={({ item }) =>
              bulkMode ? (
                <TouchableOpacity
                  style={styles.bulkRow}
                  onPress={() => toggleCaseSelection(item.id)}
                  activeOpacity={0.9}
                >
                  <View
                    style={[
                      styles.checkbox,
                      selectedCaseIds.has(item.id) && styles.checkboxSelected,
                    ]}
                  >
                    {selectedCaseIds.has(item.id) ? (
                      <ThemedText style={styles.checkboxTick}>✓</ThemedText>
                    ) : null}
                  </View>
                  <View style={styles.bulkRowContent}>
                    <ThemedText style={styles.bulkRowTitle} numberOfLines={1}>
                      {getCaseDisplayTitle(item)}
                    </ThemedText>
                    <ThemedText style={styles.bulkRowMeta}>
                      Case no: {item.case_number?.trim() || "—"}
                    </ThemedText>
                    <ThemedText style={styles.bulkRowMeta}>
                      Next: {formatCaseDate(item.next_hearing_date)}
                    </ThemedText>
                  </View>
                </TouchableOpacity>
              ) : (
                <CaseCard
                  caseItem={item}
                  onEdit={(caseId) => router.push(`/case/${caseId}/edit`)}
                  onDelete={handleDeleteCase}
                />
              )
            }
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.noResultsWrap}>
                <ThemedText style={styles.noResultsTitle}>No matching case</ThemedText>
                <ThemedText style={styles.noResultsText}>
                  {searchMode === "number"
                    ? "Try another case number."
                    : "Try another case name."}
                </ThemedText>
              </View>
            }
          />
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: theme.colors.background,
  },
  title: {
    marginBottom: 12,
    color: theme.colors.black,
  },
  listContent: {
    paddingHorizontal: 2,
    paddingBottom: 24,
  },
  bulkToggleBtn: {
    minHeight: 34,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  bulkToggleBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.black,
  },
  bulkActionsBar: {
    borderRadius: 10,
    backgroundColor: theme.colors.pureWhite,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    padding: 10,
    marginBottom: 10,
    gap: 8,
  },
  bulkCountText: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.black,
  },
  bulkActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  bulkActionBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: theme.colors.pureWhite,
  },
  bulkActionBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.black,
  },
  bulkDeleteBtn: {
    borderColor: theme.colors.themeRed,
  },
  bulkDeleteBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.themeRed,
  },
  bulkRow: {
    marginBottom: 10,
    marginHorizontal: 2,
    borderRadius: 12,
    backgroundColor: theme.colors.pureWhite,
    ...theme.shadow,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.gray50,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.pureWhite,
  },
  checkboxSelected: {
    borderColor: theme.colors.themeBlack,
    backgroundColor: theme.colors.themeBlack,
  },
  checkboxTick: {
    color: theme.colors.pureWhite,
    fontSize: 13,
    fontWeight: "700",
  },
  bulkRowContent: {
    flex: 1,
    minWidth: 0,
  },
  bulkRowTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.black,
    marginBottom: 3,
  },
  bulkRowMeta: {
    fontSize: 12,
    color: theme.colors.gray50,
  },
  noResultsWrap: {
    marginTop: 18,
    padding: 14,
    borderRadius: 10,
    backgroundColor: theme.colors.pureWhite,
    ...theme.shadow,
  },
  noResultsTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.black,
    textAlign: "center",
  },
  noResultsText: {
    marginTop: 6,
    fontSize: 13,
    color: theme.colors.gray50,
    textAlign: "center",
  },
  placeholder: {
    opacity: 0.8,
    color: theme.colors.black,
  },
  errorText: {
    color: theme.colors.themeRed,
    marginTop: 8,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});

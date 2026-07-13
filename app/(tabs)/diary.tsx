import AsyncStorage from "@react-native-async-storage/async-storage";
import { useIsFocused } from "@react-navigation/native";
import * as Print from "expo-print";
import { useFocusEffect, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  InteractionManager,
  RefreshControl,
  Share,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { CopilotStep, useCopilot, walkthroughable } from "react-native-copilot";
import Animated, { FadeInUp } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { CaseCard } from "@/components/case-card";
import {
  CaseSearchSelector,
  type CaseSearchMode,
} from "@/components/case-search-selector";
import { ThemedText } from "@/components/themed-text";
import { ScreenHeader } from "@/components/ui/screen-header";
import { ListPageFooter } from "@/components/ui/list-page-footer";
import type { AppColors } from "@/constants/color-palette";
import { LIST_PAGE_SIZE } from "@/constants/pagination";
import { theme } from "@/constants/theme";
import { useAuth } from "@/context/auth-context";
import { useIsOnline } from "@/hooks/use-is-online";
import { useHomeBackNavigation } from "@/hooks/use-home-back-navigation";
import { useThemePalette } from "@/hooks/use-theme-palette";
import { getCachedCases, removeCachedCase } from "@/lib/cases-cache";
import {
  getPageRange,
  hasAnotherPage,
  mergeUniqueById,
} from "@/lib/pagination";
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
  showBack = false,
  onBack,
}: {
  copilot?: { ref: React.RefObject<View | null>; onLayout: () => void };
  title: string;
  rightComponent?: React.ReactNode;
  showBack?: boolean;
  onBack?: () => void;
}) {
  const copilotWalkthroughProps = copilot
    ? ({ ref: copilot.ref, onLayout: copilot.onLayout } as Record<string, unknown>)
    : {};

  return (
    <WalkthroughableView {...copilotWalkthroughProps} collapsable={false}>
      <ScreenHeader
        title={title}
        showBack={showBack}
        onBack={onBack}
        rightComponent={rightComponent}
      />
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

function createDiaryStyles(C: AppColors) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: C.background,
    },
    container: {
      flex: 1,
      paddingHorizontal: 24,
      paddingTop: 16,
      backgroundColor: C.background,
    },
    title: {
      marginBottom: 12,
    },
    listContent: {
      paddingHorizontal: 2,
      paddingBottom: 24,
    },
    bulkToggleBtn: {
      minHeight: 34,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: C.borderGray,
      paddingHorizontal: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    bulkToggleBtnText: {
      fontSize: 13,
      fontWeight: "600",
    },
    bulkActionsBar: {
      borderRadius: 10,
      backgroundColor: C.pureWhite,
      borderWidth: 1,
      borderColor: C.borderGray,
      padding: 10,
      marginBottom: 10,
      gap: 8,
    },
    bulkCountText: {
      fontSize: 13,
      fontWeight: "600",
    },
    bulkActionsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    bulkActionBtn: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: C.borderGray,
      paddingHorizontal: 10,
      paddingVertical: 8,
      backgroundColor: C.pureWhite,
    },
    bulkActionBtnText: {
      fontSize: 12,
      fontWeight: "600",
    },
    bulkDeleteBtn: {
      borderColor: C.themeRed,
    },
    bulkDeleteBtnText: {
      fontSize: 12,
      fontWeight: "700",
      color: C.themeRed,
    },
    bulkRow: {
      marginBottom: 10,
      marginHorizontal: 2,
      borderRadius: 12,
      backgroundColor: C.pureWhite,
      ...theme.shadow,
      borderWidth: 1,
      borderColor: C.borderGray,
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
      borderColor: C.gray50,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.pureWhite,
    },
    checkboxSelected: {
      borderColor: C.themeBlack,
      backgroundColor: C.themeBlack,
    },
    checkboxTick: {
      color: C.textInverse,
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
      marginBottom: 3,
    },
    bulkRowMeta: {
      fontSize: 12,
    },
    noResultsWrap: {
      marginTop: 18,
      padding: 14,
      borderRadius: 10,
      backgroundColor: C.pureWhite,
      ...theme.shadow,
    },
    noResultsTitle: {
      fontSize: 16,
      fontWeight: "700",
      textAlign: "center",
    },
    noResultsText: {
      marginTop: 6,
      fontSize: 13,
      textAlign: "center",
    },
    placeholder: {
      opacity: 0.8,
    },
    errorText: {
      color: C.themeRed,
      marginTop: 8,
    },
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
  });
}

export default function DiaryScreen() {
  const router = useRouter();
  const { fromHome, goBack } = useHomeBackNavigation();
  const isFocused = useIsFocused();
  const isOnline = useIsOnline();
  const { session, effectiveOwnerId, can } = useAuth();
  const { start, visible: copilotVisible, copilotEvents } = useCopilot();
  const C = useThemePalette();
  const styles = useMemo(() => createDiaryStyles(C), [C]);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [searchMode, setSearchMode] = useState<CaseSearchMode | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedCaseIds, setSelectedCaseIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkExporting, setBulkExporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockDiaryScrollForCopilot, setBlockDiaryScrollForCopilot] =
    useState(false);
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

  const loadCases = useCallback(
    async ({
      reset,
      offset = 0,
      isSilent = false,
    }: {
      reset: boolean;
      offset?: number;
      isSilent?: boolean;
    }) => {
      if (!session?.user?.id || !effectiveOwnerId || !isSupabaseConfigured) {
        setCases([]);
        setHasMore(false);
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      const pageOffset = reset ? 0 : Math.max(0, offset);
      if (reset) {
        if (!isSilent) setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      if (!isOnline) {
        const cached = await getCachedCases(session.user.id);
        const active = cached
          .filter((row) => !row.deleted_at && !row.disposed_at)
          .sort((a, b) => b.created_at.localeCompare(a.created_at));
        const chunk = active.slice(pageOffset, pageOffset + LIST_PAGE_SIZE);
        setCases((prev) => (reset ? chunk : mergeUniqueById(prev, chunk)));
        setHasMore(pageOffset + chunk.length < active.length);
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      const { from, to } = getPageRange(pageOffset);
      const { data, error: e } = await supabase
        .from("cases")
        .select("*")
        .eq("user_id", effectiveOwnerId)
        .is("deleted_at", null)
        .is("disposed_at", null)
        .order("created_at", { ascending: false })
        .range(from, to);

      setLoading(false);
      setLoadingMore(false);

      if (e) {
        if (reset && isNetworkError(e.message)) {
          const cached = await getCachedCases(session.user.id);
          const active = cached
            .filter((row) => !row.deleted_at && !row.disposed_at)
            .sort((a, b) => b.created_at.localeCompare(a.created_at));
          const chunk = active.slice(0, LIST_PAGE_SIZE);
          setCases(chunk);
          setHasMore(active.length > LIST_PAGE_SIZE);
          setError(null);
        } else if (reset) {
          setError(e.message);
          setCases([]);
          setHasMore(false);
        }
        return;
      }

      const chunk = (data as CaseRow[]) ?? [];
      setCases((prev) => (reset ? chunk : mergeUniqueById(prev, chunk)));
      setHasMore(hasAnotherPage(chunk.length));
    },
    [session?.user?.id, effectiveOwnerId, isOnline, isNetworkError],
  );

  const fetchCases = useCallback(
    (isSilent = false) => loadCases({ reset: true, isSilent }),
    [loadCases],
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      let copilotStartTimeout: ReturnType<typeof setTimeout> | null = null;
      let raf1 = 0;
      let raf2 = 0;
      let interactionTask: { cancel?: () => void } | null = null;

      // Lock immediately on focus so user can't scroll before walkthrough bootstrap decides.
      setBlockDiaryScrollForCopilot(true);

      (async () => {
        const hasSeenTour = await AsyncStorage.getItem(
          "hasSeenDiaryTourCopilot",
        );
        if (cancelled) return;
        await fetchCases(true);
        if (cancelled) return;
        if (hasSeenTour) {
          setBlockDiaryScrollForCopilot(false);
        } else {
          copilotStartTimeout = setTimeout(() => {
            if (cancelled) return;
            interactionTask = InteractionManager.runAfterInteractions(() => {
              if (cancelled) return;
              raf1 = requestAnimationFrame(() => {
                if (cancelled) return;
                raf2 = requestAnimationFrame(() => {
                  if (cancelled) return;
                  start();
                });
              });
            });
            AsyncStorage.setItem("hasSeenDiaryTourCopilot", "true");
          }, 600);
        }
      })();
      return () => {
        cancelled = true;
        if (copilotStartTimeout) clearTimeout(copilotStartTimeout);
        interactionTask?.cancel?.();
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }, [fetchCases, start]),
  );

  useEffect(() => {
    if (!isFocused) {
      setBlockDiaryScrollForCopilot(false);
    }
  }, [isFocused]);

  useEffect(() => {
    const onStart = () => setBlockDiaryScrollForCopilot(false);
    const onStop = () => setBlockDiaryScrollForCopilot(false);
    copilotEvents.on("start", onStart);
    copilotEvents.on("stop", onStop);
    return () => {
      copilotEvents.off("start", onStart);
      copilotEvents.off("stop", onStop);
    };
  }, [copilotEvents]);

  const scrollLockedForWalkthrough =
    isFocused && (blockDiaryScrollForCopilot || copilotVisible);

  const canTrashCase = can("edit_cases") && can("delete_cases");

  const handleDeleteCase = useCallback(
    (caseId: string) => {
      Alert.alert(
        "Move to Trash?",
        "The case will be moved to Trash. You can restore it anytime from Settings → Trash.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Move to Trash",
            style: "destructive",
            onPress: async () => {
              if (!session?.user?.id || !effectiveOwnerId) return;
              if (!isOnline) {
                await addPendingCaseDelete(session.user.id, caseId);
                await removeCachedCase(session.user.id, caseId);
                setCases((prev) => prev.filter((c) => c.id !== caseId));
                Alert.alert(
                  "Queued",
                  "Case will be moved to Trash when internet is available.",
                );
                return;
              }
              const { error: e } = await supabase
                .from("cases")
                .update({ deleted_at: new Date().toISOString() })
                .eq("id", caseId)
                .eq("user_id", effectiveOwnerId);
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
    [session?.user?.id, effectiveOwnerId, fetchCases, isOnline]
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
      "Move to Trash?",
      `Move ${selectedCount} case${selectedCount === 1 ? "" : "s"} to Trash? You can restore them anytime.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Move to Trash",
          style: "destructive",
          onPress: async () => {
            if (!session?.user?.id || !effectiveOwnerId) return;
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
                "Queued",
                "Cases will be moved to Trash when internet is available.",
              );
              return;
            }

            const { error: e } = await supabase
              .from("cases")
              .update({ deleted_at: new Date().toISOString() })
              .eq("user_id", effectiveOwnerId)
              .in("id", ids);
            if (e) {
              setBulkDeleting(false);
              Alert.alert("Error", e.message || "Could not move cases to Trash.");
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
  }, [
    session?.user?.id,
    effectiveOwnerId,
    selectedCount,
    bulkDeleting,
    selectedCaseIds,
    isOnline,
  ]);

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
  const headerBackProps = fromHome
    ? { showBack: true as const, onBack: goBack }
    : { showBack: false as const };

  if (loading && cases.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ScreenHeader title="Your cases" {...headerBackProps} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={C.textPrimary} />
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
          <DiaryHeaderWithRef
            title="Your cases"
            rightComponent={headerRight}
            {...headerBackProps}
          />
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
          <DiaryHeaderWithRef
            title="Your cases"
            rightComponent={headerRight}
            {...headerBackProps}
          />
        </CopilotStep>
        <View style={styles.container}>
          <ThemedText type="muted" style={styles.placeholder}>
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
        <DiaryHeaderWithRef
          title="Your cases"
          rightComponent={headerRight}
          {...headerBackProps}
        />
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
                {canTrashCase ? (
                  <TouchableOpacity
                    style={[styles.bulkActionBtn, styles.bulkDeleteBtn]}
                    onPress={bulkDeleteSelected}
                    disabled={selectedCount === 0 || bulkDeleting}
                  >
                    <ThemedText style={styles.bulkDeleteBtnText}>
                      {bulkDeleting ? "Deleting..." : "Delete"}
                    </ThemedText>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ) : null}
          <FlatList
            data={filteredCases}
            keyExtractor={(item) => item.id}
            scrollEnabled={!scrollLockedForWalkthrough}
            refreshControl={
              <RefreshControl
                refreshing={loading}
                onRefresh={() => fetchCases()}
                colors={[C.black]}
                tintColor={C.black}
              />
            }
            onEndReachedThreshold={0.35}
            onEndReached={() => {
              if (!hasMore || loadingMore || loading) return;
              void loadCases({ reset: false, offset: cases.length });
            }}
            ListFooterComponent={
              <ListPageFooter
                loading={loadingMore}
                hasMore={hasMore}
                itemCount={filteredCases.length}
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
                      <ThemedText type="default" style={styles.checkboxTick}>✓</ThemedText>
                    ) : null}
                  </View>
                  <View style={styles.bulkRowContent}>
                    <ThemedText type="accent" style={styles.bulkRowTitle} numberOfLines={1}>
                      {getCaseDisplayTitle(item)}
                    </ThemedText>
                    <ThemedText type="secondary" style={styles.bulkRowMeta}>
                      Case no: {item.case_number?.trim() || "—"}
                    </ThemedText>
                    <ThemedText type="secondary" style={styles.bulkRowMeta}>
                      Next: {formatCaseDate(item.next_hearing_date)}
                    </ThemedText>
                  </View>
                </TouchableOpacity>
              ) : (
                <CaseCard
                  caseItem={item}
                  onEdit={can("edit_cases") ? (caseId) => router.push(`/case/${caseId}/edit`) : undefined}
                  onDelete={canTrashCase ? handleDeleteCase : undefined}
                />
              )
            }
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.noResultsWrap}>
                <ThemedText type="accent" style={styles.noResultsTitle}>No matching case</ThemedText>
                <ThemedText type="default" style={styles.noResultsText}>
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

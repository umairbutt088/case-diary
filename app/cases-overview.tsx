import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Print from "expo-print";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";

import { CaseCard } from "@/components/case-card";
import { ThemedText } from "@/components/themed-text";
import { Bounceable, Spacer } from "@/components/ui";
import { ScreenHeader } from "@/components/ui/screen-header";
import { type AppColors, modalSheetBackground } from "@/constants/color-palette";
import { theme } from "@/constants/theme";
import { useAppTheme } from "@/context/app-theme-context";
import { useAuth } from "@/context/auth-context";
import { useIsOnline } from "@/hooks/use-is-online";
import { useHomeBackNavigation } from "@/hooks/use-home-back-navigation";
import { useThemePalette } from "@/hooks/use-theme-palette";
import { getCachedCases, removeCachedCase, setCachedCases } from "@/lib/cases-cache";
import { addPendingCaseDelete } from "@/lib/offline-queue";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { CaseRow } from "@/types/case";
import {
  formatCaseDate,
  getCaseDisplayTitle,
  getTodayISO,
  getWeekBounds,
} from "@/types/case";

type HomeFilter = "today" | "weekly";
type FiledRange = "today" | "week" | "month";
type CaseSection = { title: string; data: CaseRow[] };

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildCaseReportHtml(reportTitle: string, sections: CaseSection[]): string {
  const generatedAt = new Date().toLocaleString();
  const totalCases = sections.reduce((sum, section) => sum + section.data.length, 0);
  const rowsHtml = sections
    .flatMap((section) =>
      section.data.map((caseItem) => {
        const title = escapeHtml(getCaseDisplayTitle(caseItem));
        const caseNumber = escapeHtml(caseItem.case_number || "—");
        const typeOfCase = escapeHtml(
          caseItem.case_sub_type || caseItem.case_type || "—",
        );
        const courtTier = escapeHtml(caseItem.court_tier || "—");
        const judgeName = escapeHtml(caseItem.judge_name || "—");
        const courtAddress = escapeHtml(caseItem.court_room || "—");
        const previousDate = escapeHtml(formatCaseDate(caseItem.date_of_filing));
        const nextDate = escapeHtml(formatCaseDate(caseItem.next_hearing_date));
        const previousProceeding = escapeHtml(caseItem.current_status || "—");
        const nextProceeding = escapeHtml(caseItem.next_status || "—");
        return `
          <tr>
            <td>${title}</td>
            <td>${caseNumber}</td>
            <td>${typeOfCase}</td>
            <td>${courtTier}</td>
            <td>${judgeName}</td>
            <td>${courtAddress}</td>
            <td>${previousDate}</td>
            <td>${nextDate}</td>
            <td>${previousProceeding}</td>
            <td>${nextProceeding}</td>
          </tr>
        `;
      }),
    )
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
        <h1>${escapeHtml(reportTitle)}</h1>
        <div class="meta">
          Generated: ${escapeHtml(generatedAt)}<br />
          Total cases: ${totalCases}
        </div>
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Case No.</th>
              <th>Type of case</th>
              <th>Court tier</th>
              <th>Judge name</th>
              <th>Court address</th>
              <th>Previous date</th>
              <th>Next date</th>
              <th>Previous proceeding</th>
              <th>Next proceeding</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </body>
    </html>
  `;
}

function getTodayCases(
  cases: CaseRow[],
  today: string,
): { hearingsToday: CaseRow[]; filedToday: CaseRow[] } {
  const hearingsToday = cases.filter(
    (c) => c.next_hearing_date && c.next_hearing_date.slice(0, 10) === today,
  );
  const filedToday = cases.filter(
    (c) => c.date_of_filing && c.date_of_filing.slice(0, 10) === today,
  );
  return { hearingsToday, filedToday };
}

function getWeeklyCases(
  cases: CaseRow[],
  weekStart: string,
  weekEnd: string,
): { hearingsThisWeek: CaseRow[]; filedThisWeek: CaseRow[] } {
  const inRange = (date: string | null) => {
    if (!date || date.length < 10) return false;
    const d = date.slice(0, 10);
    return d >= weekStart && d <= weekEnd;
  };
  const hearingsThisWeek = cases.filter((c) => inRange(c.next_hearing_date));
  const filedThisWeek = cases.filter((c) => inRange(c.date_of_filing));
  return { hearingsThisWeek, filedThisWeek };
}

function getMonthCases(cases: CaseRow[], todayIso: string): CaseRow[] {
  const monthStart = `${todayIso.slice(0, 7)}-01`;
  const monthEndDate = new Date(todayIso);
  monthEndDate.setMonth(monthEndDate.getMonth() + 1, 0);
  const monthEnd = monthEndDate.toISOString().slice(0, 10);
  return cases.filter((c) => {
    if (!c.date_of_filing || c.date_of_filing.length < 10) return false;
    const d = c.date_of_filing.slice(0, 10);
    return d >= monthStart && d <= monthEnd;
  });
}

function isNetworkError(message: string): boolean {
  const msg = (message || "").toLowerCase();
  return (
    msg.includes("network request failed") ||
    msg.includes("failed to fetch") ||
    msg.includes("network error") ||
    msg.includes("fetch failed")
  );
}

function normalizeFilter(value: string | string[] | undefined): HomeFilter {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "weekly" ? "weekly" : "today";
}

export default function CasesOverviewScreen() {
  const router = useRouter();
  const { goBack } = useHomeBackNavigation();
  const params = useLocalSearchParams<{ filter?: string | string[] }>();
  const initialFilter = normalizeFilter(params.filter);

  const isOnline = useIsOnline();
  const { session, effectiveOwnerId, can } = useAuth();
  const C = useThemePalette();
  const { isDark } = useAppTheme();
  const modalSheet = modalSheetBackground(C, isDark);
  const styles = useMemo(() => createStyles(C, modalSheet), [C, modalSheet]);
  const exportImageRef = useRef<View | null>(null);
  const { width: screenWidth } = useWindowDimensions();

  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [filter, setFilter] = useState<HomeFilter>(initialFilter);
  const [isExporting, setIsExporting] = useState(false);
  const [showFiledCasesModal, setShowFiledCasesModal] = useState(false);
  const [filedRange, setFiledRange] = useState<FiledRange>("today");

  useEffect(() => {
    setFilter(initialFilter);
  }, [initialFilter]);

  const canTrashCase = can("edit_cases") && can("delete_cases");

  const today = getTodayISO();
  const { weekStart, weekEnd } = getWeekBounds();

  const fetchCases = useCallback(
    async (isSilent = false) => {
      if (!session?.user?.id || !effectiveOwnerId || !isSupabaseConfigured) {
        setCases([]);
        setLoading(false);
        setIsOffline(false);
        return;
      }

      if (!isOnline) {
        const cached = await getCachedCases(session.user.id);
        setCases(cached);
        setLoading(false);
        setIsOffline(true);
        setError(null);
        return;
      }

      if (!isSilent) setLoading(true);
      setError(null);
      setIsOffline(false);

      const { data, error: e } = await supabase
        .from("cases")
        .select("*")
        .eq("user_id", effectiveOwnerId)
        .is("deleted_at", null)
        .is("disposed_at", null)
        .order("next_hearing_date", { ascending: true, nullsFirst: false });

      setLoading(false);
      if (e) {
        if (isNetworkError(e.message)) {
          const cached = await getCachedCases(session.user.id);
          setIsOffline(true);
          setError(null);
          setCases(cached);
        } else {
          setError(e.message);
          setIsOffline(false);
          setCases([]);
        }
        return;
      }

      setIsOffline(false);
      const nextCases = (data as CaseRow[]) ?? [];
      setCases(nextCases);
      await setCachedCases(session.user.id, nextCases);
    },
    [session?.user?.id, effectiveOwnerId, isOnline],
  );

  useFocusEffect(
    useCallback(() => {
      void fetchCases(true);
    }, [fetchCases]),
  );

  useEffect(() => {
    if (!isOnline || !session?.user?.id || !isSupabaseConfigured) return;
    if (isOffline) void fetchCases(true);
  }, [isOnline, isOffline, session?.user?.id, fetchCases]);

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
              if (e) Alert.alert("Error", e.message);
              else {
                await removeCachedCase(session.user.id, caseId);
                fetchCases();
              }
            },
          },
        ],
      );
    },
    [session?.user?.id, effectiveOwnerId, fetchCases, isOnline],
  );

  const { hearingsToday, filedToday } = getTodayCases(cases, today);
  const { hearingsThisWeek, filedThisWeek } = getWeeklyCases(cases, weekStart, weekEnd);
  const filedThisMonth = useMemo(() => getMonthCases(cases, today), [cases, today]);

  const isTodayFilter = filter === "today";
  const selectedHearings = isTodayFilter ? hearingsToday : hearingsThisWeek;

  const sections = useMemo<CaseSection[]>(() => {
    if (isTodayFilter) {
      return hearingsToday.length > 0 ? [{ title: "Hearings today", data: hearingsToday }] : [];
    }
    return hearingsThisWeek.length > 0
      ? [{ title: "Hearings this week", data: hearingsThisWeek }]
      : [];
  }, [isTodayFilter, hearingsToday, hearingsThisWeek]);

  const filedCases = useMemo(() => {
    if (filedRange === "today") return filedToday;
    if (filedRange === "week") return filedThisWeek;
    return filedThisMonth;
  }, [filedRange, filedToday, filedThisWeek, filedThisMonth]);

  const filedRangeLabel =
    filedRange === "today" ? "Today" : filedRange === "week" ? "This week" : "This month";

  const shareTitle = isTodayFilter ? "Today Hearings" : "This Week Hearings";

  const shareCasesAsPdf = useCallback(async () => {
    if (isExporting || sections.length === 0) return;
    setIsExporting(true);
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert("Sharing unavailable", "Sharing is not available on this device.");
        return;
      }
      const html = buildCaseReportHtml(shareTitle, sections);
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        UTI: "com.adobe.pdf",
        dialogTitle: `Share ${shareTitle} PDF`,
      });
    } catch (e: any) {
      Alert.alert("Export failed", e?.message || "Could not export PDF.");
    } finally {
      setIsExporting(false);
    }
  }, [isExporting, sections, shareTitle]);

  const shareCasesAsImage = useCallback(async () => {
    if (isExporting || sections.length === 0) return;
    setIsExporting(true);
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert("Sharing unavailable", "Sharing is not available on this device.");
        return;
      }
      if (!exportImageRef.current) {
        Alert.alert("Export failed", "Could not capture the case list.");
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 80));
      const uri = await captureRef(exportImageRef.current, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });
      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        UTI: "public.png",
        dialogTitle: `Share ${shareTitle} image`,
      });
    } catch (e: any) {
      Alert.alert("Export failed", e?.message || "Could not export image.");
    } finally {
      setIsExporting(false);
    }
  }, [isExporting, sections.length, shareTitle]);

  const handleShareCases = useCallback(() => {
    if (sections.length === 0) {
      Alert.alert(
        "No hearings to share",
        isTodayFilter ? "There are no hearings today." : "There are no hearings this week.",
      );
      return;
    }
    Alert.alert("Share case list", "Choose a format", [
      { text: "PDF", onPress: () => void shareCasesAsPdf() },
      { text: "Image", onPress: () => void shareCasesAsImage() },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [sections.length, isTodayFilter, shareCasesAsPdf, shareCasesAsImage]);

  const filedCasesButton = (
    <View style={styles.filedCasesRow}>
      <Bounceable style={styles.filedCasesBtn} onPress={() => setShowFiledCasesModal(true)}>
        <MaterialIcons name="description" size={15} color={C.black} />
        <ThemedText style={styles.filedCasesBtnText}>Filed cases</ThemedText>
        <MaterialIcons name="keyboard-arrow-down" size={16} color={C.black} />
      </Bounceable>
    </View>
  );

  const filedCasesModal = (
    <Modal
      visible={showFiledCasesModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowFiledCasesModal(false)}
    >
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowFiledCasesModal(false)} />
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle}>Filed cases</ThemedText>
            <Bounceable style={styles.modalClose} onPress={() => setShowFiledCasesModal(false)}>
              <MaterialIcons name="close" size={20} color={C.black} />
            </Bounceable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filedRangeRow}
          >
            {(["today", "week", "month"] as const).map((range) => {
              const active = filedRange === range;
              const label =
                range === "today" ? "Today" : range === "week" ? "This week" : "This month";
              return (
                <Bounceable
                  key={range}
                  style={[styles.filedRangeBtn, active && styles.filedRangeBtnActive]}
                  onPress={() => setFiledRange(range)}
                >
                  <ThemedText
                    style={[styles.filedRangeBtnText, active && styles.filedRangeBtnTextActive]}
                  >
                    {label}
                  </ThemedText>
                </Bounceable>
              );
            })}
          </ScrollView>
          <ScrollView style={styles.filedListScroll} showsVerticalScrollIndicator={false}>
            {filedCases.length === 0 ? (
              <ThemedText style={styles.filedEmptyText}>
                No filed cases in {filedRangeLabel.toLowerCase()}.
              </ThemedText>
            ) : (
              filedCases.map((caseItem) => (
                <Bounceable
                  key={`filed-${caseItem.id}`}
                  style={styles.filedCaseCard}
                  onPress={() => {
                    setShowFiledCasesModal(false);
                    router.push(`/case/${caseItem.id}`);
                  }}
                >
                  <ThemedText style={styles.filedCaseTitle}>
                    {getCaseDisplayTitle(caseItem)}
                  </ThemedText>
                  <ThemedText style={styles.filedCaseMeta}>
                    Filed: {formatCaseDate(caseItem.date_of_filing)}
                  </ThemedText>
                </Bounceable>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const headerActions = (
    <Bounceable
      onPress={handleShareCases}
      style={styles.shareButton}
      accessibilityLabel="Share case list"
      disabled={isExporting}
    >
      {isExporting ? (
        <ActivityIndicator size="small" color={C.black} />
      ) : (
        <MaterialIcons name="share" size={21} color={C.black} />
      )}
    </Bounceable>
  );

  if (loading && cases.length === 0 && !isOffline) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ScreenHeader
          title={isTodayFilter ? "Today Cases" : "This week Cases"}
          rightComponent={headerActions}
          onBack={goBack}
        />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={C.black} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScreenHeader
        title={isTodayFilter ? "Today Cases" : "This week Cases"}
        rightComponent={headerActions}
        onBack={goBack}
      />
      <View style={styles.container}>
        {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
        {filedCasesButton}

        <View style={styles.filterRow}>
          <Bounceable
            style={[styles.filterBtn, isTodayFilter && styles.filterBtnActive]}
            onPress={() => setFilter("today")}
          >
            <ThemedText style={[styles.filterBtnText, isTodayFilter && styles.filterBtnTextActive]}>
              Today
            </ThemedText>
          </Bounceable>
          <Bounceable
            style={[styles.filterBtn, !isTodayFilter && styles.filterBtnActive]}
            onPress={() => setFilter("weekly")}
          >
            <ThemedText
              style={[styles.filterBtnText, !isTodayFilter && styles.filterBtnTextActive]}
            >
              Weekly
            </ThemedText>
          </Bounceable>
        </View>
        <Spacer.Column numberOfSpaces={5} />

        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={fetchCases}
              colors={[C.black]}
              tintColor={C.black}
            />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {selectedHearings.length === 0 ? (
            <View style={styles.emptyCard}>
              <MaterialIcons
                name={isOffline ? "cloud-off" : "today"}
                size={38}
                color={C.zodiacColour}
              />
              <ThemedText style={styles.emptyHeading}>
                {isOffline
                  ? "You're offline"
                  : isTodayFilter
                    ? "Nothing for today"
                    : "Nothing this week"}
              </ThemedText>
              <ThemedText style={styles.emptySubtext}>
                {isOffline
                  ? "Cached data is shown. New updates will load when you're online."
                  : isTodayFilter
                    ? "Cases with a hearing today will appear here."
                    : "Cases with a hearing this week will appear here."}
              </ThemedText>
            </View>
          ) : (
            sections.map((section, sectionIndex) => {
              const previousItemsCount = sections
                .slice(0, sectionIndex)
                .reduce((acc, s) => acc + s.data.length, 0);
              return (
                <View key={section.title} style={styles.section}>
                  <ThemedText style={styles.sectionTitle}>{section.title}</ThemedText>
                  <Spacer.Column numberOfSpaces={5} />
                  {section.data.map((caseItem, itemIndex) => (
                    <CaseCard
                      key={caseItem.id}
                      index={previousItemsCount + itemIndex}
                      caseItem={caseItem}
                      onEdit={
                        can("edit_cases")
                          ? (caseId) => router.push(`/case/${caseId}/edit`)
                          : undefined
                      }
                      onDelete={canTrashCase ? handleDeleteCase : undefined}
                      walkthroughEnabled={false}
                      walkthroughContext="home-case-actions"
                      walkthroughActive={false}
                    />
                  ))}
                </View>
              );
            })
          )}
        </ScrollView>
      </View>

      <View pointerEvents="none" style={styles.exportCaptureRoot}>
        <View
          ref={exportImageRef}
          collapsable={false}
          style={[styles.exportCaptureCanvas, { width: Math.max(screenWidth - 48, 280) }]}
        >
          <ThemedText style={styles.exportCaptureHeading}>{shareTitle}</ThemedText>
          {sections.map((section) => (
            <View key={`export-${section.title}`} style={styles.exportSection}>
              <ThemedText style={styles.exportSectionTitle}>{section.title}</ThemedText>
              {section.data.map((caseItem) => (
                <View key={`export-row-${caseItem.id}`} style={styles.exportRow}>
                  <ThemedText style={styles.exportRowTitle}>
                    {getCaseDisplayTitle(caseItem)}
                  </ThemedText>
                  <ThemedText style={styles.exportRowMeta}>
                    Case no: {caseItem.case_number?.trim() || "—"}
                  </ThemedText>
                  <ThemedText style={styles.exportRowMeta}>
                    Court: {caseItem.court_name?.trim() || "—"}
                  </ThemedText>
                  <ThemedText style={styles.exportRowMeta}>
                    Next: {formatCaseDate(caseItem.next_hearing_date)}
                  </ThemedText>
                </View>
              ))}
            </View>
          ))}
        </View>
      </View>

      {filedCasesModal}
    </SafeAreaView>
  );
}

function createStyles(C: AppColors, modalSheet: string) {
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
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    errorText: {
      color: C.themeRed,
      marginBottom: 8,
    },
    shareButton: {
      minWidth: 34,
      minHeight: 34,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 4,
    },
    filedCasesRow: {
      width: "100%",
      alignItems: "flex-end",
      marginBottom: 8,
    },
    filedCasesBtn: {
      minHeight: 34,
      paddingHorizontal: 10,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: C.borderGray,
      backgroundColor: C.pureWhite,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    filedCasesBtnText: {
      fontSize: 12,
      fontWeight: "700",
      color: C.black,
    },
    filterRow: {
      flexDirection: "row",
      width: "100%",
      paddingVertical: 10,
      justifyContent: "space-around",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.borderGray,
    },
    filterBtn: {
      width: "45%",
      paddingVertical: 10,
      alignItems: "center",
      borderRadius: 12,
      backgroundColor: C.grey100,
      borderWidth: 1,
      borderColor: "transparent",
    },
    filterBtnActive: {
      backgroundColor: C.themeBlack,
      borderColor: C.themeBlack,
    },
    filterBtnText: {
      fontSize: 15,
      fontWeight: "600",
      color: C.gray50,
    },
    filterBtnTextActive: {
      color: C.pureWhite,
    },
    section: {
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: C.gray50,
      marginBottom: 8,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    listContent: {
      paddingBottom: 24,
    },
    emptyCard: {
      backgroundColor: C.pureWhite,
      borderRadius: 16,
      paddingVertical: 32,
      paddingHorizontal: 28,
      alignItems: "center",
      minWidth: "100%",
      ...theme.shadow,
    },
    emptyHeading: {
      fontSize: 20,
      fontWeight: "700",
      color: C.black,
      marginTop: 12,
      marginBottom: 8,
    },
    emptySubtext: {
      fontSize: 15,
      color: C.gray50,
      textAlign: "center",
    },
    modalRoot: {
      flex: 1,
      justifyContent: "flex-end",
    },
    modalOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.34)",
    },
    modalCard: {
      backgroundColor: modalSheet,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 18,
      maxHeight: "74%",
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: C.black,
    },
    modalClose: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.background,
    },
    filedRangeRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 12,
      paddingRight: 4,
    },
    filedRangeBtn: {
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: C.borderGray,
      backgroundColor: C.background,
    },
    filedRangeBtnActive: {
      backgroundColor: C.themeBlack,
      borderColor: C.themeBlack,
    },
    filedRangeBtnText: {
      fontSize: 12,
      fontWeight: "600",
      color: C.gray50,
      paddingHorizontal: 10,
    },
    filedRangeBtnTextActive: {
      color: C.pureWhite,
    },
    filedListScroll: {
      maxHeight: 300,
    },
    filedCaseCard: {
      borderWidth: 1,
      borderColor: C.borderGray,
      backgroundColor: C.background,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 8,
    },
    filedCaseTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: C.black,
      marginBottom: 4,
    },
    filedCaseMeta: {
      fontSize: 12,
      color: C.gray50,
    },
    filedEmptyText: {
      fontSize: 13,
      color: C.gray50,
      paddingVertical: 8,
    },
    exportCaptureRoot: {
      position: "absolute",
      left: -10000,
      top: 0,
      opacity: 0,
    },
    exportCaptureCanvas: {
      backgroundColor: C.pureWhite,
      padding: 16,
      borderRadius: 12,
    },
    exportCaptureHeading: {
      fontSize: 18,
      fontWeight: "700",
      color: C.black,
      marginBottom: 12,
    },
    exportSection: {
      marginBottom: 14,
    },
    exportSectionTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: C.gray50,
      marginBottom: 8,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    exportRow: {
      backgroundColor: C.background,
      borderRadius: 10,
      padding: 10,
      marginBottom: 8,
    },
    exportRowTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: C.black,
      marginBottom: 2,
    },
    exportRowMeta: {
      fontSize: 12,
      color: C.gray50,
    },
  });
}

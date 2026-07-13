import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Print from "expo-print";
import { useFocusEffect, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  BackHandler,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";

import { CourtPortalBottomSheet } from "@/components/court-portal-bottom-sheet";
import { ThemedText } from "@/components/themed-text";
import { Bounceable } from "@/components/ui";
import { ScreenHeader } from "@/components/ui/screen-header";
import { type AppColors, modalSheetBackground } from "@/constants/color-palette";
import { type PakistanCourtPortal } from "@/constants/court-cms";
import { theme } from "@/constants/theme";
import { useAppTheme } from "@/context/app-theme-context";
import { useAuth } from "@/context/auth-context";
import { useIsOnline } from "@/hooks/use-is-online";
import { useThemePalette } from "@/hooks/use-theme-palette";
import {
  countActiveNotesForDate,
  getActivityNotesStorageKey,
  sanitizeActivityNotes,
} from "@/lib/activity-notes";
import { getCachedCases, setCachedCases } from "@/lib/cases-cache";
import { getPendingCasesCount } from "@/lib/offline-queue";
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
type HomeWidget = {
  key: string;
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  count?: number;
  tone?: "warning" | "success";
  onPress: () => void;
  disabled?: boolean;
};

const WIDGET_GRID_GAP = 10;
const CONTAINER_H_PADDING = 20;
const MIN_WIDGET_WIDTH = 148;

function getWidgetLayout(screenWidth: number) {
  const contentWidth = screenWidth - CONTAINER_H_PADDING * 2;
  const columns = Math.min(
    2,
    Math.max(
      1,
      Math.floor((contentWidth + WIDGET_GRID_GAP) / (MIN_WIDGET_WIDTH + WIDGET_GRID_GAP)),
    ),
  );
  const widgetWidth = (contentWidth - WIDGET_GRID_GAP * (columns - 1)) / columns;
  return { columns, widgetWidth, contentWidth };
}

function formatWidgetCount(count: number): string {
  if (count > 99) return "99+";
  return String(count);
}

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

function buildSharePayload(
  shareFilter: HomeFilter,
  hearingsToday: CaseRow[],
  hearingsThisWeek: CaseRow[],
): { title: string; sections: CaseSection[] } {
  const isToday = shareFilter === "today";
  const hearings = isToday ? hearingsToday : hearingsThisWeek;
  const sectionTitle = isToday ? "Today hearings" : "This week hearings";
  const title = isToday ? "Today Hearings" : "This Week Hearings";
  const sections =
    hearings.length > 0 ? [{ title: sectionTitle, data: hearings }] : [];
  return { title, sections };
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

export default function HomeScreen() {
  const isOnline = useIsOnline();
  const router = useRouter();
  const { session, effectiveOwnerId, can, role } = useAuth();
  const C = useThemePalette();
  const { isDark } = useAppTheme();
  const modalSheet = modalSheetBackground(C, isDark);
  const styles = useMemo(() => createHomeStyles(C, modalSheet), [C, modalSheet]);
  const exportImageRef = useRef<View | null>(null);
  const { width: screenWidth } = useWindowDimensions();
  const widgetLayout = useMemo(() => getWidgetLayout(screenWidth), [screenWidth]);

  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [shareExportFilter, setShareExportFilter] = useState<HomeFilter | null>(null);
  const [notesCount, setNotesCount] = useState(0);
  const [disposedCount, setDisposedCount] = useState(0);
  const [feeCasesCount, setFeeCasesCount] = useState(0);
  const [showCourtPortalModal, setShowCourtPortalModal] = useState(false);
  const [showFiledCasesModal, setShowFiledCasesModal] = useState(false);
  const [filedRange, setFiledRange] = useState<FiledRange>("today");
  const [selectedWidgetKey, setSelectedWidgetKey] = useState<string>("today-hearings");

  const canAddCases = can("add_cases");
  const canManageJudges = can("add_cases") || can("edit_cases");
  const isOwner = role !== "subordinate";

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

  const notesStorageKey = useMemo(
    () => getActivityNotesStorageKey(session?.user?.id),
    [session?.user?.id],
  );

  const loadNotesCount = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(notesStorageKey);
      if (!raw) {
        setNotesCount(0);
        return;
      }
      const parsed = JSON.parse(raw);
      const sanitized = sanitizeActivityNotes(parsed, today);
      setNotesCount(countActiveNotesForDate(sanitized, today));
      if (Array.isArray(parsed) && sanitized.length !== parsed.length) {
        await AsyncStorage.setItem(notesStorageKey, JSON.stringify(sanitized));
      }
    } catch {
      setNotesCount(0);
    }
  }, [notesStorageKey, today]);

  const loadDisposedCount = useCallback(async () => {
    if (!effectiveOwnerId || !isSupabaseConfigured || !isOnline) {
      setDisposedCount(0);
      return;
    }

    const { count, error: countError } = await supabase
      .from("cases")
      .select("id", { count: "exact", head: true })
      .eq("user_id", effectiveOwnerId)
      .is("deleted_at", null)
      .not("disposed_at", "is", null);

    setDisposedCount(countError ? 0 : (count ?? 0));
  }, [effectiveOwnerId, isOnline]);

  const loadFeeCasesCount = useCallback(async () => {
    if (!isOwner || !effectiveOwnerId || !isSupabaseConfigured || !isOnline) {
      setFeeCasesCount(0);
      return;
    }

    const { count, error: countError } = await supabase
      .from("cases")
      .select("id", { count: "exact", head: true })
      .eq("user_id", effectiveOwnerId)
      .is("deleted_at", null)
      .or("total_fee.not.is.null,fee_received.not.is.null");

    setFeeCasesCount(countError ? 0 : (count ?? 0));
  }, [effectiveOwnerId, isOnline, isOwner]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        await loadNotesCount();
        await loadDisposedCount();
        await loadFeeCasesCount();
        if (!isOnline && session?.user?.id && isSupabaseConfigured) {
          const cached = await getCachedCases(session.user.id);
          setLoading(false);
          setIsOffline(true);
          setError(null);
          setCases(cached);
        } else {
          await fetchCases(true);
        }
        if (cancelled) return;
        if (session?.user?.id) {
          const count = await getPendingCasesCount(session.user.id);
          if (!cancelled) setPendingCount(count);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [fetchCases, loadFeeCasesCount, loadNotesCount, loadDisposedCount, session?.user?.id, isOnline]),
  );

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") return undefined;

      const onBackPress = () => {
        if (showFiledCasesModal) {
          setShowFiledCasesModal(false);
          return true;
        }
        if (showCourtPortalModal) {
          setShowCourtPortalModal(false);
          return true;
        }
        BackHandler.exitApp();
        return true;
      };

      const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () => sub.remove();
    }, [showFiledCasesModal, showCourtPortalModal]),
  );

  useEffect(() => {
    if (!isOnline || !session?.user?.id || !isSupabaseConfigured) return;
    if (isOffline) fetchCases(true);
  }, [isOnline, isOffline, session?.user?.id, fetchCases]);

  const { hearingsToday, filedToday } = getTodayCases(cases, today);
  const { hearingsThisWeek, filedThisWeek } = getWeeklyCases(cases, weekStart, weekEnd);
  const filedThisMonth = useMemo(() => getMonthCases(cases, today), [cases, today]);

  const filedCases = useMemo(() => {
    if (filedRange === "today") return filedToday;
    if (filedRange === "week") return filedThisWeek;
    return filedThisMonth;
  }, [filedRange, filedToday, filedThisWeek, filedThisMonth]);

  const filedRangeLabel =
    filedRange === "today" ? "Today" : filedRange === "week" ? "This week" : "This month";

  const exportCapturePayload = useMemo(() => {
    if (!shareExportFilter) return null;
    return buildSharePayload(shareExportFilter, hearingsToday, hearingsThisWeek);
  }, [shareExportFilter, hearingsToday, hearingsThisWeek]);

  const shareCasesAsPdf = useCallback(
    async (shareFilter: HomeFilter) => {
      const { title, sections } = buildSharePayload(
        shareFilter,
        hearingsToday,
        hearingsThisWeek,
      );
      if (isExporting || sections.length === 0) return;
      setIsExporting(true);
      try {
        const available = await Sharing.isAvailableAsync();
        if (!available) {
          Alert.alert("Sharing unavailable", "Sharing is not available on this device.");
          return;
        }
        const html = buildCaseReportHtml(title, sections);
        const { uri } = await Print.printToFileAsync({ html });
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          UTI: "com.adobe.pdf",
          dialogTitle: `Share ${title} PDF`,
        });
      } catch (e: any) {
        Alert.alert("Export failed", e?.message || "Could not export PDF.");
      } finally {
        setIsExporting(false);
      }
    },
    [isExporting, hearingsToday, hearingsThisWeek],
  );

  const shareCasesAsImage = useCallback(
    async (shareFilter: HomeFilter) => {
      const { title, sections } = buildSharePayload(
        shareFilter,
        hearingsToday,
        hearingsThisWeek,
      );
      if (isExporting || sections.length === 0) return;
      setIsExporting(true);
      try {
        const available = await Sharing.isAvailableAsync();
        if (!available) {
          Alert.alert("Sharing unavailable", "Sharing is not available on this device.");
          return;
        }

        setShareExportFilter(shareFilter);
        await new Promise((resolve) => setTimeout(resolve, 100));

        if (!exportImageRef.current) {
          Alert.alert("Export failed", "Could not capture the case list.");
          return;
        }

        const uri = await captureRef(exportImageRef.current, {
          format: "png",
          quality: 1,
          result: "tmpfile",
        });
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          UTI: "public.png",
          dialogTitle: `Share ${title} image`,
        });
      } catch (e: any) {
        Alert.alert("Export failed", e?.message || "Could not export image.");
      } finally {
        setShareExportFilter(null);
        setIsExporting(false);
      }
    },
    [isExporting, hearingsToday, hearingsThisWeek],
  );

  const promptShareFormat = useCallback(
    (shareFilter: HomeFilter) => {
      const { sections } = buildSharePayload(shareFilter, hearingsToday, hearingsThisWeek);
      if (sections.length === 0) {
        Alert.alert(
          "No hearings to share",
          shareFilter === "today"
            ? "There are no hearings today."
            : "There are no hearings this week.",
        );
        return;
      }
      Alert.alert("Share case list", "Choose a format", [
        { text: "PDF", onPress: () => void shareCasesAsPdf(shareFilter) },
        { text: "Image", onPress: () => void shareCasesAsImage(shareFilter) },
        { text: "Cancel", style: "cancel" },
      ]);
    },
    [hearingsToday, hearingsThisWeek, shareCasesAsPdf, shareCasesAsImage],
  );

  const handleShareCases = useCallback(() => {
    if (isExporting) return;
    Alert.alert("Share case list", "Which list would you like to share?", [
      { text: "Today cases", onPress: () => promptShareFormat("today") },
      { text: "This week cases", onPress: () => promptShareFormat("weekly") },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [isExporting, promptShareFormat]);

  const openCourtPortalUrl = useCallback((entry: PakistanCourtPortal) => {
    const url = entry.url;
    const open = async () => {
      try {
        const canOpen = await Linking.canOpenURL(url);
        if (!canOpen) throw new Error("UNSUPPORTED_URL");
        await Linking.openURL(url);
      } catch {
        try {
          await WebBrowser.openBrowserAsync(url, {
            presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
          });
        } catch {
          Alert.alert("Error", "Could not open the court website.");
        }
      }
    };
    setTimeout(() => {
      void open();
    }, 150);
  }, []);

  const openCourtSearchWebsite = useCallback(() => {
    setShowCourtPortalModal(true);
  }, []);

  const openFromHome = useCallback(
    (pathname: string, params?: Record<string, string>) => {
      router.push({
        pathname,
        params: { ...params, from: "home" },
      } as never);
    },
    [router],
  );

  const widgets = useMemo<HomeWidget[]>(() => {
    const list: HomeWidget[] = [
      {
        key: "today-hearings",
        title: "Today cases",
        subtitle: "Open today's hearings",
        icon: "today",
        count: hearingsToday.length,
        tone: "warning",
        onPress: () => openFromHome("/cases-overview", { filter: "today" }),
      },
      {
        key: "week-hearings",
        title: "This week cases",
        subtitle: "Open weekly hearings",
        icon: "date-range",
        count: hearingsThisWeek.length,
        onPress: () => openFromHome("/cases-overview", { filter: "weekly" }),
      },
      // {
      //   key: "all-cases",
      //   title: "All cases",
      //   subtitle: "Open full diary",
      //   icon: "list-alt",
      //   onPress: () => openFromHome("/(tabs)/diary"),
      // },
      // {
      //   key: "add-case",
      //   title: "Add case",
      //   subtitle: "Create a new file",
      //   icon: "add-circle-outline",
      //   onPress: () => {
      //     if (!canAddCases) return;
      //     openFromHome("/add-case-flow");
      //   },
      //   disabled: !canAddCases,
      // },
      {
        key: "disposed-cases",
        title: "Disposed cases",
        subtitle: "Finished matters",
        icon: "archive",
        count: disposedCount,
        tone: "success",
        onPress: () => openFromHome("/disposed-cases"),
      },
      {
        key: "case-fees",
        title: "Case fees",
        subtitle: "Active & disposed",
        icon: "payments",
        count: feeCasesCount,
        onPress: () => openFromHome("/case-fees-overview"),
      },
      // {
      //   key: "calendar",
      //   title: "Calendar",
      //   subtitle: "Date-based view",
      //   icon: "calendar-month",
      //   onPress: () => openFromHome("/(tabs)/calendar"),
      // },
      {
        key: "filed-cases",
        title: "Filed cases",
        subtitle: "Today, week, month",
        icon: "description",
        count: filedToday.length,
        onPress: () => setShowFiledCasesModal(true),
      },
      {
        key: "judges",
        title: "Judges",
        subtitle: "Manage judge list",
        icon: "gavel",
        onPress: () => openFromHome("/judges"),
      },
      {
        key: "clients",
        title: "Clients",
        subtitle: "Manage client list",
        icon: "groups-2",
        onPress: () => openFromHome("/clients"),
      },
      // {
      //   key: "notes",
      //   title: "Notes",
      //   subtitle: "Active today",
      //   icon: "sticky-note-2",
      //   count: notesCount,
      //   onPress: () => openFromHome("/notes"),
      // },
      {
        key: "court-links",
        title: "Court links",
        subtitle: "Open court portals",
        icon: "public",
        onPress: openCourtSearchWebsite,
      },
      {
        key: "share",
        title: "Share list",
        subtitle: "Export hearings",
        icon: "share",
        onPress: handleShareCases,
        disabled: isExporting,
      },
      // {
      //   key: "settings",
      //   title: "Settings",
      //   subtitle: "Open app settings",
      //   icon: "settings",
      //   onPress: () => openFromHome("/settings"),
      // },
      {
        key: "acts",
        title: "Acts & law books",
        subtitle: "Reference library",
        icon: "menu-book",
        onPress: () => openFromHome("/acts"),
      },
      {
        key: "trash",
        title: "Trash",
        subtitle: "Restore deleted cases",
        icon: "delete-outline",
        onPress: () => openFromHome("/trash"),
      },
      {
        key: "subordinates",
        title: "Add subordinate",
        subtitle: "Manage team members",
        icon: "group-add",
        onPress: () => openFromHome("/subordinates"),
      },
    ];

    return list.filter((item) => {
      if (item.key === "clients") return can("view_clients");
      if (item.key === "judges") return canManageJudges;
      if (item.key === "disposed-cases") {
        return role !== "subordinate" ? can("view_cases") : can("dispose_cases");
      }
      if (item.key === "case-fees") {
        return isOwner;
      }
      if (item.key === "settings") {
        return isOwner;
      }
      if (item.key === "trash") {
        return isOwner || can("delete_cases");
      }
      if (item.key === "subordinates") {
        return isOwner;
      }
      return true;
    });
  }, [
    hearingsToday.length,
    hearingsThisWeek.length,
    filedToday.length,
    notesCount,
    disposedCount,
    feeCasesCount,
    canAddCases,
    canManageJudges,
    isOwner,
    role,
    can,
    handleShareCases,
    isExporting,
    openCourtSearchWebsite,
    openFromHome,
  ]);

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
            <ThemedText type="accent" style={styles.modalTitle}>Filed cases</ThemedText>
            <Bounceable style={styles.modalClose} onPress={() => setShowFiledCasesModal(false)}>
              <MaterialIcons name="close" size={20} color={C.textPrimary} />
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
              <ThemedText type="muted" style={styles.filedEmptyText}>
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
                  <ThemedText type="accent" style={styles.filedCaseTitle}>
                    {getCaseDisplayTitle(caseItem)}
                  </ThemedText>
                  <ThemedText type="secondary" style={styles.filedCaseMeta}>
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

  const toneColors = { warning: C.themeWarm, success: C.themeGreen } as const;

  const renderWidget = (widget: HomeWidget) => (
    (() => {
      const isSelectedWidget = selectedWidgetKey === widget.key;
      const handleWidgetPress = () => {
        setSelectedWidgetKey(widget.key);
        widget.onPress();
      };
      return (
    <Bounceable
      key={widget.key}
      style={[styles.widgetPressable, { width: widgetLayout.widgetWidth }]}
      onPress={handleWidgetPress}
      disabled={widget.disabled}
      accessibilityLabel={widget.title}
      activeScale={0.98}
    >
      <View
        style={[
          styles.widgetShadowShell,
          isSelectedWidget && styles.widgetShadowShellSelected,
        ]}
      >
        <View
          style={[
            styles.widgetCard,
            isSelectedWidget && styles.widgetCardSelected,
            widget.disabled && styles.widgetCardDisabled,
          ]}
        >
      <View style={styles.widgetTopRow}>
        <View
          style={[
            styles.widgetIconWrap,
            isSelectedWidget && styles.widgetIconWrapSelected,
          ]}
        >
          <MaterialIcons
            name={widget.icon}
            size={20}
            color={isSelectedWidget ? C.textAccent : C.textSecondary}
          />
        </View>
        {typeof widget.count === "number" && widget.count > 0 ? (
          <View
            style={[
              styles.widgetCountPill,
              widget.tone ? { backgroundColor: toneColors[widget.tone] + "22", borderWidth: 1, borderColor: toneColors[widget.tone] } : null,
            ]}
          >
            <ThemedText
              style={styles.widgetCountText}
              numberOfLines={1}
              lightColor={widget.tone ? toneColors[widget.tone] : undefined}
              darkColor={widget.tone ? toneColors[widget.tone] : undefined}
            >
              {widget.key === "notes" ? String(widget.count) : formatWidgetCount(widget.count)}
            </ThemedText>
          </View>
        ) : null}
      </View>
      <ThemedText
        type={isSelectedWidget ? "accent" : "defaultSemiBold"}
        style={styles.widgetTitle}
        numberOfLines={2}
      >
        {widget.title}
      </ThemedText>
      <ThemedText type="secondary" style={styles.widgetSubtitle} numberOfLines={2}>
        {widget.subtitle}
      </ThemedText>
        </View>
      </View>
    </Bounceable>
      );
    })()
  );

  const headerActions = (
    <View style={styles.headerActions}>
      <Bounceable
        onPress={() => router.push("/notes")}
        style={styles.notesHeaderButton}
        accessibilityLabel="Open notes"
      >
        <MaterialIcons name="sticky-note-2" size={16} color={C.pureWhite} />
        <ThemedText style={styles.notesHeaderButtonText}>Notes</ThemedText>
        {notesCount > 0 ? (
          <View style={styles.notesCountBadge}>
            <ThemedText style={styles.notesCountText}>
              {String(notesCount)}
            </ThemedText>
          </View>
        ) : null}
      </Bounceable>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScreenHeader title="Dashboard" showBack={false} rightComponent={headerActions} />

      {pendingCount > 0 ? (
        <View style={styles.pendingBanner}>
          <MaterialIcons name="cloud-upload" size={18} color={C.zodiacColour} />
          <ThemedText type="default" style={styles.pendingBannerText}>
            {pendingCount} case{pendingCount !== 1 ? "s" : ""} waiting to sync
          </ThemedText>
        </View>
      ) : null}

      <Animated.ScrollView
        entering={FadeInUp.duration(300)}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={fetchCases}
            colors={[C.black]}
            tintColor={C.black}
          />
        }
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          {isOffline ? (
            <View style={styles.offlineBadge}>
              <MaterialIcons name="cloud-off" size={15} color={C.themeRed} />
              <ThemedText type="default" style={styles.offlineText}>Offline mode: showing cached data</ThemedText>
            </View>
          ) : null}
          {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}

          <View style={styles.widgetsGrid}>{widgets.map(renderWidget)}</View>
        </View>
      </Animated.ScrollView>

      <View pointerEvents="none" style={styles.exportCaptureRoot}>
        <View
          ref={exportImageRef}
          collapsable={false}
          style={
            exportCapturePayload
              ? [styles.exportCaptureCanvas, { width: Math.max(screenWidth - 48, 280) }]
              : undefined
          }
        >
          {exportCapturePayload ? (
            <>
              <ThemedText type="accent" style={styles.exportCaptureHeading}>{exportCapturePayload.title}</ThemedText>
              {exportCapturePayload.sections.map((section) => (
                <View key={`export-${section.title}`} style={styles.exportSection}>
                  <ThemedText type="accent" style={styles.exportSectionTitle}>{section.title}</ThemedText>
                  {section.data.map((caseItem) => (
                    <View key={`export-row-${caseItem.id}`} style={styles.exportRow}>
                      <ThemedText type="accent" style={styles.exportRowTitle}>
                        {getCaseDisplayTitle(caseItem)}
                      </ThemedText>
                      <ThemedText type="secondary" style={styles.exportRowMeta}>
                        Case no: {caseItem.case_number?.trim() || "—"}
                      </ThemedText>
                      <ThemedText type="secondary" style={styles.exportRowMeta}>
                        Court: {caseItem.court_name?.trim() || "—"}
                      </ThemedText>
                      <ThemedText type="secondary" style={styles.exportRowMeta}>
                        Next: {formatCaseDate(caseItem.next_hearing_date)}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              ))}
            </>
          ) : null}
        </View>
      </View>

      {filedCasesModal}
      <CourtPortalBottomSheet
        visible={showCourtPortalModal}
        onClose={() => setShowCourtPortalModal(false)}
        onOpenPortal={openCourtPortalUrl}
      />
    </SafeAreaView>
  );
}

function createHomeStyles(C: AppColors, modalSheet: string) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: C.background,
    },
    scrollContent: {
      paddingBottom: 30,
    },
    container: {
      paddingHorizontal: 20,
      paddingTop: 14,
      backgroundColor: C.background,
    },
    offlineBadge: {
      marginBottom: 10,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
      backgroundColor: C.themeRed + "12",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    offlineText: {
      fontSize: 12,
      color: C.themeRed,
      fontWeight: "600",
    },
    pendingBanner: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 16,
      backgroundColor: C.zodiacColour + "20",
      marginHorizontal: 20,
      marginTop: 8,
      borderRadius: 8,
    },
    pendingBannerText: {
      fontSize: 14,
      color: C.zodiacColour,
      fontWeight: "500",
    },
    widgetsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: WIDGET_GRID_GAP,
    },
    widgetPressable: {
      borderRadius: 14,
    },
    widgetShadowShell: {
      borderRadius: 14,
      backgroundColor: C.pureWhite,
      borderWidth: 1,
      borderColor: C.borderGray,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 4,
        },
        android: {
          elevation: 3,
        },
        default: {},
      }),
    },
    widgetShadowShellSelected: {
      borderColor: C.zodiacColour,
    },
    widgetCard: {
      borderRadius: 14,
      padding: 12,
      backgroundColor: "transparent",
      minHeight: 114,
    },
    widgetCardSelected: {
      backgroundColor: C.zodiacColour + "12",
    },
    widgetCardDisabled: {
      opacity: 0.5,
    },
    widgetTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },
    widgetIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: C.grey100,
      alignItems: "center",
      justifyContent: "center",
    },
    widgetIconWrapSelected: {
      backgroundColor: C.pureWhite,
    },
    widgetCountPill: {
      minWidth: 22,
      minHeight: 22,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.themeBlack,
    },
    widgetCountText: {
      fontSize: 11,
      color: C.textInverse,
      fontWeight: "700",
      lineHeight: 14,
      includeFontPadding: false,
    },
    widgetTitle: {
      fontSize: 14,
      fontWeight: "700",
      flexShrink: 1,
    },
    widgetSubtitle: {
      marginTop: 4,
      fontSize: 12,
      lineHeight: 16,
      flexShrink: 1,
    },
    errorText: {
      color: C.themeRed,
      marginBottom: 10,
      fontSize: 13,
    },
    headerActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    notesHeaderButton: {
      position: "relative",
      minWidth: 76,
      minHeight: 34,
      borderRadius: 17,
      backgroundColor: C.zodiacColour,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 4,
      paddingHorizontal: 10,
      ...theme.shadow,
    },
    notesHeaderButtonText: {
      color: C.textInverse,
      fontSize: 12,
      fontWeight: "700",
    },
    notesCountBadge: {
      position: "absolute",
      top: -4,
      right: -4,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: C.themeRed,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 3,
    },
    notesCountText: {
      fontSize: 9,
      lineHeight: 10,
      textAlign: "center",
      includeFontPadding: false,
      color: C.textInverse,
      fontWeight: "700",
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
      paddingHorizontal: 10,
    },
    filedRangeBtnTextActive: {
      color: C.textInverse,
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
      marginBottom: 4,
    },
    filedCaseMeta: {
      fontSize: 12,
    },
    filedEmptyText: {
      fontSize: 13,
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
      marginBottom: 12,
    },
    exportSection: {
      marginBottom: 14,
    },
    exportSectionTitle: {
      fontSize: 13,
      fontWeight: "700",
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
      marginBottom: 2,
    },
    exportRowMeta: {
      fontSize: 12,
    },
  });
}

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useIsFocused } from "@react-navigation/native";
import { Image } from "expo-image";
import * as Print from "expo-print";
import { useFocusEffect, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  InteractionManager,
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
import Animated, {
  FadeInUp,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { CopilotStep, useCopilot, walkthroughable } from "react-native-copilot";

import { CaseCard } from "@/components/case-card";
import { CourtPortalBottomSheet } from "@/components/court-portal-bottom-sheet";
import { ThemedText } from "@/components/themed-text";
import { Bounceable, Spacer } from "@/components/ui";
import { ScreenHeader } from "@/components/ui/screen-header";
import {
  type AppColors,
  modalSheetBackground,
} from "@/constants/color-palette";
import { type PakistanCourtPortal } from "@/constants/court-cms";
import { theme } from "@/constants/theme";
import { useAppTheme } from "@/context/app-theme-context";
import { useAuth } from "@/context/auth-context";
import { useIsOnline } from "@/hooks/use-is-online";
import { useThemePalette } from "@/hooks/use-theme-palette";
import { getActivityNotesStorageKey, sanitizeActivityNotes } from "@/lib/activity-notes";
import { getCachedCases, removeCachedCase, setCachedCases } from "@/lib/cases-cache";
import { addPendingCaseDelete, getPendingCasesCount } from "@/lib/offline-queue";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { CaseRow } from "@/types/case";
import { formatCaseDate, getCaseDisplayTitle, getTodayISO, getWeekBounds } from "@/types/case";
import type { ProfileRow } from "@/types/profile";

const WalkthroughableView = walkthroughable(View);

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

function buildCaseReportHtml(
  reportTitle: string,
  sections: CaseSection[],
): string {
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

export default function HomeScreen() {
  const isFocused = useIsFocused();
  const isOnline = useIsOnline();
  const { start } = useCopilot();
  const router = useRouter();
  const { session, signOut, effectiveOwnerId, can } = useAuth();
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [filter, setFilter] = useState<HomeFilter>("today");
  const [pendingCount, setPendingCount] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [notesCount, setNotesCount] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarMounted, setIsSidebarMounted] = useState(false);
  const [showCourtPortalModal, setShowCourtPortalModal] = useState(false);
  const [showFiledCasesModal, setShowFiledCasesModal] = useState(false);
  const [filedRange, setFiledRange] = useState<FiledRange>("today");
  const [sidebarProfile, setSidebarProfile] = useState<
    Pick<ProfileRow, "full_name" | "first_name" | "last_name" | "email" | "avatar_url"> | null
  >(null);
  const exportImageRef = useRef<View | null>(null);
  const { width: screenWidth } = useWindowDimensions();
  const sidebarWidth = Math.min(screenWidth * 0.78, 320);
  const sidebarTranslateX = useSharedValue(-(sidebarWidth + 24));
  const sidebarBackdropOpacity = useSharedValue(0);
  const C = useThemePalette();
  const { isDark } = useAppTheme();
  const modalSheet = modalSheetBackground(C, isDark);
  const styles = useMemo(
    () => createHomeStyles(C, modalSheet),
    [C, modalSheet],
  );

  const canTrashCase = can("edit_cases") && can("delete_cases");

  const canAddCases = can("add_cases");

  const today = getTodayISO();
  const { weekStart, weekEnd } = getWeekBounds();

  const sidebarPanelAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sidebarTranslateX.value }],
  }));
  const sidebarBackdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: sidebarBackdropOpacity.value,
  }));

  const openSidebar = useCallback(() => {
    if (isSidebarOpen) return;
    sidebarTranslateX.value = -(sidebarWidth + 24);
    sidebarBackdropOpacity.value = 0;
    setIsSidebarMounted(true);
    setIsSidebarOpen(true);
  }, [isSidebarOpen, sidebarBackdropOpacity, sidebarTranslateX, sidebarWidth]);

  const closeSidebar = useCallback(() => {
    if (!isSidebarMounted) return;
    setIsSidebarOpen(false);
    sidebarBackdropOpacity.value = withTiming(0, { duration: 180 });
    sidebarTranslateX.value = withTiming(
      -(sidebarWidth + 24),
      { duration: 220 },
      (finished) => {
        if (finished) runOnJS(setIsSidebarMounted)(false);
      },
    );
  }, [isSidebarMounted, sidebarBackdropOpacity, sidebarTranslateX, sidebarWidth]);

  const closeSidebarImmediately = useCallback(() => {
    setIsSidebarOpen(false);
    setIsSidebarMounted(false);
    sidebarBackdropOpacity.value = 0;
    sidebarTranslateX.value = -(sidebarWidth + 24);
  }, [sidebarBackdropOpacity, sidebarTranslateX, sidebarWidth]);

  useEffect(() => {
    if (!isSidebarMounted || !isSidebarOpen) return;
    sidebarBackdropOpacity.value = withTiming(1, { duration: 180 });
    sidebarTranslateX.value = withTiming(0, { duration: 220 });
  }, [isSidebarMounted, isSidebarOpen, sidebarBackdropOpacity, sidebarTranslateX]);

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

      // Only show loading if not silent
      if (!isSilent) {
        setLoading(true);
      }
      setError(null);
      setIsOffline(false);
      const { data, error: e } = await supabase
        .from("cases")
        .select("*")
        .eq("user_id", effectiveOwnerId)
        .is("deleted_at", null)
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
      setNotesCount(sanitized.length);
      if (Array.isArray(parsed) && sanitized.length !== parsed.length) {
        await AsyncStorage.setItem(notesStorageKey, JSON.stringify(sanitized));
      }
    } catch {
      setNotesCount(0);
    }
  }, [notesStorageKey, today]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      let copilotStartTimeout: ReturnType<typeof setTimeout> | null = null;
      let raf1 = 0;
      let raf2 = 0;
      let interactionTask: { cancel?: () => void } | null = null;
      (async () => {
        await loadNotesCount();
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
        const hasSeenTour = await AsyncStorage.getItem(
          "hasSeenHomeTourCopilot",
        );
        if (!hasSeenTour) {
          copilotStartTimeout = setTimeout(() => {
            if (cancelled) return;
            interactionTask = InteractionManager.runAfterInteractions(() => {
              if (cancelled) return;
              raf1 = requestAnimationFrame(() => {
                if (cancelled) return;
                raf2 = requestAnimationFrame(() => {
                  if (cancelled) return;
                  start();
                  AsyncStorage.setItem("hasSeenHomeTourCopilot", "true");
                });
              });
            });
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
    }, [fetchCases, loadNotesCount, start, session?.user?.id, isOnline]),
  );

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") return undefined;

      const onBackPress = () => {
        // Close transient overlays first; otherwise leave app instead of navigating to auth stack.
        if (isSidebarOpen || isSidebarMounted) {
          closeSidebar();
          return true;
        }
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
    }, [isSidebarOpen, isSidebarMounted, closeSidebar, showFiledCasesModal, showCourtPortalModal]),
  );

  // Refetch when coming back online (smooth transition, no flicker)
  useEffect(() => {
    if (!isOnline || !session?.user?.id || !isSupabaseConfigured) return;
    if (isOffline) {
      fetchCases(true);
    }
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
  const { hearingsThisWeek, filedThisWeek } = getWeeklyCases(
    cases,
    weekStart,
    weekEnd,
  );
  const filedThisMonth = useMemo(() => getMonthCases(cases, today), [cases, today]);

  const isTodayFilter = filter === "today";
  const hasAnyToday = hearingsToday.length > 0;
  const hasAnyWeekly = hearingsThisWeek.length > 0;
  const hasAny = isTodayFilter ? hasAnyToday : hasAnyWeekly;
  const sections = useMemo<CaseSection[]>(() => {
    const result: CaseSection[] = [];
    if (isTodayFilter) {
      if (hearingsToday.length > 0) {
        result.push({ title: "Hearings today", data: hearingsToday });
      }
    } else {
      if (hearingsThisWeek.length > 0) {
        result.push({ title: "Hearings this week", data: hearingsThisWeek });
      }
    }
    return result;
  }, [isTodayFilter, hearingsToday, hearingsThisWeek]);
  const filedCases = useMemo(() => {
    if (filedRange === "today") return filedToday;
    if (filedRange === "week") return filedThisWeek;
    return filedThisMonth;
  }, [filedRange, filedToday, filedThisWeek, filedThisMonth]);
  const filedRangeLabel =
    filedRange === "today" ? "Today" : filedRange === "week" ? "This week" : "This month";
  const shareSections = useMemo<CaseSection[]>(() => {
    if (isTodayFilter) {
      return hearingsToday.length > 0
        ? [{ title: "Hearings today", data: hearingsToday }]
        : [];
    }
    return hearingsThisWeek.length > 0
      ? [{ title: "Hearings this week", data: hearingsThisWeek }]
      : [];
  }, [isTodayFilter, hearingsToday, hearingsThisWeek]);
  const hasShareableHearings = shareSections.length > 0;

  const shareCasesAsPdf = useCallback(async () => {
    if (isExporting || shareSections.length === 0) return;
    setIsExporting(true);
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert("Sharing unavailable", "Sharing is not available on this device.");
        return;
      }
      const reportTitle = isTodayFilter ? "Today Hearings" : "This Week Hearings";
      const html = buildCaseReportHtml(reportTitle, shareSections);
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        UTI: "com.adobe.pdf",
        dialogTitle: `Share ${reportTitle} PDF`,
      });
    } catch (e: any) {
      Alert.alert("Export failed", e?.message || "Could not export PDF.");
    } finally {
      setIsExporting(false);
    }
  }, [isExporting, shareSections, isTodayFilter]);

  const shareCasesAsImage = useCallback(async () => {
    if (isExporting || shareSections.length === 0) return;
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

      // Allow one frame so hidden export view has the latest layout.
      await new Promise((resolve) => setTimeout(resolve, 80));
      const uri = await captureRef(exportImageRef.current, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });
      const reportTitle = isTodayFilter ? "Today Hearings" : "This Week Hearings";
      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        UTI: "public.png",
        dialogTitle: `Share ${reportTitle} image`,
      });
    } catch (e: any) {
      Alert.alert("Export failed", e?.message || "Could not export image.");
    } finally {
      setIsExporting(false);
    }
  }, [isExporting, shareSections.length, isTodayFilter]);

  const handleShareCases = useCallback(() => {
    if (isExporting) return;
    if (shareSections.length === 0) {
      Alert.alert(
        "No hearings to share",
        isTodayFilter
          ? "There are no hearings today."
          : "There are no hearings this week.",
      );
      return;
    }
    Alert.alert("Share case list", "Choose a format", [
      { text: "PDF", onPress: () => void shareCasesAsPdf() },
      { text: "Image", onPress: () => void shareCasesAsImage() },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [isExporting, shareSections.length, isTodayFilter, shareCasesAsPdf, shareCasesAsImage]);

  const openCourtPortalUrl = useCallback((entry: PakistanCourtPortal) => {
    const url = entry.url;

    const open = async () => {
      try {
        const canOpen = await Linking.canOpenURL(url);
        if (!canOpen) {
          throw new Error("UNSUPPORTED_URL");
        }
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

  const openCourtSearchWebsite = useCallback(async () => {
    try {
      setShowCourtPortalModal(true);
    } catch {
      Alert.alert("Error", "Could not open court search options.");
    }
  }, []);

  useEffect(() => {
    if (!session?.user?.id || !isSupabaseConfigured) {
      setSidebarProfile(null);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("full_name, first_name, last_name, email, avatar_url")
          .eq("id", session.user.id)
          .maybeSingle();
        if (mounted) setSidebarProfile(data ?? null);
      } catch {
        if (mounted) setSidebarProfile(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [session?.user?.id]);

  const sidebarDisplayName = useMemo(() => {
    if (sidebarProfile?.full_name?.trim()) return sidebarProfile.full_name.trim();
    const first = sidebarProfile?.first_name?.trim() ?? "";
    const last = sidebarProfile?.last_name?.trim() ?? "";
    const full = [first, last].filter(Boolean).join(" ").trim();
    if (full) return full;
    const metadataName =
      (session?.user?.user_metadata?.full_name as string | undefined)?.trim() ||
      (session?.user?.user_metadata?.name as string | undefined)?.trim();
    return metadataName || "User";
  }, [sidebarProfile, session?.user?.user_metadata]);

  const sidebarEmail = useMemo(() => {
    return sidebarProfile?.email?.trim() || session?.user?.email?.trim() || "No email";
  }, [sidebarProfile?.email, session?.user?.email]);

  const sidebarAvatarUrl = useMemo(() => {
    const metadataAvatar =
      (session?.user?.user_metadata?.avatar_url as string | undefined)?.trim() ||
      (session?.user?.user_metadata?.picture as string | undefined)?.trim();
    return sidebarProfile?.avatar_url?.trim() || metadataAvatar || "";
  }, [sidebarProfile?.avatar_url, session?.user?.user_metadata]);

  const sidebarInitials = useMemo(() => {
    const source =
      sidebarDisplayName && sidebarDisplayName !== "User" ? sidebarDisplayName : sidebarEmail;
    const parts = source
      .replace("@", " ")
      .split(/\s+/)
      .filter(Boolean);
    if (parts.length === 0) return "U";
    if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }, [sidebarDisplayName, sidebarEmail]);

  const shareButton = hasShareableHearings ? (
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
  ) : null;

  const notesHeaderButton = (
    <CopilotStep
      text="Tap Notes to add and manage your daily notes."
      order={2}
      name="home-notes"
      active={isFocused}
    >
      <WalkthroughableView collapsable={false}>
        <Bounceable
          style={styles.notesHeaderButton}
          onPress={() => router.push("/notes")}
          accessibilityLabel="Open notes"
        >
          <MaterialIcons name="sticky-note-2" size={16} color={C.pureWhite} />
          <ThemedText style={styles.notesHeaderButtonText}>Notes</ThemedText>
          {notesCount > 0 ? (
            <View style={styles.notesCountBadge}>
              <ThemedText style={styles.notesCountText}>
                {notesCount > 99 ? "99+" : String(notesCount)}
              </ThemedText>
            </View>
          ) : null}
        </Bounceable>
      </WalkthroughableView>
    </CopilotStep>
  );
  const menuHeaderButton = (
    <Bounceable
      onPress={openSidebar}
      style={styles.menuHeaderButton}
      accessibilityLabel="Open menu"
    >
      <MaterialIcons name="menu" size={21} color={C.black} />
    </Bounceable>
  );
  const headerActions = (
    <View style={styles.headerActions}>
      {shareButton}
      {notesHeaderButton}
    </View>
  );
  const sidebarMenu = (
    <Modal
      visible={isSidebarMounted}
      transparent
      animationType="none"
      onRequestClose={closeSidebar}
    >
      <View style={styles.sidebarOverlay}>
        <Animated.View
          style={[styles.sidebarBackdrop, sidebarBackdropAnimatedStyle]}
          pointerEvents="box-none"
        >
          <Pressable style={StyleSheet.absoluteFillObject} onPress={closeSidebar} />
        </Animated.View>
        <Animated.View
          style={[
            styles.sidebarPanel,
            { width: sidebarWidth },
            sidebarPanelAnimatedStyle,
          ]}
        >
          <View style={styles.sidebarMainItems}>
            <View style={styles.sidebarHeader}>
              <View style={styles.sidebarProfileInfo}>
                <View style={styles.sidebarAvatarWrap}>
                  {sidebarAvatarUrl ? (
                    <Image
                      source={{ uri: sidebarAvatarUrl }}
                      style={styles.sidebarAvatarImage}
                      contentFit="cover"
                    />

                  ) : (
                    <ThemedText style={styles.sidebarAvatarInitials}>
                      {sidebarInitials}
                    </ThemedText>
                  )}
                </View>
                <View style={styles.sidebarProfileTextWrap}>
                  <ThemedText style={styles.sidebarProfileName} numberOfLines={1}>
                    {sidebarDisplayName}
                  </ThemedText>
                  <ThemedText style={styles.sidebarProfileEmail} numberOfLines={1}>
                    {sidebarEmail}
                  </ThemedText>
                </View>
              </View>
              <Bounceable
                style={styles.sidebarCloseButton}
                onPress={closeSidebar}
              >
                <MaterialIcons name="close" size={20} color={C.black} />
              </Bounceable>
            </View>
            <View style={styles.sidebarDivider} />

            <Bounceable
              style={styles.sidebarItem}
              onPress={() => {
                closeSidebar();
                router.push("/notes");
              }}
            >
              <MaterialIcons name="sticky-note-2" size={19} color={C.black} />
              <ThemedText style={styles.sidebarItemText}>Notes</ThemedText>
            </Bounceable>

            {can("view_clients") ? (
              <Bounceable
                style={styles.sidebarItem}
                onPress={() => {
                  closeSidebar();
                  router.push("/clients");
                }}
              >
                <MaterialIcons name="groups-2" size={19} color={C.black} />
                <ThemedText style={styles.sidebarItemText}>Manage clients list</ThemedText>
              </Bounceable>
            ) : null}

            {can("add_cases") || can("edit_cases") ? (
              <Bounceable
                style={styles.sidebarItem}
                onPress={() => {
                  closeSidebar();
                  router.push("/judges");
                }}
              >
                <MaterialIcons name="gavel" size={19} color={C.black} />
                <ThemedText style={styles.sidebarItemText}>Manage judges list</ThemedText>
              </Bounceable>
            ) : null}

            <Bounceable
              style={styles.sidebarItem}
              onPress={() => {
                closeSidebar();
                handleShareCases();
              }}
            >
              <MaterialIcons name="share" size={19} color={C.black} />
              <ThemedText style={styles.sidebarItemText}>Share case list</ThemedText>
            </Bounceable>

            <Bounceable
              style={styles.sidebarItem}
              onPress={() => {
                closeSidebarImmediately();
                void openCourtSearchWebsite();
              }}
            >
              <MaterialIcons name="public" size={19} color={C.black} />
              <ThemedText style={styles.sidebarItemText}>Court links</ThemedText>
            </Bounceable>

            {can("manage_settings") ? (
              <>
                <Bounceable
                  style={styles.sidebarItem}
                  onPress={() => {
                    closeSidebar();
                    router.push("/acts");
                  }}
                >
                  <MaterialIcons name="menu-book" size={19} color={C.black} />
                  <ThemedText style={styles.sidebarItemText}>Acts & law books</ThemedText>
                </Bounceable>

                <Bounceable
                  style={styles.sidebarItem}
                  onPress={() => {
                    closeSidebar();
                    router.push("/trash");
                  }}
                >
                  <MaterialIcons name="delete-outline" size={19} color={C.black} />
                  <ThemedText style={styles.sidebarItemText}>Trash</ThemedText>
                </Bounceable>
              </>
            ) : null}
          </View>

          <View style={styles.sidebarBottomAction}>
            <Bounceable
              style={[styles.sidebarItem, styles.sidebarItemDanger]}
              onPress={() => {
                closeSidebar();
                Alert.alert("Sign out?", "You can sign in again anytime.", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Sign out", style: "destructive", onPress: () => void signOut() },
                ]);
              }}
            >
              <MaterialIcons name="logout" size={19} color={C.themeRed} />
              <ThemedText style={styles.sidebarItemDangerText}>Sign out</ThemedText>
            </Bounceable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
  const filedCasesButton = (
    <CopilotStep
      text="Tap Filed cases to quickly view cases filed today, this week, or this month."
      order={3}
      name="home-filed-cases"
      active={isFocused}
    >
      <WalkthroughableView collapsable={false}>
        <View style={styles.filedCasesRow}>
          <Bounceable
            style={styles.filedCasesBtn}
            onPress={() => setShowFiledCasesModal(true)}
          >
            <MaterialIcons name="description" size={15} color={C.black} />
            <ThemedText style={styles.filedCasesBtnText}>Filed cases</ThemedText>
            <MaterialIcons name="keyboard-arrow-down" size={16} color={C.black} />
          </Bounceable>
        </View>
      </WalkthroughableView>
    </CopilotStep>
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
              const label = range === "today" ? "Today" : range === "week" ? "This week" : "This month";
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

  if (loading && cases.length === 0 && !isOffline) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ScreenHeader
          title="Home"
          showBack={false}
          leftComponent={menuHeaderButton}
          rightComponent={headerActions}
        />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={C.black} />
        </View>
        {sidebarMenu}
        <CourtPortalBottomSheet
          visible={showCourtPortalModal}
          onClose={() => setShowCourtPortalModal(false)}
          onOpenPortal={openCourtPortalUrl}
        />
      </SafeAreaView>
    );
  }

  if (error && cases.length === 0 && !isOffline) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ScreenHeader
          title="Home"
          showBack={false}
          leftComponent={menuHeaderButton}
          rightComponent={headerActions}
        />
        <View style={styles.container}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </View>
        {sidebarMenu}
        <CourtPortalBottomSheet
          visible={showCourtPortalModal}
          onClose={() => setShowCourtPortalModal(false)}
          onOpenPortal={openCourtPortalUrl}
        />
      </SafeAreaView>
    );
  }

  if (!hasAny) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <CopilotStep
          text="This is your dashboard where you can see all your upcoming hearings and filings."
          order={1}
          name="welcome"
          active={isFocused}
        >
          <WalkthroughableView collapsable={false}>
            <ScreenHeader
              title={isTodayFilter ? "Today" : "This week"}
              showBack={false}
              leftComponent={menuHeaderButton}
              rightComponent={headerActions}
            />
          </WalkthroughableView>
        </CopilotStep>
        {pendingCount > 0 && (
          <View style={styles.pendingBanner}>
            <MaterialIcons
              name="cloud-upload"
              size={18}
              color={C.zodiacColour}
            />
            <ThemedText style={styles.pendingBannerText}>
              {pendingCount} case{pendingCount !== 1 ? "s" : ""} waiting to sync
            </ThemedText>
          </View>
        )}
        <View style={styles.container}>
          {filedCasesButton}
          <View style={styles.filterRow}>
            <CopilotStep
              text="Tap here to see only today's cases."
              order={4}
              name="filter-today"
              active={isFocused}
            >
              <WalkthroughableView style={{ width: "45%" }} collapsable={false}>
                <Pressable
                  style={[
                    styles.filterBtn,
                    isTodayFilter && styles.filterBtnActive,
                  ]}
                  onPress={() => setFilter("today")}
                >
                  <ThemedText
                    style={[
                      styles.filterBtnText,
                      isTodayFilter && styles.filterBtnTextActive,
                    ]}
                  >
                    Today
                  </ThemedText>
                </Pressable>
              </WalkthroughableView>
            </CopilotStep>

            <CopilotStep
              text="Tap here to see this week's hearings and filings."
              order={5}
              name="filter-weekly"
              active={isFocused}
            >
              <WalkthroughableView style={{ width: "45%" }} collapsable={false}>
                <Pressable
                  style={[
                    styles.filterBtn,
                    !isTodayFilter && styles.filterBtnActive,
                  ]}
                  onPress={() => setFilter("weekly")}
                >
                  <ThemedText
                    style={[
                      styles.filterBtnText,
                      !isTodayFilter && styles.filterBtnTextActive,
                    ]}
                  >
                    Weekly
                  </ThemedText>
                </Pressable>
              </WalkthroughableView>
            </CopilotStep>
          </View>
          <Spacer.Column numberOfSpaces={10} />
          <View style={styles.card}>
            <View style={styles.iconCircle}>
              <MaterialIcons
                name={isOffline ? "cloud-off" : "today"}
                size={40}
                color={C.zodiacColour}
              />
            </View>
            <ThemedText style={styles.heading}>
              {isOffline
                ? "You're offline"
                : isTodayFilter
                  ? "Nothing for today"
                  : "Nothing this week"}
            </ThemedText>
            <ThemedText style={styles.subtext}>
              {isOffline
                ? "Your cases will appear when you're connected. Cases you add while offline will sync automatically."
                : isTodayFilter
                  ? "Cases with a hearing today will appear here."
                  : "Cases with a hearing this week will appear here."}
            </ThemedText>
            <CopilotStep
              text="Tap here to start adding your cases and stay organized."
              order={6}
              name="add-case"
              active={isFocused}
            >
              <WalkthroughableView collapsable={false}>
                <Bounceable
                  style={styles.addButton}
                  disabled={!canAddCases}
                  haptic={canAddCases}
                  onPress={() => {
                    if (!canAddCases) return;
                    router.push("/add-case-flow");
                  }}
                >
                  <MaterialIcons name="add" size={22} color={C.pureWhite} />
                  <ThemedText style={styles.addButtonText}>Add Case</ThemedText>
                </Bounceable>
              </WalkthroughableView>
            </CopilotStep>
            <Bounceable
              style={styles.diaryLink}
              onPress={() => router.push("/(tabs)/diary")}
            >
              <ThemedText style={styles.diaryLinkText}>
                View all cases
              </ThemedText>
              <MaterialIcons
                name="chevron-right"
                size={20}
                color={C.black}
              />
            </Bounceable>
          </View>
        </View>
        {sidebarMenu}
        {filedCasesModal}
        <CourtPortalBottomSheet
          visible={showCourtPortalModal}
          onClose={() => setShowCourtPortalModal(false)}
          onOpenPortal={openCourtPortalUrl}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <CopilotStep
        text="This is your dashboard where you can see all your upcoming hearings and filings."
        order={1}
        name="welcome"
        active={isFocused}
      >
        <WalkthroughableView collapsable={false}>
          <ScreenHeader
            title={isTodayFilter ? "Today Cases" : "This week Cases"}
            showBack={false}
            leftComponent={menuHeaderButton}
            rightComponent={headerActions}
          />
        </WalkthroughableView>
      </CopilotStep>
      {pendingCount > 0 && (
        <View style={styles.pendingBanner}>
          <MaterialIcons
            name="cloud-upload"
            size={18}
            color={C.zodiacColour}
          />
          <ThemedText style={styles.pendingBannerText}>
            {pendingCount} case{pendingCount !== 1 ? "s" : ""} waiting to sync
          </ThemedText>
        </View>
      )}
      <Animated.View
        style={{ flex: 1 }}
        entering={FadeInUp.duration(400).springify().damping(20)}
      >
        <View style={styles.container}>
          <Spacer.Column numberOfSpaces={4} />
          {filedCasesButton}

          <View style={styles.filterRow}>
            <CopilotStep
              text="Tap here to see only today's cases."
              order={4}
              name="filter-today"
              active={isFocused}
            >
              <WalkthroughableView style={styles.filterBtnWrapper} collapsable={false}>
                <Pressable
                  style={[
                    styles.filterBtn,
                    isTodayFilter && styles.filterBtnActive,
                  ]}
                  onPress={() => setFilter("today")}
                >
                  <ThemedText
                    style={[
                      styles.filterBtnText,
                      isTodayFilter && styles.filterBtnTextActive,
                    ]}
                  >
                    Today
                  </ThemedText>
                </Pressable>
              </WalkthroughableView>
            </CopilotStep>

            <CopilotStep
              text="Tap here to see this week's hearings and filings."
              order={5}
              name="filter-weekly"
              active={isFocused}
            >
              <WalkthroughableView style={styles.filterBtnWrapper} collapsable={false}>
                <Pressable
                  style={[
                    styles.filterBtn,
                    !isTodayFilter && styles.filterBtnActive,
                  ]}
                  onPress={() => setFilter("weekly")}
                >
                  <ThemedText
                    style={[
                      styles.filterBtnText,
                      !isTodayFilter && styles.filterBtnTextActive,
                    ]}
                  >
                    Weekly
                  </ThemedText>
                </Pressable>
              </WalkthroughableView>
            </CopilotStep>
          </View>
          <Spacer.Column numberOfSpaces={5} />
          <Animated.ScrollView
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
            {sections.map((section, sectionIndex) => {
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
                      walkthroughEnabled={previousItemsCount + itemIndex === 0}
                      walkthroughContext="home-case-actions"
                      walkthroughActive={isFocused}
                    />
                  ))}
                </View>
              );
            })}
          </Animated.ScrollView>
        </View>
      </Animated.View>
      <View pointerEvents="none" style={styles.exportCaptureRoot}>
        <View
          ref={exportImageRef}
          collapsable={false}
          style={[
            styles.exportCaptureCanvas,
            { width: Math.max(screenWidth - 48, 280) },
          ]}
        >
          <ThemedText style={styles.exportCaptureHeading}>
            {isTodayFilter ? "Today Hearings" : "This Week Hearings"}
          </ThemedText>
          {shareSections.map((section) => (
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
      {sidebarMenu}
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
  pendingBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: C.zodiacColour + "20",
    marginHorizontal: 24,
    marginTop: 8,
    borderRadius: 8,
  },
  pendingBannerText: {
    fontSize: 14,
    color: C.zodiacColour,
    fontWeight: "500",
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
  title: {
    marginBottom: 12,
    alignSelf: "center",
    color: C.black,
    backgroundColor: C.background,
  },
  filterRow: {
    flexDirection: "row",
    backgroundColor: "transparent",
    width: "100%",
    paddingVertical: 10,
    justifyContent: "space-around",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.borderGray,
  },
  filterBtnWrapper: {
    width: "45%",
  },
  filterBtn: {
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
  errorText: {
    color: C.themeRed,
    marginTop: 8,
  },
  shareButton: {
    minWidth: 34,
    minHeight: 34,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
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
    color: C.pureWhite,
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
    color: C.pureWhite,
    fontWeight: "700",
  },
  menuHeaderButton: {
    minWidth: 34,
    minHeight: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.background,
  },
  sidebarOverlay: {
    flex: 1,
    justifyContent: "center",
  },
  sidebarBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  sidebarPanel: {
    backgroundColor: modalSheet,
    minHeight: 360,
    height: "80%",
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,

  },
  sidebarMainItems: {
    flex: 1,
  },
  sidebarBottomAction: {
    paddingTop: 8,
  },
  sidebarHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
    gap: 10,
  },
  sidebarProfileInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  sidebarAvatarWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: C.grey100,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.borderGray,
  },
  sidebarAvatarImage: {
    width: "100%",
    height: "100%",
  },
  sidebarAvatarInitials: {
    fontSize: 16,
    fontWeight: "700",
    color: C.gray50,
  },
  sidebarProfileTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  sidebarProfileName: {
    fontSize: 20,
    fontWeight: "700",
    color: C.black,
  },
  sidebarProfileEmail: {
    fontSize: 14,
    color: C.gray50,
    marginTop: 2,
  },
  sidebarDivider: {
    height: 1,
    backgroundColor: C.borderGray,
    marginTop: 4,
    marginBottom: 8,
  },
  sidebarCloseButton: {
    minHeight: 34,
    minWidth: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.background,
  },
  sidebarItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  sidebarItemText: {
    fontSize: 15,
    fontWeight: "600",
    color: C.black,
  },
  sidebarItemDanger: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: C.themeRed + "33",
    backgroundColor: C.themeRed + "10",
  },
  sidebarItemDangerText: {
    fontSize: 15,
    fontWeight: "700",
    color: C.themeRed,
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
  courtPortalModalIntro: {
    fontSize: 12,
    lineHeight: 18,
    color: C.gray50,
    marginBottom: 10,
  },
  courtPortalScroll: {
    marginBottom: 12,
  },
  courtPortalListContent: {
    paddingBottom: 8,
  },
  courtPortalSectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: C.gray50,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 8,
  },
  courtPortalSectionTitleFirst: {
    marginTop: 0,
  },
  courtPortalOption: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.borderGray,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    backgroundColor: C.background,
  },
  courtPortalOptionSelected: {
    borderColor: C.themeBlack,
    backgroundColor: C.gray100,
  },
  courtPortalOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  courtPortalOptionTexts: {
    flex: 1,
    gap: 2,
  },
  courtPortalOptionLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: C.black,
  },
  courtPortalOptionDesc: {
    fontSize: 12,
    color: C.gray50,
    lineHeight: 17,
  },
  courtPortalOptionIconCol: {
    width: 26,
    alignItems: "flex-end",
  },
  courtPortalOpenBtn: {
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.themeBlack,
  },
  courtPortalOpenBtnDisabled: {
    opacity: 0.5,
  },
  courtPortalOpenBtnText: {
    color: C.pureWhite,
    fontWeight: "700",
    fontSize: 15,
  },
  card: {
    backgroundColor: C.pureWhite,
    borderRadius: 16,
    paddingVertical: 32,
    paddingHorizontal: 28,
    alignItems: "center",
    minWidth: "100%",
    ...theme.shadow,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.gray100,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  heading: {
    fontSize: 20,
    fontWeight: "700",
    color: C.black,
    marginBottom: 8,
  },
  subtext: {
    fontSize: 15,
    color: C.gray50,
    marginBottom: 24,
    textAlign: "center",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.themeBlack,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  addButtonText: {
    color: C.pureWhite,
    fontSize: 16,
    fontWeight: "600",
  },
  diaryLink: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    gap: 4,
  },
  diaryLinkText: {
    fontSize: 15,
    color: C.black,
    fontWeight: "500",
  },
  });
}

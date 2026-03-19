import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useIsFocused } from "@react-navigation/native";
import * as Print from "expo-print";
import { useFocusEffect, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable as RNPressable,
  Pressable,
  RefreshControl,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { CopilotStep, useCopilot, walkthroughable } from "react-native-copilot";

import { CaseCard } from "@/components/case-card";
import { ThemedText } from "@/components/themed-text";
import { Bounceable, Spacer } from "@/components/ui";
import { ScreenHeader } from "@/components/ui/screen-header";
import { theme } from "@/constants/theme";
import { useAuth } from "@/context/auth-context";
import { useIsOnline } from "@/hooks/use-is-online";
import { getActivityNotesStorageKey, sanitizeActivityNotes } from "@/lib/activity-notes";
import { getCachedCases, removeCachedCase, setCachedCases } from "@/lib/cases-cache";
import { addPendingCaseDelete, getPendingCasesCount } from "@/lib/offline-queue";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { CaseRow } from "@/types/case";
import { formatCaseDate, getCaseDisplayTitle, getTodayISO, getWeekBounds } from "@/types/case";

const WalkthroughableView = walkthroughable(View);

type HomeFilter = "today" | "weekly";
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
  const { session } = useAuth();
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [filter, setFilter] = useState<HomeFilter>("today");
  const [pendingCount, setPendingCount] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [notesCount, setNotesCount] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const exportImageRef = useRef<View | null>(null);
  const { width: screenWidth } = useWindowDimensions();

  const today = getTodayISO();
  const { weekStart, weekEnd } = getWeekBounds();

  const fetchCases = useCallback(
    async (isSilent = false) => {
      if (!session?.user?.id || !isSupabaseConfigured) {
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
        .eq("user_id", session.user.id)
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
    [session?.user?.id, isOnline],
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
          setTimeout(() => {
            if (cancelled) return;
            start();
            AsyncStorage.setItem("hasSeenHomeTourCopilot", "true");
          }, 600);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [fetchCases, loadNotesCount, start, session?.user?.id, isOnline]),
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
      Alert.alert("Delete case?", "This cannot be undone.", [
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
            if (e) Alert.alert("Error", e.message);
            else {
              await removeCachedCase(session.user.id, caseId);
              fetchCases();
            }
          },
        },
      ]);
    },
    [session?.user?.id, fetchCases, isOnline],
  );

  const { hearingsToday, filedToday } = getTodayCases(cases, today);
  const { hearingsThisWeek, filedThisWeek } = getWeeklyCases(
    cases,
    weekStart,
    weekEnd,
  );

  const isTodayFilter = filter === "today";
  const hasAnyToday = hearingsToday.length > 0 || filedToday.length > 0;
  const hasAnyWeekly = hearingsThisWeek.length > 0 || filedThisWeek.length > 0;
  const hasAny = isTodayFilter ? hasAnyToday : hasAnyWeekly;
  const sections = useMemo<CaseSection[]>(() => {
    const result: CaseSection[] = [];
    if (isTodayFilter) {
      if (hearingsToday.length > 0) {
        result.push({ title: "Hearings today", data: hearingsToday });
      }
      if (filedToday.length > 0) {
        result.push({ title: "Filed today", data: filedToday });
      }
    } else {
      if (hearingsThisWeek.length > 0) {
        result.push({ title: "Hearings this week", data: hearingsThisWeek });
      }
      if (filedThisWeek.length > 0) {
        result.push({ title: "Filed this week", data: filedThisWeek });
      }
    }
    return result;
  }, [isTodayFilter, hearingsToday, filedToday, hearingsThisWeek, filedThisWeek]);
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

  const shareButton = hasShareableHearings ? (
    <Bounceable
      onPress={handleShareCases}
      style={styles.shareButton}
      accessibilityLabel="Share case list"
      disabled={isExporting}
    >
      {isExporting ? (
        <ActivityIndicator size="small" color={theme.colors.black} />
      ) : (
        <MaterialIcons name="share" size={21} color={theme.colors.black} />
      )}
    </Bounceable>
  ) : null;

  const notesHeaderButton = (
    <Bounceable
      style={styles.notesHeaderButton}
      onPress={() => router.push("/notes")}
      accessibilityLabel="Open notes"
    >
      <MaterialIcons name="sticky-note-2" size={16} color={theme.colors.pureWhite} />
      <ThemedText style={styles.notesHeaderButtonText}>Notes</ThemedText>
      {notesCount > 0 ? (
        <View style={styles.notesCountBadge}>
          <ThemedText style={styles.notesCountText}>
            {notesCount > 99 ? "99+" : String(notesCount)}
          </ThemedText>
        </View>
      ) : null}
    </Bounceable>
  );
  const menuHeaderButton = (
    <Bounceable
      onPress={() => setIsSidebarOpen(true)}
      style={styles.menuHeaderButton}
      accessibilityLabel="Open menu"
    >
      <MaterialIcons name="menu" size={21} color={theme.colors.black} />
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
      visible={isSidebarOpen}
      transparent
      animationType="fade"
      onRequestClose={() => setIsSidebarOpen(false)}
    >
      <RNPressable style={styles.sidebarOverlay} onPress={() => setIsSidebarOpen(false)}>
        <RNPressable style={styles.sidebarPanel} onPress={() => undefined}>
          <View style={styles.sidebarHeader}>
            <ThemedText style={styles.sidebarTitle}>Quick Menu</ThemedText>
            <Bounceable
              style={styles.sidebarCloseButton}
              onPress={() => setIsSidebarOpen(false)}
            >
              <MaterialIcons name="close" size={20} color={theme.colors.black} />
            </Bounceable>
          </View>

          <Bounceable
            style={styles.sidebarItem}
            onPress={() => {
              setIsSidebarOpen(false);
              router.push("/notes");
            }}
          >
            <MaterialIcons name="sticky-note-2" size={19} color={theme.colors.black} />
            <ThemedText style={styles.sidebarItemText}>Notes</ThemedText>
          </Bounceable>

          <Bounceable
            style={styles.sidebarItem}
            onPress={() => {
              setIsSidebarOpen(false);
              handleShareCases();
            }}
          >
            <MaterialIcons name="share" size={19} color={theme.colors.black} />
            <ThemedText style={styles.sidebarItemText}>Share case list</ThemedText>
          </Bounceable>
        </RNPressable>
      </RNPressable>
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
          <ActivityIndicator size="large" color={theme.colors.black} />
        </View>
        {sidebarMenu}
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
          <WalkthroughableView>
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
              color={theme.colors.zodiacColour}
            />
            <ThemedText style={styles.pendingBannerText}>
              {pendingCount} case{pendingCount !== 1 ? "s" : ""} waiting to sync
            </ThemedText>
          </View>
        )}
        <View style={styles.container}>
          <View style={styles.filterRow}>
            <CopilotStep
              text="Tap here to see only today's cases."
              order={2}
              name="filter-today"
              active={isFocused}
            >
              <WalkthroughableView style={{ width: "45%" }}>
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
              order={3}
              name="filter-weekly"
              active={isFocused}
            >
              <WalkthroughableView style={{ width: "45%" }}>
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
                color={theme.colors.zodiacColour}
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
                  ? "Cases with a hearing today or filed today will appear here."
                  : "Cases with a hearing or filing this week will appear here."}
            </ThemedText>
            <CopilotStep
              text="Tap here to start adding your cases and stay organized."
              order={4}
              name="add-case"
              active={isFocused}
            >
              <WalkthroughableView>
                <Bounceable
                  style={styles.addButton}
                  onPress={() => router.push("/add-case-flow")}
                >
                  <MaterialIcons
                    name="add"
                    size={22}
                    color={theme.colors.pureWhite}
                  />
                  <ThemedText style={styles.addButtonText}>
                    Add Case
                  </ThemedText>
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
                color={theme.colors.black}
              />
            </Bounceable>
          </View>
        </View>
        {sidebarMenu}
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
        <WalkthroughableView>
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
            color={theme.colors.zodiacColour}
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

          <View style={styles.filterRow}>
            <CopilotStep
              text="Tap here to see only today's cases."
              order={2}
              name="filter-today"
              active={isFocused}
            >
              <WalkthroughableView style={styles.filterBtnWrapper}>
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
              order={3}
              name="filter-weekly"
              active={isFocused}
            >
              <WalkthroughableView style={styles.filterBtnWrapper}>
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
                colors={[theme.colors.black]}
                tintColor={theme.colors.black}
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
                      onEdit={(caseId) => router.push(`/case/${caseId}/edit`)}
                      onDelete={handleDeleteCase}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  pendingBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.zodiacColour + "20",
    marginHorizontal: 24,
    marginTop: 8,
    borderRadius: 8,
  },
  pendingBannerText: {
    fontSize: 14,
    color: theme.colors.zodiacColour,
    fontWeight: "500",
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: theme.colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    marginBottom: 12,
    alignSelf: "center",
    color: theme.colors.black,
    backgroundColor: theme.colors.background,
  },
  filterRow: {
    flexDirection: "row",
    backgroundColor: "transparent",
    width: "100%",
    paddingVertical: 10,
    justifyContent: "space-around",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
  },
  filterBtnWrapper: {
    width: "45%",
  },
  filterBtn: {
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: theme.colors.grey100,
    borderWidth: 1,
    borderColor: "transparent",
  },
  filterBtnActive: {
    backgroundColor: theme.colors.themeBlack,
    borderColor: theme.colors.themeBlack,
  },
  filterBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.colors.gray50,
  },
  filterBtnTextActive: {
    color: theme.colors.pureWhite,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.colors.gray50,
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
    backgroundColor: theme.colors.pureWhite,
    padding: 16,
    borderRadius: 12,
  },
  exportCaptureHeading: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.black,
    marginBottom: 12,
  },
  exportSection: {
    marginBottom: 14,
  },
  exportSectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.gray50,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  exportRow: {
    backgroundColor: theme.colors.background,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  exportRowTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.black,
    marginBottom: 2,
  },
  exportRowMeta: {
    fontSize: 12,
    color: theme.colors.gray50,
  },
  errorText: {
    color: theme.colors.themeRed,
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
    backgroundColor: theme.colors.zodiacColour,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 10,
    ...theme.shadow,
  },
  notesHeaderButtonText: {
    color: theme.colors.pureWhite,
    fontSize: 12,
    fontWeight: "700",
  },
  notesCountBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: theme.colors.themeRed,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 2,
  },
  notesCountText: {
    fontSize: 8,
    color: theme.colors.pureWhite,
    fontWeight: "700",
  },
  menuHeaderButton: {
    minWidth: 34,
    minHeight: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
  },
  sidebarOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "flex-start",
  },
  sidebarPanel: {
    width: "78%",
    maxWidth: 320,
    backgroundColor: theme.colors.pureWhite,
    height: "100%",
    paddingTop: 52,
    paddingHorizontal: 16,
  },
  sidebarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sidebarTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.black,
  },
  sidebarCloseButton: {
    minHeight: 34,
    minWidth: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
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
    color: theme.colors.black,
  },
  card: {
    backgroundColor: theme.colors.pureWhite,
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
    backgroundColor: theme.colors.gray100,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  heading: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.black,
    marginBottom: 8,
  },
  subtext: {
    fontSize: 15,
    color: theme.colors.gray50,
    marginBottom: 24,
    textAlign: "center",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: theme.colors.themeBlack,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  addButtonText: {
    color: theme.colors.pureWhite,
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
    color: theme.colors.black,
    fontWeight: "500",
  },
});

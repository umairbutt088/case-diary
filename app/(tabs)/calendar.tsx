import AsyncStorage from "@react-native-async-storage/async-storage";
import { useIsFocused } from "@react-navigation/native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { CopilotStep, useCopilot, walkthroughable } from "react-native-copilot";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { DateData } from "react-native-calendars";
import { Calendar } from "react-native-calendars";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  CalendarCaseCard,
  type CalendarCaseItem,
} from "@/components/calendar-case-card";
import { ThemedText } from "@/components/themed-text";
import { Spacer } from "@/components/ui";
import type { AppColors } from "@/constants/color-palette";
import { useAuth } from "@/context/auth-context";
import { useAppTheme } from "@/context/app-theme-context";
import { useIsOnline } from "@/hooks/use-is-online";
import { useThemePalette } from "@/hooks/use-theme-palette";
import { getCachedCases, setCachedCases } from "@/lib/cases-cache";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { CaseRow } from "@/types/case";
import { getCaseDisplayTitle, getTodayISO } from "@/types/case";

const WalkthroughableView = walkthroughable(View);

function buildCalendarTheme(C: AppColors) {
  return {
    calendarBackground: C.pureWhite,
    textSectionTitleColor: C.black,
    selectedDayBackgroundColor: "transparent",
    selectedDayTextColor: C.black,
    todayBackgroundColor: "transparent",
    todayTextColor: C.themeRed,
    dayTextColor: C.black,
    textDisabledColor: C.gray40,
    textInactiveColor: C.gray40,
    monthTextColor: C.black,
    arrowColor: C.black,
    textDayFontWeight: "400" as const,
    textMonthFontWeight: "600" as const,
    textDayHeaderFontWeight: "500" as const,
    textDayFontSize: 15,
    textMonthFontSize: 18,
    textDayHeaderFontSize: 13,
  };
}

/** Build map of date (YYYY-MM-DD) -> number of unique cases (hearing or filing on that date) */
function buildDateToCount(cases: CaseRow[]): Record<string, number> {
  const dateToIds: Record<string, Set<string>> = {};
  for (const c of cases) {
    const hearingDate = c.next_hearing_date?.slice(0, 10);
    if (hearingDate) {
      if (!dateToIds[hearingDate]) dateToIds[hearingDate] = new Set();
      dateToIds[hearingDate].add(c.id);
    }
    const filingDate = c.date_of_filing?.slice(0, 10);
    if (filingDate) {
      if (!dateToIds[filingDate]) dateToIds[filingDate] = new Set();
      dateToIds[filingDate].add(c.id);
    }
  }
  const dateToCount: Record<string, number> = {};
  for (const [date, ids] of Object.entries(dateToIds)) {
    dateToCount[date] = ids.size;
  }
  return dateToCount;
}

function getMarkedDates(
  selectedDate: string,
  currentMonth: string,
  dateToCount: Record<string, number>,
  C: AppColors,
) {
  const [year, month] = currentMonth.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const marked: Record<string, object> = {};

  for (let d = 1; d <= daysInMonth; d++) {
    const dateString = `${year}-${String(month).padStart(2, "0")}-${String(
      d,
    ).padStart(2, "0")}`;
    const dayOfWeek = new Date(year, month - 1, d).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const caseCount = dateToCount[dateString] ?? 0;
    const hasCase = caseCount > 0;
    const isSelected = dateString === selectedDate;

    if (isSelected) {
      marked[dateString] = {
        selected: true,
        selectedColor: "transparent",
        selectedTextColor: C.black,
        caseCount,
        customStyles: {
          container: {
            borderWidth: 2,
            borderColor: C.cream60,
            borderRadius: 20,
            backgroundColor: "transparent",
          },
          text: {},
        },
      };
    } else if (hasCase) {
      marked[dateString] = {
        caseCount,
        customStyles: {
          container: {
            backgroundColor: C.grey100,
            borderRadius: 20,
          },
          text: {
            color: C.gray30,
          },
        },
      };
    } else if (isWeekend) {
      marked[dateString] = {
        caseCount: 0,
        customStyles: {
          text: {
            color: C.themeRed,
          },
        },
      };
    }
  }

  if (!marked[selectedDate]) {
    marked[selectedDate] = {
      selected: true,
      selectedColor: "transparent",
      selectedTextColor: C.black,
      caseCount: dateToCount[selectedDate] ?? 0,
      customStyles: {
        container: {
          borderWidth: 2,
          borderColor: C.cream60,
          borderRadius: 20,
          backgroundColor: "transparent",
        },
        text: {},
      },
    };
  }

  return marked;
}

type MarkingWithCount = {
  customStyles?: { container?: object; text?: object };
  selected?: boolean;
  selectedTextColor?: string;
  caseCount?: number;
};

function createCalendarDayStyles(C: AppColors) {
  return StyleSheet.create({
    base: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: "center",
      alignItems: "center",
    },
    selected: {
      borderWidth: 2,
      borderColor: C.cream60,
    },
    text: {
      fontSize: 15,
      color: C.black,
    },
    selectedText: {
      fontWeight: "600",
    },
    badge: {
      position: "absolute",
      bottom: -2,
      right: -2,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: C.themeBlack,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 4,
    },
    badgeText: {
      fontSize: 10,
      fontWeight: "700",
      color: C.pureWhite,
    },
  });
}

type CalendarDayStyles = ReturnType<typeof createCalendarDayStyles>;

/** Custom day: day number + badge with case count */
function CalendarDayWithBadge(props: {
  date?: DateData;
  marking?: MarkingWithCount;
  state?: string;
  theme?: object;
  onPress?: (date: DateData) => void;
  children?: React.ReactNode;
  calendarDayStyles: CalendarDayStyles;
}) {
  const { date, marking, onPress, children, calendarDayStyles } = props;
  const ds = calendarDayStyles;
  const caseCount = marking?.caseCount ?? 0;
  const isSelected = marking?.selected ?? props.state === "selected";
  const containerStyle = [
    ds.base,
    marking?.customStyles?.container,
    isSelected && ds.selected,
  ];
  const textStyle = [
    ds.text,
    marking?.customStyles?.text,
    isSelected && ds.selectedText,
    isSelected && marking?.selectedTextColor
      ? { color: marking.selectedTextColor }
      : undefined,
  ];

  const handlePress = useCallback(() => {
    if (date) onPress?.(date);
  }, [date, onPress]);

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Text style={textStyle} allowFontScaling={false}>
        {children}
      </Text>
      {caseCount > 0 && (
        <View style={ds.badge}>
          <Text style={ds.badgeText} allowFontScaling={false}>
            {caseCount > 99 ? "99+" : caseCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

/** Map CaseRow to CalendarCaseItem for a given date (subtitle = Hearing / Filed / both) */
function caseToCalendarItem(c: CaseRow, date: string): CalendarCaseItem {
  const title = getCaseDisplayTitle(c);
  const hearing = c.next_hearing_date?.slice(0, 10) === date;
  const filed = c.date_of_filing?.slice(0, 10) === date;
  const parts: string[] = [];
  if (hearing) parts.push("Hearing");
  if (filed) parts.push("Filed");
  const typeSub = parts.join(" · ");
  const notesSnippet = c.notes?.trim()
    ? c.notes.trim().slice(0, 60) + (c.notes.trim().length > 60 ? "…" : "")
    : "";
  const subtitle = notesSnippet ? `${typeSub} — ${notesSnippet}` : typeSub;

  return {
    id: c.id,
    title,
    subtitle,
    date,
    nextHearingDate: c.next_hearing_date ?? null,
    updatedAt: c.updated_at,
  };
}

function createCalendarScreenStyles(C: AppColors) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: C.background,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 24,
    },
    calendarWrap: {
      backgroundColor: C.pureWhite,
      paddingHorizontal: 8,
      borderRadius: 0,
    },
    addDateSection: {
      marginHorizontal: 20,
      marginTop: 16,
    },
    addDateButton: {
      backgroundColor: C.themeBlack,
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 12,
      alignItems: "center",
    },
    addDateButtonText: {
      color: C.pureWhite,
      fontSize: 15,
      fontWeight: "600",
    },
    addDateHint: {
      fontSize: 13,
      marginTop: 8,
      paddingHorizontal: 4,
      textAlign: "center",
    },
    caseList: {
      marginTop: 20,
      paddingHorizontal: 20,
    },
    addDateSectionTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: C.black,
      marginBottom: 12,
      textAlign: "center",
    },
    caseListTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: C.black,
      marginBottom: 12,
    },
    noCases: {
      fontSize: 14,
      color: C.gray50,
    },
    errorWrap: {
      marginTop: 4,
    },
    errorText: {
      fontSize: 14,
      color: C.themeRed,
      marginBottom: 12,
    },
    retryButton: {
      alignSelf: "flex-start",
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 10,
      backgroundColor: C.btnBlue,
    },
    retryButtonText: {
      fontSize: 15,
      fontWeight: "600",
      color: C.pureWhite,
    },
  });
}

export default function CalendarScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  const isFocused = useIsFocused();
  const { start } = useCopilot();
  const scrollViewRef = useRef<ScrollView>(null);
  const today = getTodayISO();
  const [selectedDate, setSelectedDate] = useState(today);
  const [currentMonth, setCurrentMonth] = useState(today.slice(0, 7));
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { session } = useAuth();
  const isOnline = useIsOnline();
  const C = useThemePalette();
  const { isDark } = useAppTheme();
  const styles = useMemo(() => createCalendarScreenStyles(C), [C]);
  const calendarTheme = useMemo(() => buildCalendarTheme(C), [C]);
  const calendarDayStyles = useMemo(() => createCalendarDayStyles(C), [C]);

  useFocusEffect(
    useCallback(() => {
      const selectedFromRoute = params.date;
      const validDate =
        typeof selectedFromRoute === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(selectedFromRoute)
          ? selectedFromRoute
          : null;
      if (!validDate) return;
      setSelectedDate(validDate);
      setCurrentMonth(validDate.slice(0, 7));
    }, [params.date]),
  );

  const fetchCases = useCallback(
    async (isSilent = false) => {
      if (!session?.user?.id || !isSupabaseConfigured) {
        setCases([]);
        setLoading(false);
        setError(null);
        return;
      }
      if (!isOnline) {
        const cached = await getCachedCases(session.user.id);
        setCases(cached);
        setLoading(false);
        setError(null);
        return;
      }
      setError(null);
      // Only show loading if not silent
      if (!isSilent) {
        setLoading(true);
      }
      const { data, error: e } = await supabase
        .from("cases")
        .select("*")
        .eq("user_id", session.user.id);
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
    },
    [session?.user?.id, isOnline],
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        await fetchCases(true);
        if (cancelled) return;
        const hasSeenTour = await AsyncStorage.getItem(
          "hasSeenCalendarTourCopilot",
        );
        if (!hasSeenTour) {
          setTimeout(() => {
            if (cancelled) return;
            start(undefined, scrollViewRef.current);
            AsyncStorage.setItem("hasSeenCalendarTourCopilot", "true");
          }, 800);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [fetchCases, start]),
  );

  const dateToCount = useMemo(() => buildDateToCount(cases), [cases]);

  const markedDates = useMemo(
    () => getMarkedDates(selectedDate, currentMonth, dateToCount, C),
    [selectedDate, currentMonth, dateToCount, C],
  );

  const casesForSelectedDate = useMemo(() => {
    return cases
      .filter(
        (c) =>
          c.next_hearing_date?.slice(0, 10) === selectedDate ||
          c.date_of_filing?.slice(0, 10) === selectedDate,
      )
      .map((c) => caseToCalendarItem(c, selectedDate));
  }, [cases, selectedDate]);

  const onMonthChange = useCallback((date: { dateString: string }) => {
    setCurrentMonth(date.dateString.slice(0, 7));
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCases();
    setRefreshing(false);
  }, [fetchCases]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[C.black]}
            tintColor={C.black}
          />
        }
      >
        <View style={styles.calendarWrap}>
          <Calendar
            key={isDark ? "dark" : "light"}
            current={currentMonth + "-01"}
            onDayPress={(day) => setSelectedDate(day.dateString)}
            onMonthChange={onMonthChange}
            markedDates={markedDates}
            markingType="custom"
            theme={calendarTheme}
            enableSwipeMonths
            hideExtraDays={false}
            firstDay={0}
            dayComponent={(props) => (
              <CalendarDayWithBadge
                {...props}
                calendarDayStyles={calendarDayStyles}
              />
            )}
          />
        </View>
        <Spacer.Column numberOfSpaces={5} />
        <View style={styles.addDateSection}>
          <Text style={styles.addDateSectionTitle}>
            Add this date {`"${selectedDate}"`} as next hearing date to a case
          </Text>
          <Spacer.Column numberOfSpaces={5} />
          <CopilotStep
            text="Click here to add this selected date as the next hearing date to a case."
            order={1}
            name="calendar-add-next-hearing-date"
            active={isFocused}
          >
            <WalkthroughableView>
              <Pressable
                style={styles.addDateButton}
                onPress={() =>
                  router.push({
                    pathname: "/add-date-to-case",
                    params: { date: selectedDate },
                  })
                }
              >
                <ThemedText style={styles.addDateButtonText}>
                  + Add next hearing date
                </ThemedText>
              </Pressable>
            </WalkthroughableView>
          </CopilotStep>
          <ThemedText
            style={styles.addDateHint}
            lightColor={C.gray50}
            darkColor={C.gray50}
          >
            Pick a case from the list.{"\n"}Its next hearing date will be set to
            this day.
          </ThemedText>
        </View>

        <View style={styles.caseList}>
          <ThemedText style={styles.caseListTitle}>
            Cases on {selectedDate}
          </ThemedText>
          {error ? (
            <View style={styles.errorWrap}>
              <ThemedText style={styles.errorText}>{error}</ThemedText>
              <Pressable
                style={styles.retryButton}
                onPress={() => {
                  setError(null);
                  fetchCases();
                }}
              >
                <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
              </Pressable>
            </View>
          ) : loading && !refreshing ? (
            <ThemedText style={styles.noCases}>Loading…</ThemedText>
          ) : casesForSelectedDate.length === 0 ? (
            <ThemedText style={styles.noCases}>
              No cases on this date.
            </ThemedText>
          ) : (
            casesForSelectedDate.map((caseItem) => (
              <CalendarCaseCard key={caseItem.id} caseItem={caseItem} />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

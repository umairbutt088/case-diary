import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
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
import { theme } from "@/constants/theme";
import { useAuth } from "@/context/auth-context";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { CaseRow } from "@/types/case";
import { getCaseDisplayTitle, getTodayISO } from "@/types/case";

// Theme for calendar: white bg, black text, weekends red, selected outline, marked grey
const CALENDAR_THEME = {
  calendarBackground: theme.colors.pureWhite,
  textSectionTitleColor: theme.colors.black,
  selectedDayBackgroundColor: "transparent",
  selectedDayTextColor: theme.colors.black,
  todayTextColor: theme.colors.black,
  dayTextColor: theme.colors.black,
  textDisabledColor: theme.colors.gray40,
  textInactiveColor: theme.colors.gray40,
  monthTextColor: theme.colors.black,
  arrowColor: theme.colors.black,
  textDayFontWeight: "400" as const,
  textMonthFontWeight: "600" as const,
  textDayHeaderFontWeight: "500" as const,
  textDayFontSize: 15,
  textMonthFontSize: 18,
  textDayHeaderFontSize: 13,
};

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
        selectedTextColor: theme.colors.black,
        caseCount,
        customStyles: {
          container: {
            borderWidth: 2,
            borderColor: theme.colors.cream60,
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
            backgroundColor: theme.colors.grey100,
            borderRadius: 20,
          },
          text: {
            color: theme.colors.gray30,
          },
        },
      };
    } else if (isWeekend) {
      marked[dateString] = {
        caseCount: 0,
        customStyles: {
          text: {
            color: theme.colors.themeRed,
          },
        },
      };
    }
  }

  if (!marked[selectedDate]) {
    marked[selectedDate] = {
      selected: true,
      selectedColor: "transparent",
      selectedTextColor: theme.colors.black,
      caseCount: dateToCount[selectedDate] ?? 0,
      customStyles: {
        container: {
          borderWidth: 2,
          borderColor: theme.colors.cream60,
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

/** Custom day: day number + badge with case count */
function CalendarDayWithBadge(props: {
  date?: DateData;
  marking?: MarkingWithCount;
  state?: string;
  theme?: object;
  onPress?: (date: DateData) => void;
  children?: React.ReactNode;
}) {
  const { date, marking, onPress, children } = props;
  const caseCount = marking?.caseCount ?? 0;
  const isSelected = marking?.selected ?? props.state === "selected";
  const containerStyle = [
    dayStyles.base,
    marking?.customStyles?.container,
    isSelected && dayStyles.selected,
  ];
  const textStyle = [
    dayStyles.text,
    marking?.customStyles?.text,
    isSelected && dayStyles.selectedText,
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
        <View style={dayStyles.badge}>
          <Text style={dayStyles.badgeText} allowFontScaling={false}>
            {caseCount > 99 ? "99+" : caseCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const dayStyles = StyleSheet.create({
  base: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  selected: {
    borderWidth: 2,
    borderColor: theme.colors.cream60,
  },
  text: {
    fontSize: 15,
    color: theme.colors.black,
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
    backgroundColor: theme.colors.themeBlack,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.colors.pureWhite,
  },
});

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
  };
}

export default function CalendarScreen() {
  const router = useRouter();
  const today = getTodayISO();
  const [selectedDate, setSelectedDate] = useState(today);
  const [currentMonth, setCurrentMonth] = useState(today.slice(0, 7));
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { session } = useAuth();

  const fetchCases = useCallback(async (isSilent = false) => {
    if (!session?.user?.id || !isSupabaseConfigured) {
      setCases([]);
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
      setCases([]);
      setError(e.message);
      return;
    }
    setCases((data as CaseRow[]) ?? []);
  }, [session?.user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchCases(true);
    }, [fetchCases]),
  );

  const dateToCount = useMemo(() => buildDateToCount(cases), [cases]);

  const markedDates = useMemo(
    () => getMarkedDates(selectedDate, currentMonth, dateToCount),
    [selectedDate, currentMonth, dateToCount],
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
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.black]}
            tintColor={theme.colors.black}
          />
        }
      >
        <View style={styles.calendarWrap}>
          <Calendar
            current={currentMonth + "-01"}
            onDayPress={(day) => setSelectedDate(day.dateString)}
            onMonthChange={onMonthChange}
            markedDates={markedDates}
            markingType="custom"
            theme={CALENDAR_THEME}
            enableSwipeMonths
            hideExtraDays={false}
            firstDay={0}
            dayComponent={(props) => <CalendarDayWithBadge {...props} />}
          />
        </View>
        <Spacer.Column numberOfSpaces={5} />
        <View style={styles.addDateSection}>
          <Text style={styles.addDateSectionTitle}>
            Add this date {`"${selectedDate}"`} as next hearing date to a case
          </Text>
          <Spacer.Column numberOfSpaces={5} />
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
              + Add as next hearing date
            </ThemedText>
          </Pressable>
          <ThemedText
            style={styles.addDateHint}
            lightColor={theme.colors.gray50}
            darkColor={theme.colors.gray50}
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  calendarWrap: {
    backgroundColor: theme.colors.pureWhite,
    paddingHorizontal: 8,
  },
  addDateSection: {
    marginHorizontal: 20,
    marginTop: 16,
  },
  addDateButton: {
    backgroundColor: theme.colors.themeBlack,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
  },
  addDateButtonText: {
    color: theme.colors.pureWhite,
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
    color: theme.colors.black,
    marginBottom: 12,
    textAlign: "center",
  },
  caseListTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.black,
    marginBottom: 12,
  },
  noCases: {
    fontSize: 14,
    color: theme.colors.gray50,
  },
  errorWrap: {
    marginTop: 4,
  },
  errorText: {
    fontSize: 14,
    color: theme.colors.themeRed,
    marginBottom: 12,
  },
  retryButton: {
    alignSelf: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: theme.colors.btnBlue,
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.colors.pureWhite,
  },
});

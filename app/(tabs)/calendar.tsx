import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Calendar } from "react-native-calendars";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  CalendarCaseCard,
  type CalendarCaseItem,
} from "@/components/calendar-case-card";
import { ThemedText } from "@/components/themed-text";
import { theme } from "@/constants/theme";

// Theme for calendar: white bg, black text, weekends red, selected outline, marked grey
const CALENDAR_THEME = {
  calendarBackground: theme.colors.pureWhite,
  textSectionTitleColor: theme.colors.black,
  selectedDayBackgroundColor: "transparent",
  selectedDayTextColor: theme.colors.black,
  todayTextColor: theme.colors.primary,
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

// Mock: dates that have at least one case (shown with grey circle)
const DATES_WITH_CASES = ["2025-12-27", "2025-12-28", "2025-12-29"];

// Mock: cases list (replace with real data later)
const MOCK_CASES: CalendarCaseItem[] = [
  {
    id: "1",
    title: "John Doe vs Thompson",
    subtitle: "Need to submit documents",
    date: "2025-12-27",
  },
  {
    id: "2",
    title: "Smith v. State",
    subtitle: "Hearing scheduled",
    date: "2025-12-27",
  },
];

function getMarkedDates(selectedDate: string, currentMonth: string) {
  const [year, month] = currentMonth.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const marked: Record<string, object> = {};

  for (let d = 1; d <= daysInMonth; d++) {
    const dateString = `${year}-${String(month).padStart(2, "0")}-${String(
      d
    ).padStart(2, "0")}`;
    const dayOfWeek = new Date(year, month - 1, d).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const hasCase = DATES_WITH_CASES.includes(dateString);
    const isSelected = dateString === selectedDate;

    if (isSelected) {
      marked[dateString] = {
        selected: true,
        selectedColor: "transparent",
        selectedTextColor: theme.colors.black,
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
        customStyles: {
          text: {
            color: theme.colors.themeRed,
          },
        },
      };
    }
  }

  // Ensure selected date is always marked when it's in another month
  if (!marked[selectedDate]) {
    marked[selectedDate] = {
      selected: true,
      selectedColor: "transparent",
      selectedTextColor: theme.colors.black,
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

const INITIAL_MONTH = "2025-12";
const INITIAL_DATE = "2025-12-26"; // Default selected date for demo (Dec 26 in design)

export default function CalendarScreen() {
  const today = useMemo(() => {
    const t = new Date();
    return t.toISOString().slice(0, 10);
  }, []);

  const [selectedDate, setSelectedDate] = useState(INITIAL_DATE);
  const [currentMonth, setCurrentMonth] = useState(INITIAL_MONTH);

  const markedDates = useMemo(
    () => getMarkedDates(selectedDate, currentMonth),
    [selectedDate, currentMonth]
  );

  const casesForSelectedDate = useMemo(
    () => MOCK_CASES.filter((c) => c.date === selectedDate),
    [selectedDate]
  );

  const onMonthChange = useCallback((date: { dateString: string }) => {
    setCurrentMonth(date.dateString.slice(0, 7));
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
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
          />
        </View>

        <Pressable
          style={styles.addDateButton}
          onPress={() => {
            // TODO: open add date / add case flow
          }}
        >
          <ThemedText style={styles.addDateButtonText}>
            + Add a date to {selectedDate}
          </ThemedText>
        </Pressable>

        <View style={styles.caseList}>
          {casesForSelectedDate.length === 0 ? (
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
    backgroundColor: "#ffffff",
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
  addDateButton: {
    backgroundColor: theme.colors.themeBlack,
    marginHorizontal: 20,
    marginTop: 16,
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
  caseList: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  noCases: {
    fontSize: 14,
    color: theme.colors.gray50,
  },
});

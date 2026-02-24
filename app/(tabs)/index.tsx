import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CaseCard } from "@/components/case-card";
import { ThemedText } from "@/components/themed-text";
import { Bounceable, Spacer } from "@/components/ui";
import { theme } from "@/constants/theme";
import { useAuth } from "@/context/auth-context";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { CaseRow } from "@/types/case";
import { getTodayISO, getWeekBounds } from "@/types/case";

type HomeFilter = "today" | "weekly";

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

export default function HomeScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<HomeFilter>("today");

  const today = getTodayISO();
  const { weekStart, weekEnd } = getWeekBounds();

  const fetchCases = useCallback(async () => {
    if (!session?.user?.id || !isSupabaseConfigured) {
      setCases([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: e } = await supabase
      .from("cases")
      .select("*")
      .eq("user_id", session.user.id)
      .order("next_hearing_date", { ascending: true, nullsFirst: false });
    setLoading(false);
    if (e) {
      setError(e.message);
      setCases([]);
      return;
    }
    setCases((data as CaseRow[]) ?? []);
  }, [session?.user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchCases();
    }, [fetchCases]),
  );

  const handleDeleteCase = useCallback(
    (caseId: string) => {
      Alert.alert("Delete case?", "This cannot be undone.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!session?.user?.id) return;
            const { error: e } = await supabase
              .from("cases")
              .delete()
              .eq("id", caseId)
              .eq("user_id", session.user.id);
            if (e) Alert.alert("Error", e.message);
            else fetchCases();
          },
        },
      ]);
    },
    [session?.user?.id, fetchCases],
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

  if (loading && cases.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.black} />
        </View>
      </SafeAreaView>
    );
  }

  if (error && cases.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.container}>
          <ThemedText type="subtitle" style={styles.title}>
            Today
          </ThemedText>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  if (!hasAny) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.container}>
          <ThemedText type="subtitle" style={styles.title}>
            {isTodayFilter ? "Today" : "This week"}
          </ThemedText>
          <View style={styles.filterRow}>
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
          </View>
          <Spacer.Column numberOfSpaces={10} />
          <View style={styles.card}>
            <View style={styles.iconCircle}>
              <MaterialIcons
                name="today"
                size={40}
                color={theme.colors.zodiacColour}
              />
            </View>
            <ThemedText style={styles.heading}>
              {isTodayFilter ? "Nothing for today" : "Nothing this week"}
            </ThemedText>
            <ThemedText style={styles.subtext}>
              {isTodayFilter
                ? "Cases with a hearing today or filed today will appear here."
                : "Cases with a hearing or filing this week will appear here."}
            </ThemedText>
            <Link href="/add-case-flow" asChild>
              <Bounceable style={styles.addButton}>
                <MaterialIcons
                  name="add"
                  size={22}
                  color={theme.colors.pureWhite}
                />
                <ThemedText style={styles.addButtonText}>Add Case</ThemedText>
              </Bounceable>
            </Link>
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
      </SafeAreaView>
    );
  }

  const sections: { title: string; data: CaseRow[] }[] = [];
  if (isTodayFilter) {
    if (hearingsToday.length > 0) {
      sections.push({ title: "Hearings today", data: hearingsToday });
    }
    if (filedToday.length > 0) {
      sections.push({ title: "Filed today", data: filedToday });
    }
  } else {
    if (hearingsThisWeek.length > 0) {
      sections.push({ title: "Hearings this week", data: hearingsThisWeek });
    }
    if (filedThisWeek.length > 0) {
      sections.push({ title: "Filed this week", data: filedThisWeek });
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.container}>
        <Spacer.Column numberOfSpaces={1} />
        <ThemedText type="subtitle" style={styles.title}>
          {isTodayFilter ? "Today Cases" : "This week Cases"}
        </ThemedText>
        <Spacer.Column numberOfSpaces={4} />

        <View style={styles.filterRow}>
          <Pressable
            style={[styles.filterBtn, isTodayFilter && styles.filterBtnActive]}
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
          <Pressable
            style={[styles.filterBtn, !isTodayFilter && styles.filterBtnActive]}
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
        </View>
        <Spacer.Column numberOfSpaces={5} />
        <FlatList
          data={sections}
          keyExtractor={(item) => item.title}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={fetchCases}
              colors={[theme.colors.black]}
              tintColor={theme.colors.black}
            />
          }
          renderItem={({ item: section, index: sectionIndex }) => {
            // Calculate starting index for this section to keep staggered delay consistent
            const previousItemsCount = sections
              .slice(0, sectionIndex)
              .reduce((acc, s) => acc + s.data.length, 0);

            return (
              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle}>
                  {section.title}
                </ThemedText>
                <Spacer.Column numberOfSpaces={5} />
                {section.data.map((caseItem, itemIndex) => (
                  <CaseCard
                    key={caseItem.id}
                    index={previousItemsCount + itemIndex}
                    caseItem={caseItem}
                    onEdit={(caseId) => router.push(`/case/${caseId}/edit`)}
                    onDelete={handleDeleteCase}
                  />
                ))}
              </View>
            );
          }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </View>
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
  filterBtn: {
    paddingVertical: 10,
    width: "45%",
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
  errorText: {
    color: theme.colors.themeRed,
    marginTop: 8,
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

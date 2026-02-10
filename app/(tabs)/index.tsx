import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CaseCard } from "@/components/case-card";
import { ThemedText } from "@/components/themed-text";
import { theme } from "@/constants/theme";
import { useAuth } from "@/context/auth-context";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { CaseRow } from "@/types/case";
import { getTodayISO } from "@/types/case";

function getTodayCases(
  cases: CaseRow[],
  today: string
): { hearingsToday: CaseRow[]; filedToday: CaseRow[] } {
  const hearingsToday = cases.filter(
    (c) => c.next_hearing_date && c.next_hearing_date.slice(0, 10) === today
  );
  const filedToday = cases.filter(
    (c) => c.date_of_filing && c.date_of_filing.slice(0, 10) === today
  );
  return { hearingsToday, filedToday };
}

export default function HomeScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const today = getTodayISO();

  const fetchTodayCases = useCallback(async () => {
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
      .or(`next_hearing_date.eq.${today},date_of_filing.eq.${today}`);
    setLoading(false);
    if (e) {
      setError(e.message);
      setCases([]);
      return;
    }
    setCases((data as CaseRow[]) ?? []);
  }, [session?.user?.id, today]);

  useFocusEffect(
    useCallback(() => {
      fetchTodayCases();
    }, [fetchTodayCases])
  );

  const { hearingsToday, filedToday } = getTodayCases(cases, today);
  const hasAny = hearingsToday.length > 0 || filedToday.length > 0;

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
          <View style={styles.card}>
            <View style={styles.iconCircle}>
              <MaterialIcons
                name="today"
                size={40}
                color={theme.colors.zodiacColour}
              />
            </View>
            <ThemedText style={styles.heading}>Nothing for today</ThemedText>
            <ThemedText style={styles.subtext}>
              Cases with a hearing today or filed today will appear here.
            </ThemedText>
            <Link href="/add-case-flow" asChild>
              <Pressable style={styles.addButton}>
                <MaterialIcons name="add" size={22} color="#fff" />
                <ThemedText style={styles.addButtonText}>Add Case</ThemedText>
              </Pressable>
            </Link>
            <Pressable
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
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const sections: { title: string; data: CaseRow[] }[] = [];
  if (hearingsToday.length > 0) {
    sections.push({ title: "Hearings today", data: hearingsToday });
  }
  if (filedToday.length > 0) {
    sections.push({ title: "Filed today", data: filedToday });
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.container}>
        <ThemedText type="subtitle" style={styles.title}>
          Today
        </ThemedText>
        <FlatList
          data={sections}
          keyExtractor={(item) => item.title}
          renderItem={({ item: section }) => (
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>
                {section.title}
              </ThemedText>
              {section.data.map((caseItem) => (
                <CaseCard key={caseItem.id} caseItem={caseItem} />
              ))}
            </View>
          )}
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
    color: theme.colors.black,
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
    backgroundColor: "#E8EEF7",
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

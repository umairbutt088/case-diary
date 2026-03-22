import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ScreenHeader } from "@/components/ui/screen-header";
import { theme } from "@/constants/theme";
import { useAuth } from "@/context/auth-context";
import { getCaseHearingHistory } from "@/lib/case-hearings";
import { supabase } from "@/lib/supabase";
import { formatCaseDate, getCaseDisplayTitle, type CaseRow } from "@/types/case";
import type { CaseHearingRow } from "@/types/case-hearing";

export default function CaseHearingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("Hearing history");
  const [hearingHistory, setHearingHistory] = useState<CaseHearingRow[]>([]);

  useEffect(() => {
    if (!id || !session?.user?.id) {
      setLoading(false);
      setError("Invalid case.");
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);

      const [{ data: caseData }, history] = await Promise.all([
        supabase.from("cases").select("*").eq("id", id).single(),
        getCaseHearingHistory(id, session.user.id),
      ]);

      if (cancelled) return;

      if (caseData) {
        setTitle(getCaseDisplayTitle(caseData as CaseRow));
      }
      setHearingHistory(history);
      setLoading(false);
    })().catch(() => {
      if (cancelled) return;
      setError("Failed to load hearing history.");
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [id, session?.user?.id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ScreenHeader title="All hearings" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.black} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScreenHeader title="All hearings" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ThemedText style={styles.caseTitle}>{title}</ThemedText>
        {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}

        {hearingHistory.length === 0 ? (
          <ThemedText style={styles.emptyText}>No hearings recorded yet.</ThemedText>
        ) : (
          hearingHistory.map((entry) => (
            <View key={entry.id} style={styles.card}>
              <ThemedText style={styles.dateText}>
                {formatCaseDate(entry.hearing_date)}
              </ThemedText>
              <ThemedText style={styles.proceedingText}>
                {(entry.proceeding || entry.current_status || "Proceeding updated").trim()}
              </ThemedText>
              <ThemedText style={styles.nextText}>
                Next: {entry.next_status?.trim() || "—"} •{" "}
                {entry.next_hearing_date
                  ? formatCaseDate(entry.next_hearing_date)
                  : "No date"}
              </ThemedText>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  caseTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.black,
    marginBottom: 14,
  },
  card: {
    borderRadius: 12,
    backgroundColor: theme.colors.pureWhite,
    padding: 14,
    marginBottom: 12,
    ...theme.shadow,
  },
  dateText: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.black,
    marginBottom: 6,
  },
  proceedingText: {
    fontSize: 16,
    color: theme.colors.black,
    marginBottom: 6,
  },
  nextText: {
    fontSize: 13,
    color: theme.colors.gray50,
  },
  emptyText: {
    fontSize: 15,
    color: theme.colors.gray50,
  },
  errorText: {
    marginBottom: 10,
    color: theme.colors.themeRed,
    fontSize: 14,
  },
});

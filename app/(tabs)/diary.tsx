import AsyncStorage from "@react-native-async-storage/async-storage";
import { useIsFocused } from "@react-navigation/native";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { CopilotStep, useCopilot } from "react-native-copilot";

import { CaseCard } from "@/components/case-card";
import { ThemedText } from "@/components/themed-text";
import { ScreenHeader } from "@/components/ui/screen-header";
import { theme } from "@/constants/theme";
import { useAuth } from "@/context/auth-context";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { getCaseDisplayTitle, type CaseRow } from "@/types/case";

/** Wrapper that forwards copilot ref to a native View - required for measureLayout.
 * CopilotStep injects the copilot prop; we spread it onto a native View. */
function DiaryHeaderWithRef({
  copilot,
  title,
}: {
  copilot?: { ref: React.RefObject<View | null>; onLayout: () => void };
  title: string;
}) {
  return (
    <View ref={copilot?.ref as React.Ref<View>} onLayout={copilot?.onLayout} collapsable={false}>
      <ScreenHeader title={title} showBack={false} />
    </View>
  );
}

export default function DiaryScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { session } = useAuth();
  const { start } = useCopilot();
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const filteredCases = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return cases;
    return cases.filter((caseItem) =>
      getCaseDisplayTitle(caseItem).toLowerCase().includes(query),
    );
  }, [cases, searchQuery]);

  const fetchCases = useCallback(async (isSilent = false) => {
    if (!session?.user?.id || !isSupabaseConfigured) {
      setCases([]);
      setLoading(false);
      return;
    }
    
    // Only show loading if not silent
    if (!isSilent) {
      setLoading(true);
    }
    setError(null);
    const { data, error: e } = await supabase
      .from("cases")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });
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
      let cancelled = false;
      (async () => {
        await fetchCases(true);
        if (cancelled) return;
        const hasSeenTour = await AsyncStorage.getItem(
          "hasSeenDiaryTourCopilot",
        );
        if (!hasSeenTour) {
          setTimeout(() => {
            if (cancelled) return;
            start();
            AsyncStorage.setItem("hasSeenDiaryTourCopilot", "true");
          }, 600);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [fetchCases, start]),
  );

  const handleDeleteCase = useCallback(
    (caseId: string) => {
      Alert.alert(
        "Delete case?",
        "This cannot be undone.",
        [
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
        ]
      );
    },
    [session?.user?.id, fetchCases]
  );

  if (loading && cases.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ScreenHeader title="Your cases" showBack={false} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.black} />
        </View>
      </SafeAreaView>
    );
  }

  if (error && cases.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <CopilotStep
          text="This is your diary of all cases. Pull down to refresh."
          order={1}
          name="diary-welcome"
          active={isFocused}
        >
          <DiaryHeaderWithRef title="Your cases" />
        </CopilotStep>
        <View style={styles.container}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  if (cases.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <CopilotStep
          text="This is your diary of all cases. Add cases from the Add button or Home."
          order={1}
          name="diary-welcome"
          active={isFocused}
        >
          <DiaryHeaderWithRef title="Your cases" />
        </CopilotStep>
        <View style={styles.container}>
          <ThemedText style={styles.placeholder}>
            No cases yet. Add a case from the Add button or Home.
          </ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <CopilotStep
        text="This is your diary of all cases. Pull down to refresh."
        order={1}
        name="diary-welcome"
        active={isFocused}
      >
        <DiaryHeaderWithRef title="Your cases" />
      </CopilotStep>
      <Animated.View 
        style={{ flex: 1 }}
        entering={FadeInUp.duration(400).springify().damping(20)}
      >
        <View style={styles.container}>
          <View style={styles.searchRow}>
            <ThemedText style={styles.searchIcon}>🔍</ThemedText>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search case by name"
              placeholderTextColor={theme.colors.gray50}
              style={styles.searchInput}
            />
          </View>
          <FlatList
            data={filteredCases}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl
                refreshing={loading}
                onRefresh={fetchCases}
                colors={[theme.colors.black]}
                tintColor={theme.colors.black}
              />
            }
            renderItem={({ item }) => (
            <CaseCard
              caseItem={item}
              onEdit={(caseId) => router.push(`/case/${caseId}/edit`)}
              onDelete={handleDeleteCase}
            />
          )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.noResultsWrap}>
                <ThemedText style={styles.noResultsTitle}>No matching case</ThemedText>
                <ThemedText style={styles.noResultsText}>
                  Try another case name.
                </ThemedText>
              </View>
            }
          />
        </View>
      </Animated.View>
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
  title: {
    marginBottom: 12,
    color: theme.colors.black,
  },
  listContent: {
    paddingBottom: 24,
  },
  searchRow: {
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    borderRadius: 10,
    backgroundColor: theme.colors.pureWhite,
    minHeight: 44,
    paddingHorizontal: 12,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchIcon: {
    fontSize: 14,
    color: theme.colors.gray50,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.black,
    fontSize: 14,
    paddingVertical: 10,
  },
  noResultsWrap: {
    marginTop: 18,
    padding: 14,
    borderRadius: 10,
    backgroundColor: theme.colors.pureWhite,
    ...theme.shadow,
  },
  noResultsTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.black,
    textAlign: "center",
  },
  noResultsText: {
    marginTop: 6,
    fontSize: 13,
    color: theme.colors.gray50,
    textAlign: "center",
  },
  placeholder: {
    opacity: 0.8,
    color: theme.colors.black,
  },
  errorText: {
    color: theme.colors.themeRed,
    marginTop: 8,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});

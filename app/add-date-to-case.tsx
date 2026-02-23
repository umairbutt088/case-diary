import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { theme } from "@/constants/theme";
import { useAuth } from "@/context/auth-context";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { CaseRow } from "@/types/case";
import { formatCaseDate, getCaseDisplayTitle } from "@/types/case";

/** Parse YYYY-MM-DD from param; fallback to today */
function getDateParam(param: string | undefined): string {
  if (!param || param.length < 10) {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  return param.slice(0, 10);
}

export default function AddDateToCaseScreen() {
  const router = useRouter();
  const { date: dateParam } = useLocalSearchParams<{ date?: string }>();
  const selectedDate = getDateParam(dateParam);
  const formattedDate = formatCaseDate(selectedDate);

  const { session } = useAuth();
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchCases = useCallback(async () => {
    if (!session?.user?.id || !isSupabaseConfigured) {
      setCases([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: e } = await supabase
      .from("cases")
      .select("*")
      .eq("user_id", session.user.id)
      .order("updated_at", { ascending: false });
    setLoading(false);
    if (e) {
      setCases([]);
      setError(e.message);
      return;
    }
    setCases((data as CaseRow[]) ?? []);
  }, [session?.user?.id]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  const filteredCases = useMemo(() => {
    if (!search.trim()) return cases;
    const q = search.trim().toLowerCase();
    return cases.filter((c) => {
      const title = getCaseDisplayTitle(c).toLowerCase();
      const num = (c.case_number ?? "").toLowerCase();
      const type = (c.case_type ?? "").toLowerCase();
      return title.includes(q) || num.includes(q) || type.includes(q);
    });
  }, [cases, search]);

  const handleSelectCase = useCallback(
    async (caseItem: CaseRow) => {
      if (!isSupabaseConfigured) {
        setError("Database not configured");
        return;
      }
      setSavingId(caseItem.id);
      setError(null);
      const { error: e } = await supabase
        .from("cases")
        .update({
          next_hearing_date: selectedDate,
          updated_at: new Date().toISOString(),
        })
        .eq("id", caseItem.id)
        .eq("user_id", session?.user?.id ?? "");

      setSavingId(null);
      if (e) {
        setError(e.message);
        return;
      }
      setError(null);
      router.back();
    },
    [selectedDate, session?.user?.id, router]
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons
            name="arrow-back"
            size={24}
            color={theme.colors.btnBlue}
          />
        </Pressable>
        <ThemedText style={styles.headerTitle} numberOfLines={1}>
          Add date to {formattedDate}
        </ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.processCard}>
        <ThemedText style={styles.processTitle}>How it works</ThemedText>
        <ThemedText
          style={styles.processSteps}
          lightColor={theme.colors.gray50}
          darkColor={theme.colors.gray50}
        >
          1. Search or scroll to find your case.{"\n"}
          2. Tap the case to set its next hearing date to {formattedDate}.
        </ThemedText>
      </View>

      <View style={styles.searchWrap}>
        <MaterialIcons
          name="search"
          size={20}
          color={theme.colors.gray50}
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search cases by title, number, or type..."
          placeholderTextColor={theme.colors.gray50}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {error ? (
        <ThemedText style={styles.errorText}>{error}</ThemedText>
      ) : null}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.black} />
        </View>
      ) : filteredCases.length === 0 ? (
        <ThemedText
          style={styles.empty}
          lightColor={theme.colors.gray50}
          darkColor={theme.colors.gray50}
        >
          {search.trim()
            ? "No cases match your search."
            : "You have no cases yet. Add a case first."}
        </ThemedText>
      ) : (
        <FlatList
          data={filteredCases}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const isSaving = savingId === item.id;
            const title = getCaseDisplayTitle(item);
            const subtitle = item.case_number
              ? `#${item.case_number}${item.case_type ? ` · ${item.case_type}` : ""}`
              : item.case_type ?? "";

            return (
              <Pressable
                style={styles.caseRow}
                onPress={() => handleSelectCase(item)}
                disabled={isSaving}
              >
                <View style={styles.caseRowText}>
                  <ThemedText style={styles.caseRowTitle} numberOfLines={1}>
                    {title}
                  </ThemedText>
                  {subtitle ? (
                    <ThemedText
                      style={styles.caseRowSubtitle}
                      numberOfLines={1}
                      lightColor={theme.colors.gray50}
                      darkColor={theme.colors.gray50}
                    >
                      {subtitle}
                    </ThemedText>
                  ) : null}
                </View>
                {isSaving ? (
                  <ActivityIndicator
                    size="small"
                    color={theme.colors.black}
                  />
                ) : (
                  <MaterialIcons
                    name="chevron-right"
                    size={24}
                    color={theme.colors.gray50}
                  />
                )}
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.borderGray,
  },
  backBtn: {
    padding: 8,
    marginRight: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.black,
  },
  headerSpacer: {
    width: 40,
  },
  processCard: {
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.cream50,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.btnBlue,
  },
  processTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.colors.black,
    marginBottom: 6,
  },
  processSteps: {
    fontSize: 14,
    lineHeight: 22,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.pureWhite,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.black,
    paddingVertical: 0,
  },
  errorText: {
    fontSize: 14,
    color: theme.colors.themeRed,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  empty: {
    fontSize: 15,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  caseRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.cream50,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    ...theme.shadow,
  },
  caseRowText: {
    flex: 1,
    minWidth: 0,
    marginRight: 12,
  },
  caseRowTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: theme.colors.black,
  },
  caseRowSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
});

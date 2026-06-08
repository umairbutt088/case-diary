/**
 * Disposed cases — finished matters kept for record (not Trash).
 */
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { Bounceable } from "@/components/ui/bounceable";
import { ScreenHeader } from "@/components/ui/screen-header";
import type { AppColors } from "@/constants/color-palette";
import { useAuth } from "@/context/auth-context";
import { useAccessGuard } from "@/hooks/use-access-guard";
import { useHomeBackNavigation } from "@/hooks/use-home-back-navigation";
import { useIsOnline } from "@/hooks/use-is-online";
import { useThemePalette } from "@/hooks/use-theme-palette";
import { upsertCachedCase } from "@/lib/cases-cache";
import { supabase } from "@/lib/supabase";
import type { CaseRow } from "@/types/case";
import { formatCaseDate, getCaseDisplayTitle } from "@/types/case";

function createStyles(C: AppColors) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: C.background,
    },
    hintBanner: {
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 4,
      padding: 12,
      borderRadius: 10,
      backgroundColor: C.grey100,
    },
    hintText: {
      fontSize: 13,
      lineHeight: 18,
      color: C.gray50,
    },
    emptyWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 32,
      gap: 12,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: C.themeBlack,
      textAlign: "center",
    },
    emptySubtitle: {
      fontSize: 14,
      color: C.gray50,
      textAlign: "center",
      lineHeight: 20,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 40,
    },
    card: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: C.pureWhite,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.borderGray,
      padding: 12,
      marginBottom: 10,
      gap: 10,
    },
    cardBody: {
      flex: 1,
      minWidth: 0,
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: C.black,
    },
    cardMeta: {
      marginTop: 4,
      fontSize: 13,
      color: C.gray50,
    },
    restoreBtn: {
      padding: 8,
    },
  });
}

export default function DisposedCasesScreen() {
  const router = useRouter();
  const { goBack } = useHomeBackNavigation();
  const { session, effectiveOwnerId, can } = useAuth();
  const accessGuard = useAccessGuard("view_cases");
  const isOnline = useIsOnline();
  const C = useThemePalette();
  const styles = createStyles(C);

  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(false);

  const canRestore = can("edit_cases") && can("dispose_cases");

  const fetchDisposed = useCallback(async () => {
    if (!session?.user?.id || !effectiveOwnerId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("cases")
      .select("*")
      .eq("user_id", effectiveOwnerId)
      .is("deleted_at", null)
      .not("disposed_at", "is", null)
      .order("disposed_at", { ascending: false });
    setLoading(false);
    if (error) {
      Alert.alert("Error", error.message);
      return;
    }
    setCases((data as CaseRow[]) ?? []);
  }, [session?.user?.id, effectiveOwnerId]);

  useFocusEffect(
    useCallback(() => {
      void fetchDisposed();
    }, [fetchDisposed]),
  );

  const handleRestore = useCallback(
    (caseItem: CaseRow) => {
      Alert.alert(
        "Restore to active?",
        `"${getCaseDisplayTitle(caseItem)}" will reappear in your diary and cause lists.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Restore",
            onPress: async () => {
              if (!session?.user?.id || !effectiveOwnerId) return;
              if (!canRestore) {
                Alert.alert("Restricted", "You do not have permission to restore disposed cases.");
                return;
              }
              if (!isOnline) {
                Alert.alert("Offline", "You need to be online to restore a case.");
                return;
              }
              const { data, error } = await supabase
                .from("cases")
                .update({ disposed_at: null, disposal_note: null })
                .eq("id", caseItem.id)
                .eq("user_id", effectiveOwnerId)
                .select("*")
                .single();
              if (error) {
                Alert.alert("Error", error.message);
                return;
              }
              await upsertCachedCase(session.user.id, data as CaseRow);
              setCases((prev) => prev.filter((c) => c.id !== caseItem.id));
            },
          },
        ],
      );
    },
    [session?.user?.id, effectiveOwnerId, isOnline, canRestore],
  );

  const renderItem = useCallback(
    ({ item }: { item: CaseRow }) => (
      <View style={styles.card}>
        <Bounceable
          style={styles.cardBody}
          onPress={() => router.push(`/case/${item.id}` as never)}
        >
          <Text style={styles.cardTitle} numberOfLines={2}>
            {getCaseDisplayTitle(item)}
          </Text>
          <Text style={styles.cardMeta}>
            Disposed {formatCaseDate(item.disposed_at?.slice(0, 10) ?? null)}
            {item.case_number ? ` · ${item.case_number}` : ""}
          </Text>
          {item.disposal_note ? (
            <Text style={styles.cardMeta} numberOfLines={2}>
              {item.disposal_note}
            </Text>
          ) : null}
        </Bounceable>
        {canRestore ? (
          <Pressable
            style={styles.restoreBtn}
            onPress={() => handleRestore(item)}
            accessibilityLabel="Restore case"
          >
            <MaterialIcons name="restore" size={22} color="#2E7D32" />
          </Pressable>
        ) : null}
      </View>
    ),
    [canRestore, handleRestore, router, styles],
  );

  if (accessGuard.blocked) return null;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ScreenHeader title="Disposed cases" onBack={goBack} />

      {cases.length > 0 ? (
        <View style={styles.hintBanner}>
          <ThemedText style={styles.hintText}>
            These cases are finished and hidden from active lists. Tap a case to
            view details, or restore to bring it back to your diary.
          </ThemedText>
        </View>
      ) : null}

      {!loading && cases.length === 0 ? (
        <View style={styles.emptyWrap}>
          <MaterialIcons name="inventory-2" size={64} color={C.gray50} />
          <Text style={styles.emptyTitle}>No disposed cases</Text>
          <Text style={styles.emptySubtitle}>
            When a case is finished, mark it as disposed from the case detail
            screen. It will appear here for your records.
          </Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.listContent}
          data={cases}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshing={loading}
          onRefresh={() => void fetchDisposed()}
        />
      )}
    </SafeAreaView>
  );
}

/**
 * Trash / Recycle Bin screen.
 * Shows cases that have been soft-deleted (deleted_at IS NOT NULL).
 * Users can restore a case (clears deleted_at) or permanently delete it.
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
import { ScreenHeader } from "@/components/ui/screen-header";
import type { AppColors } from "@/constants/color-palette";
import { useAuth } from "@/context/auth-context";
import { useIsOnline } from "@/hooks/use-is-online";
import { useThemePalette } from "@/hooks/use-theme-palette";
import { addPendingCaseHardDelete } from "@/lib/offline-queue";
import { supabase } from "@/lib/supabase";
import type { CaseRow } from "@/types/case";
import { getCaseDisplayTitle } from "@/types/case";

function formatRelative(isoString: string | null): string {
  if (!isoString) return "";
  const deletedMs = new Date(isoString).getTime();
  const diffMs = Date.now() - deletedMs;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

function createStyles(C: AppColors) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: C.background,
    },
    emptyWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 32,
      gap: 12,
    },
    emptyIcon: {
      marginBottom: 4,
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
    list: {
      flex: 1,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 40,
    },
    emptyTrashBtn: {
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 4,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 10,
      backgroundColor: "#FDECEA",
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    emptyTrashBtnText: {
      fontSize: 14,
      fontWeight: "600",
      color: "#C62828",
    },
    card: {
      backgroundColor: C.pureWhite,
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 2,
    },
    cardIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "#FFF3E0",
      alignItems: "center",
      justifyContent: "center",
    },
    cardBody: {
      flex: 1,
    },
    cardTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: C.themeBlack,
    },
    cardMeta: {
      fontSize: 12,
      color: C.gray50,
      marginTop: 2,
    },
    cardActions: {
      flexDirection: "row",
      gap: 8,
    },
    actionBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.background,
    },
    hintBanner: {
      marginHorizontal: 16,
      marginTop: 4,
      marginBottom: 8,
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: C.pureWhite,
      borderRadius: 10,
      borderLeftWidth: 3,
      borderLeftColor: "#FFA726",
    },
    hintText: {
      fontSize: 12,
      color: C.gray50,
      lineHeight: 17,
    },
  });
}

export default function TrashScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const isOnline = useIsOnline();
  const C = useThemePalette();
  const styles = createStyles(C);

  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDeleted = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("cases")
      .select("*")
      .eq("user_id", session.user.id)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false });
    setLoading(false);
    if (error) {
      Alert.alert("Error", error.message);
      return;
    }
    setCases((data as CaseRow[]) ?? []);
  }, [session?.user?.id]);

  useFocusEffect(
    useCallback(() => {
      void fetchDeleted();
    }, [fetchDeleted]),
  );

  const handleRestore = useCallback(
    (caseItem: CaseRow) => {
      Alert.alert(
        "Restore case?",
        `"${getCaseDisplayTitle(caseItem)}" will be moved back to your active cases.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Restore",
            onPress: async () => {
              if (!session?.user?.id) return;
              const { error } = await supabase
                .from("cases")
                .update({ deleted_at: null })
                .eq("id", caseItem.id)
                .eq("user_id", session.user.id);
              if (error) {
                Alert.alert("Error", error.message);
              } else {
                setCases((prev) => prev.filter((c) => c.id !== caseItem.id));
              }
            },
          },
        ],
      );
    },
    [session?.user?.id],
  );

  const handlePermanentDelete = useCallback(
    (caseItem: CaseRow) => {
      Alert.alert(
        "Delete permanently?",
        `"${getCaseDisplayTitle(caseItem)}" and all its data will be removed forever. This cannot be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete Forever",
            style: "destructive",
            onPress: async () => {
              if (!session?.user?.id) return;
              if (!isOnline) {
                await addPendingCaseHardDelete(session.user.id, caseItem.id);
                setCases((prev) => prev.filter((c) => c.id !== caseItem.id));
                Alert.alert(
                  "Queued",
                  "Case will be permanently deleted when internet is available.",
                );
                return;
              }
              const { error } = await supabase
                .from("cases")
                .delete()
                .eq("id", caseItem.id)
                .eq("user_id", session.user.id);
              if (error) {
                Alert.alert("Error", error.message);
              } else {
                setCases((prev) => prev.filter((c) => c.id !== caseItem.id));
              }
            },
          },
        ],
      );
    },
    [session?.user?.id, isOnline],
  );

  const handleEmptyTrash = useCallback(() => {
    if (cases.length === 0) return;
    Alert.alert(
      "Empty Trash?",
      `All ${cases.length} case${cases.length === 1 ? "" : "s"} in Trash will be permanently deleted. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Empty Trash",
          style: "destructive",
          onPress: async () => {
            if (!session?.user?.id) return;
            const ids = cases.map((c) => c.id);
            const { error } = await supabase
              .from("cases")
              .delete()
              .eq("user_id", session.user.id)
              .in("id", ids);
            if (error) {
              Alert.alert("Error", error.message);
            } else {
              setCases([]);
            }
          },
        },
      ],
    );
  }, [cases, session?.user?.id]);

  const renderItem = useCallback(
    ({ item }: { item: CaseRow }) => (
      <View style={styles.card}>
        <View style={styles.cardIcon}>
          <MaterialIcons name="folder-delete" size={22} color="#FFA726" />
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {getCaseDisplayTitle(item)}
          </Text>
          <Text style={styles.cardMeta}>
            Deleted {formatRelative(item.deleted_at)}
            {item.case_number ? ` · ${item.case_number}` : ""}
          </Text>
        </View>
        <View style={styles.cardActions}>
          <Pressable
            style={styles.actionBtn}
            onPress={() => handleRestore(item)}
            accessibilityLabel="Restore case"
            accessibilityRole="button"
          >
            <MaterialIcons name="restore" size={20} color="#2E7D32" />
          </Pressable>
          <Pressable
            style={styles.actionBtn}
            onPress={() => handlePermanentDelete(item)}
            accessibilityLabel="Delete permanently"
            accessibilityRole="button"
          >
            <MaterialIcons name="delete-forever" size={20} color="#C62828" />
          </Pressable>
        </View>
      </View>
    ),
    [styles, handleRestore, handlePermanentDelete],
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ScreenHeader title="Trash" onBack={() => router.back()} />

      {cases.length > 0 && (
        <>
          <View style={styles.hintBanner}>
            <ThemedText style={styles.hintText}>
              Cases here are hidden from your diary. Tap{" "}
              <ThemedText style={[styles.hintText, { fontWeight: "700" }]}>
                restore
              </ThemedText>{" "}
              to recover a case, or{" "}
              <ThemedText style={[styles.hintText, { fontWeight: "700" }]}>
                delete forever
              </ThemedText>{" "}
              to remove it permanently.
            </ThemedText>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.emptyTrashBtn,
              pressed && { opacity: 0.7 },
            ]}
            onPress={handleEmptyTrash}
            accessibilityRole="button"
            accessibilityLabel="Empty Trash"
          >
            <MaterialIcons name="delete-sweep" size={18} color="#C62828" />
            <Text style={styles.emptyTrashBtnText}>
              Empty Trash ({cases.length})
            </Text>
          </Pressable>
        </>
      )}

      {!loading && cases.length === 0 ? (
        <View style={styles.emptyWrap}>
          <MaterialIcons
            name="delete-outline"
            size={64}
            color={C.gray50}
            style={styles.emptyIcon}
          />
          <Text style={styles.emptyTitle}>Trash is Empty</Text>
          <Text style={styles.emptySubtitle}>
            Cases you delete will appear here. You can restore them or
            permanently remove them from this screen.
          </Text>
        </View>
      ) : (
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={cases}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshing={loading}
          onRefresh={fetchDeleted}
        />
      )}
    </SafeAreaView>
  );
}

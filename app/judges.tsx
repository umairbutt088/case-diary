import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AddJudgeBottomSheet } from "@/components/add-case/add-judge-bottom-sheet";
import { CourtTierPicker } from "@/components/add-case/court-tier-picker";
import { ThemedText } from "@/components/themed-text";
import { Bounceable } from "@/components/ui/bounceable";
import { ScreenHeader } from "@/components/ui/screen-header";
import { ListPageFooter } from "@/components/ui/list-page-footer";
import {
  type AppColors,
  modalSheetBackground,
} from "@/constants/color-palette";
import { theme } from "@/constants/theme";
import { useAppTheme } from "@/context/app-theme-context";
import { useAuth } from "@/context/auth-context";
import { useAccessGuard } from "@/hooks/use-access-guard";
import { useHomeBackNavigation } from "@/hooks/use-home-back-navigation";
import { useThemePalette } from "@/hooks/use-theme-palette";
import { setCachedJudges } from "@/lib/offline-reference-data";
import {
  getPageRange,
  hasAnotherPage,
  mergeUniqueById,
} from "@/lib/pagination";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type JudgeRow = {
  id: string;
  user_id: string;
  name: string;
  court_tier: string | null;
  court_room_address: string | null;
  created_at: string;
};

type JudgeFormState = {
  name: string;
  court_tier: string;
  court_room_address: string;
};

const initialForm: JudgeFormState = {
  name: "",
  court_tier: "",
  court_room_address: "",
};

function createJudgesStyles(
  C: AppColors,
  onPrimary: string,
  modalSheet: string,
) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: C.background,
    },
    container: {
      flex: 1,
      padding: 20,
    },
    headerAction: {
      minHeight: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      paddingHorizontal: 10,
      gap: 4,
    },
    headerActionText: {
      fontSize: 12,
      fontWeight: "700",
    },
    searchWrap: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: C.borderGray,
      borderRadius: 10,
      backgroundColor: C.pureWhite,
      paddingHorizontal: 12,
      marginBottom: 14,
      gap: 8,
    },
    searchInput: {
      color: C.textPrimary,
      flex: 1,
      minHeight: 44,
      fontSize: 15,
    },
    listContent: {
      paddingBottom: 24,
    },
    card: {
      borderRadius: 12,
      padding: 14,
      marginBottom: 12,
      backgroundColor: C.pureWhite,
      ...theme.shadow,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    nameText: {
      fontSize: 17,
      fontWeight: "700",
      flex: 1,
      marginRight: 8,
    },
    cardActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
    },
    iconBtn: {
      minWidth: 32,
      minHeight: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    metaText: {
      fontSize: 13,
      marginBottom: 2,
    },
    usageText: {
      marginTop: 4,
      fontSize: 12,
      color: C.zodiacColour,
      fontWeight: "600",
    },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 20,
      gap: 10,
    },
    errorText: {
      fontSize: 14,
      textAlign: "center",
    },
    emptyText: {
      fontSize: 14,
      textAlign: "center",
    },
    retryBtn: {
      borderRadius: 10,
      backgroundColor: C.themeBlack,
      paddingVertical: 10,
      paddingHorizontal: 16,
    },
    retryBtnText: {
      color: onPrimary,
      fontSize: 14,
      fontWeight: "600",
    },
    modalRoot: {
      flex: 1,
      justifyContent: "flex-end",
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.35)",
    },
    modalCard: {
      backgroundColor: modalSheet,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      maxHeight: "80%",
      padding: 16,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "700",
    },
    modalClose: {
      minWidth: 32,
      minHeight: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.background,
    },
    modalContent: {
      paddingBottom: 12,
    },
    inputLabel: {
      fontSize: 12,
      fontWeight: "600",
      textTransform: "uppercase",
      marginBottom: 6,
      marginTop: 10,
    },
    input: {
      borderWidth: 1,
      borderColor: C.borderGray,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: C.textPrimary,
      backgroundColor: C.background,
    },
    tierPickerWrap: {
      marginTop: 8,
    },
    formErrorText: {
      marginTop: 10,
      fontSize: 13,
    },
    saveBtn: {
      marginTop: 16,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.themeBlack,
    },
    saveBtnText: {
      color: onPrimary,
      fontSize: 15,
      fontWeight: "600",
    },
  });
}

export default function JudgesScreen() {
  const { goBack } = useHomeBackNavigation();
  const { session, effectiveOwnerId } = useAuth();
  const accessGuard = useAccessGuard("add_cases", "edit_cases");
  const C = useThemePalette();
  const { isDark } = useAppTheme();
  const onPrimary = C.textInverse;
  const modalSheet = modalSheetBackground(C, isDark);
  const styles = useMemo(
    () => createJudgesStyles(C, onPrimary, modalSheet),
    [C, onPrimary, modalSheet],
  );
  const [judges, setJudges] = useState<JudgeRow[]>([]);
  const [usageByJudgeId, setUsageByJudgeId] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [editingJudge, setEditingJudge] = useState<JudgeRow | null>(null);
  const [form, setForm] = useState<JudgeFormState>(initialForm);

  const loadJudgeUsage = useCallback(async () => {
    if (!session?.user?.id || !effectiveOwnerId || !isSupabaseConfigured) {
      setUsageByJudgeId({});
      return;
    }

    const [judgesRes, casesRes] = await Promise.all([
      supabase
        .from("judges")
        .select("id, name, court_tier")
        .eq("user_id", effectiveOwnerId),
      supabase
        .from("cases")
        .select("judge_name, court_tier")
        .eq("user_id", effectiveOwnerId),
    ]);

    const rows = ((judgesRes.data as Pick<JudgeRow, "id" | "name" | "court_tier">[]) ?? []).map(
      (row) => ({
        ...row,
        court_tier: row.court_tier?.trim() || null,
      }),
    );

    const usage: Record<string, number> = {};
    rows.forEach((row) => {
      usage[row.id] = 0;
    });

    const caseRows =
      (casesRes.data as { judge_name: string | null; court_tier: string | null }[]) ?? [];
    caseRows.forEach((caseRow) => {
      const caseJudgeName = caseRow.judge_name?.trim().toLowerCase();
      if (!caseJudgeName) return;
      const caseTier = caseRow.court_tier?.trim().toLowerCase() || "";

      const matched = rows.find((judge) => {
        if (judge.name.trim().toLowerCase() !== caseJudgeName) return false;
        const judgeTier = judge.court_tier?.trim().toLowerCase() || "";
        return judgeTier ? judgeTier === caseTier : true;
      });
      if (matched) {
        usage[matched.id] = (usage[matched.id] ?? 0) + 1;
      }
    });

    setUsageByJudgeId(usage);
  }, [session?.user?.id, effectiveOwnerId]);

  const syncJudgeCache = useCallback(async () => {
    if (!session?.user?.id || !effectiveOwnerId || !isSupabaseConfigured) return;

    const { data } = await supabase
      .from("judges")
      .select("id, user_id, name, court_tier, court_room_address, created_at")
      .eq("user_id", effectiveOwnerId)
      .order("name", { ascending: true });

    const allRows = ((data as JudgeRow[]) ?? []).map((row) => ({
      ...row,
      court_tier: row.court_tier?.trim() || null,
      court_room_address: row.court_room_address?.trim() || null,
    }));

    await setCachedJudges(
      session.user.id,
      allRows.map((row) => ({
        name: row.name,
        courtTier: row.court_tier || "",
        courtRoomAddress: row.court_room_address,
      })),
    );
  }, [session?.user?.id, effectiveOwnerId]);

  const loadJudges = useCallback(
    async ({
      reset,
      offset = 0,
      searchQuery = search,
    }: {
      reset: boolean;
      offset?: number;
      searchQuery?: string;
    }) => {
      if (!session?.user?.id || !effectiveOwnerId || !isSupabaseConfigured) {
        setJudges([]);
        setHasMore(false);
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      const pageOffset = reset ? 0 : Math.max(0, offset);
      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      const { from, to } = getPageRange(pageOffset);
      let query = supabase
        .from("judges")
        .select("id, user_id, name, court_tier, court_room_address, created_at")
        .eq("user_id", effectiveOwnerId);

      const q = searchQuery.trim();
      if (q) {
        const pattern = `%${q}%`;
        query = query.or(
          `name.ilike.${pattern},court_tier.ilike.${pattern},court_room_address.ilike.${pattern}`,
        );
      }

      const { data, error: judgesError } = await query
        .order("name", { ascending: true })
        .range(from, to);

      setLoading(false);
      setLoadingMore(false);

      if (judgesError) {
        if (reset) {
          setError(judgesError.message || "Failed to load judges.");
          setJudges([]);
        }
        setHasMore(false);
        return;
      }

      const chunk = ((data as JudgeRow[]) ?? []).map((row) => ({
        ...row,
        court_tier: row.court_tier?.trim() || null,
        court_room_address: row.court_room_address?.trim() || null,
      }));

      setJudges((prev) => (reset ? chunk : mergeUniqueById(prev, chunk)));
      setHasMore(hasAnotherPage(chunk.length));
    },
    [session?.user?.id, effectiveOwnerId, search],
  );

  const refreshJudges = useCallback(async () => {
    await Promise.all([
      loadJudgeUsage(),
      loadJudges({ reset: true }),
      syncJudgeCache(),
    ]);
  }, [loadJudgeUsage, loadJudges, syncJudgeCache]);

  const skipSearchEffect = useRef(true);

  useEffect(() => {
    void refreshJudges();
  }, [session?.user?.id, effectiveOwnerId]);

  useEffect(() => {
    if (skipSearchEffect.current) {
      skipSearchEffect.current = false;
      return;
    }
    const timer = setTimeout(() => {
      void loadJudges({ reset: true });
    }, 300);
    return () => clearTimeout(timer);
  }, [search, loadJudges]);

  const openAddModal = () => {
    setIsAddModalVisible(true);
  };

  const openEditModal = (judge: JudgeRow) => {
    setEditingJudge(judge);
    setForm({
      name: judge.name,
      court_tier: judge.court_tier ?? "",
      court_room_address: judge.court_room_address ?? "",
    });
    setFormError(null);
    setIsModalVisible(true);
  };

  const closeModal = () => {
    if (saving) return;
    setIsModalVisible(false);
    setFormError(null);
  };

  const refreshJudgeCache = async (items: JudgeRow[]) => {
    if (!session?.user?.id) return;
    await setCachedJudges(
      session.user.id,
      items.map((row) => ({
        name: row.name,
        courtTier: row.court_tier || "",
        courtRoomAddress: row.court_room_address,
      })),
    );
  };

  const saveJudge = async () => {
    if (!session?.user?.id || !effectiveOwnerId || !isSupabaseConfigured) return;
    const name = form.name.trim();
    const courtTier = form.court_tier.trim();
    if (!name) {
      setFormError("Judge name is required.");
      return;
    }
    if (!courtTier) {
      setFormError("Court tier is required.");
      return;
    }

    setSaving(true);
    setFormError(null);

    const payload = {
      name,
      court_tier: courtTier,
      court_room_address: form.court_room_address.trim() || null,
    };

    if (editingJudge) {
      const { data, error: e } = await supabase
        .from("judges")
        .update(payload)
        .eq("id", editingJudge.id)
        .eq("user_id", effectiveOwnerId)
        .select("id, user_id, name, court_tier, court_room_address, created_at")
        .single();

      setSaving(false);
      if (e) {
        setFormError(e.message || "Failed to update judge.");
        return;
      }

      const updated = data as JudgeRow;
      const next = judges.map((item) => (item.id === updated.id ? updated : item));
      setJudges(next);
      await refreshJudgeCache(next);
      await refreshJudges();
      setIsModalVisible(false);
      return;
    }

    const { data, error: e } = await supabase
      .from("judges")
      .insert({
        ...payload,
        user_id: effectiveOwnerId,
      })
      .select("id, user_id, name, court_tier, court_room_address, created_at")
      .single();

    setSaving(false);
    if (e) {
      if (e.code === "23505") {
        setFormError("This judge already exists for the selected court tier.");
      } else {
        setFormError(e.message || "Failed to add judge.");
      }
      return;
    }

    const created = data as JudgeRow;
    const next = [created, ...judges].sort((a, b) => a.name.localeCompare(b.name));
    setJudges(next);
    await refreshJudgeCache(next);
    await refreshJudges();
    setIsModalVisible(false);
  };

  const confirmDeleteJudge = (judge: JudgeRow) => {
    const usedCount = usageByJudgeId[judge.id] ?? 0;
    Alert.alert(
      "Delete judge?",
      usedCount > 0
        ? `"${judge.name}" is used in ${usedCount} case${usedCount === 1 ? "" : "s"}. It will be removed from saved judges only.`
        : `This will remove "${judge.name}" from your saved judges list.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!session?.user?.id || !effectiveOwnerId || !isSupabaseConfigured) return;
            const { error: e } = await supabase
              .from("judges")
              .delete()
              .eq("id", judge.id)
              .eq("user_id", effectiveOwnerId);
            if (e) {
              Alert.alert("Delete failed", e.message || "Could not delete judge.");
              return;
            }
            const next = judges.filter((item) => item.id !== judge.id);
            setJudges(next);
            await refreshJudgeCache(next);
            await refreshJudges();
          },
        },
      ],
    );
  };

  if (accessGuard.blocked) return null;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScreenHeader
        title="Judges"
        onBack={goBack}
        rightComponent={
          <Bounceable style={styles.headerAction} onPress={openAddModal}>
            <MaterialIcons name="person-add-alt-1" size={20} color={C.textPrimary} />
            <ThemedText type="accent" style={styles.headerActionText}>Add judge</ThemedText>
          </Bounceable>
        }
      />

      <View style={styles.container}>
        <View style={styles.searchWrap}>
          <MaterialIcons name="search" size={20} color={C.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search judges..."
            placeholderTextColor={C.textMuted}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="words"
            autoCorrect={false}
            spellCheck={false}
          />
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={C.textPrimary} />
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <ThemedText type="danger" style={styles.errorText}>{error}</ThemedText>
            <Bounceable style={styles.retryBtn} onPress={() => void refreshJudges()}>
              <ThemedText style={styles.retryBtnText}>Retry</ThemedText>
            </Bounceable>
          </View>
        ) : judges.length === 0 ? (
          <View style={styles.centered}>
            <ThemedText type="muted" style={styles.emptyText}>
              {search.trim() ? "No judges match your search." : "No judges saved yet."}
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={judges}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onEndReachedThreshold={0.35}
            onEndReached={() => {
              if (!hasMore || loadingMore || loading) return;
              void loadJudges({ reset: false, offset: judges.length });
            }}
            ListFooterComponent={
              <ListPageFooter
                loading={loadingMore}
                hasMore={hasMore}
                itemCount={judges.length}
              />
            }
            renderItem={({ item: judge }) => (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <ThemedText type="accent" style={styles.nameText}>{judge.name}</ThemedText>
                  <View style={styles.cardActions}>
                    <Bounceable
                      style={styles.iconBtn}
                      onPress={() => openEditModal(judge)}
                      accessibilityLabel={`Edit ${judge.name}`}
                    >
                      <MaterialIcons name="edit" size={18} color={C.textPrimary} />
                    </Bounceable>
                    <Bounceable
                      style={styles.iconBtn}
                      onPress={() => confirmDeleteJudge(judge)}
                      accessibilityLabel={`Delete ${judge.name}`}
                    >
                      <MaterialIcons name="delete-outline" size={20} color={C.themeRed} />
                    </Bounceable>
                  </View>
                </View>
                <ThemedText type="secondary" style={styles.metaText}>Court tier: {judge.court_tier?.trim() || "—"}</ThemedText>
                <ThemedText type="secondary" style={styles.metaText}>
                  Court room: {judge.court_room_address?.trim() || "—"}
                </ThemedText>
                <ThemedText type="muted" style={styles.usageText}>
                  Used in {usageByJudgeId[judge.id] ?? 0} case
                  {(usageByJudgeId[judge.id] ?? 0) === 1 ? "" : "s"}
                </ThemedText>
              </View>
            )}
          />
        )}
      </View>

      <Modal visible={isModalVisible} transparent animationType="slide" onRequestClose={closeModal}>
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Pressable style={styles.modalOverlay} onPress={closeModal} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <ThemedText type="accent" style={styles.modalTitle}>
                {editingJudge ? "Edit Judge" : "Add Judge"}
              </ThemedText>
              <Bounceable style={styles.modalClose} onPress={closeModal}>
                <MaterialIcons name="close" size={20} color={C.textPrimary} />
              </Bounceable>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalContent}
            >
              <ThemedText type="label" style={styles.inputLabel}>Judge name</ThemedText>
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={(v) => setForm((prev) => ({ ...prev, name: v }))}
                placeholder="Judge name"
                placeholderTextColor={C.textMuted}
                autoCorrect={false}
                spellCheck={false}
              />

              <View style={styles.tierPickerWrap}>
                <CourtTierPicker
                  label="Court tier"
                  required
                  value={form.court_tier}
                  onChange={(v) => setForm((prev) => ({ ...prev, court_tier: v }))}
                  hint="Use the same tier list as case creation."
                />
              </View>

              <ThemedText type="label" style={styles.inputLabel}>Court room address</ThemedText>
              <TextInput
                style={styles.input}
                value={form.court_room_address}
                onChangeText={(v) => setForm((prev) => ({ ...prev, court_room_address: v }))}
                placeholder="e.g. Building A, 2nd Floor"
                placeholderTextColor={C.textMuted}
                autoCorrect={false}
                spellCheck={false}
              />

              {formError ? <ThemedText type="danger" style={styles.formErrorText}>{formError}</ThemedText> : null}

              <Bounceable style={styles.saveBtn} onPress={() => void saveJudge()} disabled={saving}>
                {saving ? (
                  <ActivityIndicator size="small" color={onPrimary} />
                ) : (
                  <ThemedText style={styles.saveBtnText}>
                    {editingJudge ? "Update judge" : "Save judge"}
                  </ThemedText>
                )}
              </Bounceable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <AddJudgeBottomSheet
        visible={isAddModalVisible}
        defaultCourtTier=""
        onClose={() => setIsAddModalVisible(false)}
        onSaved={() => {
          void refreshJudges();
          setIsAddModalVisible(false);
        }}
      />
    </SafeAreaView>
  );
}

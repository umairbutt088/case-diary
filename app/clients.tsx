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

import { AddNewClientModal } from "@/components/add-case/add-new-client-modal";
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
import {
  getPageRange,
  hasAnotherPage,
  mergeUniqueById,
} from "@/lib/pagination";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { ClientRow } from "@/types/client";

type ClientFormState = {
  name: string;
  address: string;
  phone: string;
  email: string;
  care_of: string;
};

const initialForm: ClientFormState = {
  name: "",
  address: "",
  phone: "",
  email: "",
  care_of: "",
};

function createClientsStyles(
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
    headerActionDisabled: {
      opacity: 0.45,
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
      color: C.themeRed,
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
      maxHeight: "85%",
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
      backgroundColor: C.background,
    },
    inputMultiline: {
      minHeight: 76,
      textAlignVertical: "top",
    },
    formErrorText: {
      marginTop: 10,
      color: C.themeRed,
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

export default function ClientsScreen() {
  const { goBack } = useHomeBackNavigation();
  const { session, effectiveOwnerId, can } = useAuth();
  const accessGuard = useAccessGuard("view_clients");
  const canAddCases = can("add_cases");
  const canEditCases = can("edit_cases");
  const canInsertClient = canAddCases || canEditCases;
  const C = useThemePalette();
  const { isDark } = useAppTheme();
  const onPrimary = C.textInverse;
  const modalSheet = modalSheetBackground(C, isDark);
  const styles = useMemo(
    () => createClientsStyles(C, onPrimary, modalSheet),
    [C, onPrimary, modalSheet],
  );
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [usageByClientId, setUsageByClientId] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientRow | null>(null);
  const [form, setForm] = useState<ClientFormState>(initialForm);

  const loadClientUsage = useCallback(async () => {
    if (!session?.user?.id || !effectiveOwnerId || !isSupabaseConfigured) {
      setUsageByClientId({});
      return;
    }

    const { data: casesRes, error: casesError } = await supabase
      .from("cases")
      .select("linked_client_id, linked_client_name")
      .eq("user_id", effectiveOwnerId);

    if (casesError) {
      setUsageByClientId({});
      return;
    }

    const { data: allClientsRes } = await supabase
      .from("clients")
      .select("id, name")
      .eq("user_id", effectiveOwnerId);

    const clientRows = (allClientsRes as { id: string; name: string }[]) ?? [];
    const usage: Record<string, number> = {};
    clientRows.forEach((client) => {
      usage[client.id] = 0;
    });

    const nameToIds = new Map<string, string[]>();
    clientRows.forEach((client) => {
      const key = client.name.trim().toLowerCase();
      const existing = nameToIds.get(key) ?? [];
      nameToIds.set(key, [...existing, client.id]);
    });

    const caseRows =
      (casesRes as { linked_client_id: string | null; linked_client_name: string | null }[]) ??
      [];
    caseRows.forEach((row) => {
      const linkedId = row.linked_client_id ?? "";
      if (linkedId && usage[linkedId] !== undefined) {
        usage[linkedId] += 1;
        return;
      }

      const linkedNameKey = row.linked_client_name?.trim().toLowerCase();
      if (!linkedNameKey) return;
      const matchingIds = nameToIds.get(linkedNameKey) ?? [];
      if (matchingIds.length === 1) {
        const matchedId = matchingIds[0];
        usage[matchedId] = (usage[matchedId] ?? 0) + 1;
      }
    });

    setUsageByClientId(usage);
  }, [session?.user?.id, effectiveOwnerId]);

  const loadClients = useCallback(
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
        setClients([]);
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
        .from("clients")
        .select("*")
        .eq("user_id", effectiveOwnerId);

      const q = searchQuery.trim();
      if (q) {
        const pattern = `%${q}%`;
        query = query.or(
          `name.ilike.${pattern},phone.ilike.${pattern},email.ilike.${pattern},address.ilike.${pattern},care_of.ilike.${pattern}`,
        );
      }

      const { data, error: clientsError } = await query
        .order("name", { ascending: true })
        .range(from, to);

      setLoading(false);
      setLoadingMore(false);

      if (clientsError) {
        if (reset) {
          setError(clientsError.message || "Failed to load clients.");
          setClients([]);
        }
        setHasMore(false);
        return;
      }

      const chunk = (data as ClientRow[]) ?? [];
      setClients((prev) => (reset ? chunk : mergeUniqueById(prev, chunk)));
      setHasMore(hasAnotherPage(chunk.length));
    },
    [session?.user?.id, effectiveOwnerId, search],
  );

  const refreshClients = useCallback(async () => {
    await Promise.all([loadClientUsage(), loadClients({ reset: true })]);
  }, [loadClientUsage, loadClients]);

  const skipSearchEffect = useRef(true);

  useEffect(() => {
    void refreshClients();
  }, [session?.user?.id, effectiveOwnerId]);

  useEffect(() => {
    if (skipSearchEffect.current) {
      skipSearchEffect.current = false;
      return;
    }
    const timer = setTimeout(() => {
      void loadClients({ reset: true });
    }, 300);
    return () => clearTimeout(timer);
  }, [search, loadClients]);

  const openAddModal = () => {
    setIsAddModalVisible(true);
  };

  const openEditModal = (client: ClientRow) => {
    setEditingClient(client);
    setForm({
      name: client.name,
      address: client.address ?? "",
      phone: client.phone ?? "",
      email: client.email ?? "",
      care_of: client.care_of ?? "",
    });
    setFormError(null);
    setIsModalVisible(true);
  };

  const closeModal = () => {
    if (saving) return;
    setIsModalVisible(false);
    setFormError(null);
  };

  const saveClient = async () => {
    if (!session?.user?.id || !effectiveOwnerId || !isSupabaseConfigured) return;
    if (editingClient && !canEditCases) return;
    if (!editingClient && !canInsertClient) return;
    const name = form.name.trim();
    if (!name) {
      setFormError("Client name is required.");
      return;
    }

    setSaving(true);
    setFormError(null);

    const payload = {
      name,
      address: form.address.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      care_of: form.care_of.trim() || null,
    };

    if (editingClient) {
      const { data, error: e } = await supabase
        .from("clients")
        .update(payload)
        .eq("id", editingClient.id)
        .eq("user_id", effectiveOwnerId)
        .select("*")
        .single();

      setSaving(false);
      if (e) {
        setFormError(e.message || "Failed to update client.");
        return;
      }

      const updated = data as ClientRow;
      setClients((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      await refreshClients();
      setIsModalVisible(false);
      return;
    }

    const { data, error: e } = await supabase
      .from("clients")
      .insert({
        ...payload,
        user_id: effectiveOwnerId,
      })
      .select("*")
      .single();

    setSaving(false);
    if (e) {
      if (e.code === "23505") {
        setFormError("This client already exists.");
      } else {
        setFormError(e.message || "Failed to add client.");
      }
      return;
    }

    const created = data as ClientRow;
    setClients((prev) => [created, ...prev].sort((a, b) => a.name.localeCompare(b.name)));
    await refreshClients();
    setIsModalVisible(false);
  };

  const confirmDeleteClient = (client: ClientRow) => {
    const usedCount = usageByClientId[client.id] ?? 0;
    Alert.alert(
      "Delete client?",
      usedCount > 0
        ? `"${client.name}" is linked in ${usedCount} case${usedCount === 1 ? "" : "s"}. It will be removed from saved clients only.`
        : `This will remove "${client.name}" from your saved clients list.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!session?.user?.id || !effectiveOwnerId || !isSupabaseConfigured) return;
            const { error: e } = await supabase
              .from("clients")
              .delete()
              .eq("id", client.id)
              .eq("user_id", effectiveOwnerId);
            if (e) {
              Alert.alert("Delete failed", e.message || "Could not delete client.");
              return;
            }
            setClients((prev) => prev.filter((item) => item.id !== client.id));
            await refreshClients();
          },
        },
      ],
    );
  };

  if (accessGuard.blocked) return null;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScreenHeader
        title="Clients"
        onBack={goBack}
        rightComponent={
          <Bounceable
            style={[styles.headerAction, !canInsertClient && styles.headerActionDisabled]}
            onPress={canInsertClient ? openAddModal : undefined}
            disabled={!canInsertClient}
          >
            <MaterialIcons name="person-add-alt-1" size={20} color={C.textPrimary} />
            <ThemedText type="accent" style={styles.headerActionText}>Add client</ThemedText>
          </Bounceable>
        }
      />

      <View style={styles.container}>
        <View style={styles.searchWrap}>
          <MaterialIcons name="search" size={20} color={C.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search clients..."
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
            <ThemedText style={styles.errorText}>{error}</ThemedText>
            <Bounceable style={styles.retryBtn} onPress={() => void refreshClients()}>
              <ThemedText style={styles.retryBtnText}>Retry</ThemedText>
            </Bounceable>
          </View>
        ) : clients.length === 0 ? (
          <View style={styles.centered}>
            <ThemedText type="muted" style={styles.emptyText}>
              {search.trim() ? "No clients match your search." : "No clients saved yet."}
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={clients}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onEndReachedThreshold={0.35}
            onEndReached={() => {
              if (!hasMore || loadingMore || loading) return;
              void loadClients({ reset: false, offset: clients.length });
            }}
            ListFooterComponent={
              <ListPageFooter
                loading={loadingMore}
                hasMore={hasMore}
                itemCount={clients.length}
              />
            }
            renderItem={({ item: client }) => (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <ThemedText type="accent" style={styles.nameText}>{client.name}</ThemedText>
                  <View style={styles.cardActions}>
                    <Bounceable
                      style={styles.iconBtn}
                      onPress={() => openEditModal(client)}
                      disabled={!canEditCases}
                      accessibilityLabel={`Edit ${client.name}`}
                    >
                      <MaterialIcons name="edit" size={18} color={C.textPrimary} />
                    </Bounceable>
                    <Bounceable
                      style={styles.iconBtn}
                      onPress={canEditCases ? () => confirmDeleteClient(client) : undefined}
                      disabled={!canEditCases}
                      accessibilityLabel={`Delete ${client.name}`}
                    >
                      <MaterialIcons name="delete-outline" size={20} color={C.themeRed} />
                    </Bounceable>
                  </View>
                </View>
                <ThemedText type="secondary" style={styles.metaText}>Phone: {client.phone?.trim() || "—"}</ThemedText>
                <ThemedText type="secondary" style={styles.metaText}>Email: {client.email?.trim() || "—"}</ThemedText>
                <ThemedText type="secondary" style={styles.metaText}>Address: {client.address?.trim() || "—"}</ThemedText>
                <ThemedText type="muted" style={styles.usageText}>
                  Used in {usageByClientId[client.id] ?? 0} case
                  {(usageByClientId[client.id] ?? 0) === 1 ? "" : "s"}
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
                {editingClient ? "Edit Client" : "Add Client"}
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
              <ThemedText type="label" style={styles.inputLabel}>Name</ThemedText>
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={(v) => setForm((prev) => ({ ...prev, name: v }))}
                placeholder="Client name"
                placeholderTextColor={C.textMuted}
                autoCorrect={false}
                spellCheck={false}
              />

              <ThemedText type="label" style={styles.inputLabel}>Phone</ThemedText>
              <TextInput
                style={styles.input}
                value={form.phone}
                onChangeText={(v) => setForm((prev) => ({ ...prev, phone: v }))}
                placeholder="Phone number"
                placeholderTextColor={C.textMuted}
                keyboardType="phone-pad"
                autoCorrect={false}
                spellCheck={false}
              />

              <ThemedText type="label" style={styles.inputLabel}>Email</ThemedText>
              <TextInput
                style={styles.input}
                value={form.email}
                onChangeText={(v) => setForm((prev) => ({ ...prev, email: v }))}
                placeholder="Email"
                placeholderTextColor={C.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                spellCheck={false}
              />

              <ThemedText type="label" style={styles.inputLabel}>Address</ThemedText>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={form.address}
                onChangeText={(v) => setForm((prev) => ({ ...prev, address: v }))}
                placeholder="Address"
                placeholderTextColor={C.textMuted}
                multiline
                autoCorrect={false}
                spellCheck={false}
              />

              {formError ? <ThemedText style={styles.formErrorText}>{formError}</ThemedText> : null}

              <Bounceable
                style={styles.saveBtn}
                onPress={() => void saveClient()}
                disabled={
                  saving ||
                  (editingClient ? !canEditCases : !canInsertClient)
                }
              >
                {saving ? (
                  <ActivityIndicator size="small" color={onPrimary} />
                ) : (
                  <ThemedText style={styles.saveBtnText}>
                    {editingClient ? "Update client" : "Save client"}
                  </ThemedText>
                )}
              </Bounceable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <AddNewClientModal
        visible={isAddModalVisible}
        onClose={() => setIsAddModalVisible(false)}
        onSaved={() => {
          void refreshClients();
          setIsAddModalVisible(false);
        }}
      />
    </SafeAreaView>
  );
}

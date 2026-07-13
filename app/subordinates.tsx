import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ScreenHeader } from "@/components/ui/screen-header";
import type { AppColors } from "@/constants/color-palette";
import { theme } from "@/constants/theme";
import { useAuth } from "@/context/auth-context";
import { useOwnerOnlyGuard } from "@/hooks/use-owner-only-guard";
import { useHomeBackNavigation } from "@/hooks/use-home-back-navigation";
import { useThemePalette } from "@/hooks/use-theme-palette";
import { supabase } from "@/lib/supabase";
import type { AccessPermission } from "@/types/access";
import type { ProfileRow } from "@/types/profile";
import type { SubordinateLinkRow } from "@/types/subordinate-link";

const TOGGLE_KEYS: { key: AccessPermission; label: string }[] = [
  { key: "view_cases", label: "View cases" },
  { key: "add_cases", label: "Add new cases" },
  { key: "edit_cases", label: "Edit existing cases" },
  { key: "delete_cases", label: "Delete / trash cases" },
  { key: "dispose_cases", label: "Dispose / restore cases" },
  { key: "view_clients", label: "View clients" },
  { key: "view_case_fees", label: "View case fees" },
  { key: "manage_documents", label: "Manage documents" },
];

type LinkWithProfile = SubordinateLinkRow & {
  subordinateProfile: Pick<
    ProfileRow,
    "id" | "email" | "full_name" | "first_name" | "last_name"
  > | null;
};

function getDisplayName(row: LinkWithProfile): string {
  return (
    row.subordinateProfile?.full_name?.trim() ||
    [row.subordinateProfile?.first_name, row.subordinateProfile?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    "Subordinate user"
  );
}

function countEnabledPermissions(row: SubordinateLinkRow): number {
  return TOGGLE_KEYS.filter((item) =>
    Boolean(row[`can_${item.key}` as keyof SubordinateLinkRow]),
  ).length;
}

function createStyles(C: AppColors) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: C.background },
    scroll: { flex: 1 },
    scrollContent: { padding: 20, paddingBottom: 40 },
    hintCard: {
      borderRadius: 14,
      padding: 14,
      backgroundColor: C.pureWhite,
      marginBottom: 14,
      ...theme.shadow,
    },
    addHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    addHeaderText: {
      flex: 1,
      fontSize: 14,
      fontWeight: "700",
    },
    hintText: {
      fontSize: 13,
      lineHeight: 18,
      marginTop: 10,
    },
    addRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 10,
    },
    addInput: {
      flex: 1,
      minHeight: 44,
      borderWidth: 1,
      borderColor: C.borderGray,
      borderRadius: 10,
      backgroundColor: C.background,
      paddingHorizontal: 12,
      fontSize: 14,
      color: C.textPrimary,
    },
    addButton: {
      minWidth: 88,
      minHeight: 44,
      paddingHorizontal: 12,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.themeBlack,
    },
    addButtonDisabled: {
      opacity: 0.55,
    },
    addButtonText: {
      color: C.textInverse,
      fontSize: 13,
      fontWeight: "700",
    },
    card: {
      borderRadius: 14,
      backgroundColor: C.pureWhite,
      marginBottom: 10,
      overflow: "hidden",
      ...theme.shadow,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 10,
    },
    cardHeaderBody: {
      flex: 1,
      minWidth: 0,
    },
    cardHeaderTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap",
    },
    nameText: {
      fontSize: 15,
      fontWeight: "700",
      flexShrink: 1,
    },
    emailText: {
      marginTop: 2,
      fontSize: 12,
    },
    statusText: {
      marginTop: 4,
      fontSize: 12,
    },
    cardBody: {
      paddingHorizontal: 14,
      paddingBottom: 14,
    },
    toggleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 6,
    },
    toggleLabel: {
      fontSize: 14,
      flex: 1,
      marginRight: 10,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: C.borderGray,
      marginVertical: 10,
    },
    dangerBtn: {
      borderWidth: 1,
      borderColor: C.themeRed,
      borderRadius: 10,
      paddingVertical: 10,
      alignItems: "center",
    },
    dangerBtnText: {
      color: C.themeRed,
      fontWeight: "700",
      fontSize: 14,
    },
    enableBtn: {
      borderWidth: 1,
      borderColor: "#2E7D32",
      borderRadius: 10,
      paddingVertical: 10,
      alignItems: "center",
    },
    enableBtnText: {
      color: "#2E7D32",
      fontWeight: "700",
      fontSize: 14,
    },
    disabledBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: C.themeRed + "18",
    },
    disabledBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      color: C.themeRed,
    },
    cardInactive: {
      opacity: 0.72,
    },
    chevronWrap: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.grey100,
    },
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    emptyText: {
      fontSize: 14,
      textAlign: "center",
    },
  });
}

export default function SubordinatesScreen() {
  const { session } = useAuth();
  const C = useThemePalette();
  const s = useMemo(() => createStyles(C), [C]);
  const ownerGuard = useOwnerOnlyGuard();
  const { goBack } = useHomeBackNavigation();
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [email, setEmail] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [rows, setRows] = useState<LinkWithProfile[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addExpanded, setAddExpanded] = useState(false);

  const loadRows = useCallback(async () => {
    if (!session?.user?.id) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("subordinate_links")
      .select("*")
      .eq("supervisor_user_id", session.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      setRows([]);
      setLoading(false);
      return;
    }

    const links = (data as SubordinateLinkRow[]) ?? [];
    const ids = links.map((item) => item.subordinate_user_id);
    if (ids.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const { data: profileRows } = await supabase
      .from("profiles")
      .select("id, email, full_name, first_name, last_name")
      .in("id", ids);

    const profileMap = new Map(
      ((profileRows as Pick<
        ProfileRow,
        "id" | "email" | "full_name" | "first_name" | "last_name"
      >[]) ?? []
      ).map((entry) => [entry.id, entry]),
    );

    setRows(
      links.map((link) => ({
        ...link,
        subordinateProfile: profileMap.get(link.subordinate_user_id) ?? null,
      })),
    );
    setLoading(false);
  }, [session?.user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadRows();
    }, [loadRows]),
  );

  const setPermission = useCallback(
    async (id: string, permission: AccessPermission, value: boolean) => {
      setSavingId(id);
      const column = `can_${permission}` as const;
      const { error } = await supabase
        .from("subordinate_links")
        .update({ [column]: value })
        .eq("id", id);
      setSavingId(null);
      if (error) {
        Alert.alert("Update failed", error.message || "Could not update permission.");
        return;
      }
      setRows((prev) =>
        prev.map((row) =>
          row.id === id
            ? {
                ...row,
                [column]: value,
              }
            : row,
        ),
      );
    },
    [],
  );

  const removeSubordinate = useCallback(
    (row: LinkWithProfile) => {
      const displayName = getDisplayName(row);
      Alert.alert(
        "Remove subordinate?",
        `${displayName} will lose access to your cases and data. You can add them again later if needed.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: () => {
              void (async () => {
                setSavingId(row.id);
                const { error } = await supabase
                  .from("subordinate_links")
                  .delete()
                  .eq("id", row.id);
                setSavingId(null);
                if (error) {
                  Alert.alert(
                    "Remove failed",
                    error.message || "Could not remove subordinate.",
                  );
                  return;
                }
                setRows((prev) => prev.filter((item) => item.id !== row.id));
                if (expandedId === row.id) {
                  setExpandedId(null);
                }
                Alert.alert("Removed", `${displayName} is no longer linked to your account.`);
              })();
            },
          },
        ],
      );
    },
    [expandedId],
  );

  const setLinkActive = useCallback(async (id: string, active: boolean) => {
    const title = active ? "Enable subordinate?" : "Disable subordinate?";
    const message = active
      ? "This user will regain delegated access with their saved permissions."
      : "This user will lose delegated access.";
    const confirmLabel = active ? "Enable" : "Disable";

    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      {
        text: confirmLabel,
        style: active ? "default" : "destructive",
        onPress: () => {
          void (async () => {
            setSavingId(id);
            const { error } = await supabase
              .from("subordinate_links")
              .update({ is_active: active })
              .eq("id", id);
            setSavingId(null);
            if (error) {
              Alert.alert(
                "Update failed",
                error.message || `Could not ${active ? "enable" : "disable"} subordinate.`,
              );
              return;
            }
            setRows((prev) =>
              prev.map((row) => (row.id === id ? { ...row, is_active: active } : row)),
            );
          })();
        },
      },
    ]);
  }, []);

  const addSubordinateByEmail = useCallback(async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      Alert.alert("Email required", "Enter subordinate email first.");
      return;
    }
    if (!session?.user?.id) return;

    setAdding(true);
    const { error } = await supabase.rpc("create_subordinate_link_by_email", {
      subordinate_email: normalizedEmail,
    });
    setAdding(false);

    if (error) {
      Alert.alert("Could not add subordinate", error.message || "Please try again.");
      return;
    }

    setEmail("");
    await loadRows();
    setAddExpanded(false);
    setExpandedId(null);
    Alert.alert(
      "Subordinate added",
      "Account linked successfully. Default permissions were applied and can be adjusted below.",
    );
  }, [email, session?.user?.id, loadRows]);

  if (ownerGuard.blocked) return null;

  return (
    <SafeAreaView style={s.safeArea} edges={["top"]}>
      <ScreenHeader title="Subordinate Access" onBack={goBack} />
      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={C.textPrimary} />
        </View>
      ) : (
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
          <View style={s.hintCard}>
            <Pressable
              style={s.addHeader}
              onPress={() => setAddExpanded((prev) => !prev)}
              accessibilityRole="button"
              accessibilityState={{ expanded: addExpanded }}
            >
              <ThemedText type="accent" style={s.addHeaderText}>Add subordinate</ThemedText>
              <View style={s.chevronWrap}>
                <MaterialIcons
                  name={addExpanded ? "expand-less" : "expand-more"}
                  size={22}
                  color={C.textPrimary}
                />
              </View>
            </Pressable>
            {addExpanded ? (
              <>
                <ThemedText type="muted" style={s.hintText}>
                  Add a subordinate with the same email they used to sign up. Each person can
                  only be linked to one supervisor at a time.
                </ThemedText>
                <View style={s.addRow}>
                  <TextInput
                    style={s.addInput}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="subordinate@email.com"
                    placeholderTextColor={C.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    editable={!adding}
                  />
                  <Pressable
                    style={[s.addButton, adding && s.addButtonDisabled]}
                    onPress={() => void addSubordinateByEmail()}
                    disabled={adding}
                  >
                    {adding ? (
                      <ActivityIndicator size="small" color={C.pureWhite} />
                    ) : (
                      <ThemedText style={s.addButtonText}>Add</ThemedText>
                    )}
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>

          {rows.length === 0 ? (
            <View style={s.card}>
              <ThemedText type="muted" style={s.emptyText}>No subordinate links found.</ThemedText>
            </View>
          ) : (
            rows.map((row) => {
              const displayName = getDisplayName(row);
              const isExpanded = expandedId === row.id;
              const enabledCount = countEnabledPermissions(row);
              const email = row.subordinateProfile?.email || row.subordinate_user_id;

              return (
                <View key={row.id} style={[s.card, !row.is_active && s.cardInactive]}>
                  <Pressable
                    style={s.cardHeader}
                    onPress={() => setExpandedId(isExpanded ? null : row.id)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: isExpanded }}
                    accessibilityLabel={`${displayName}, ${row.is_active ? `${enabledCount} of ${TOGGLE_KEYS.length} permissions` : "access disabled"}`}
                  >
                    <View style={s.cardHeaderBody}>
                      <View style={s.cardHeaderTop}>
                        <ThemedText type="accent" style={s.nameText} numberOfLines={1}>
                          {displayName}
                        </ThemedText>
                        {!row.is_active ? (
                          <View style={s.disabledBadge}>
                            <ThemedText type="default" style={s.disabledBadgeText}>Disabled</ThemedText>
                          </View>
                        ) : null}
                      </View>
                      <ThemedText type="default" style={s.emailText} numberOfLines={1}>
                        {email}
                      </ThemedText>
                      <ThemedText type="default" style={s.statusText}>
                        {row.is_active
                          ? `${enabledCount} of ${TOGGLE_KEYS.length} permissions`
                          : "Tap to manage access"}
                      </ThemedText>
                    </View>
                    <View style={s.chevronWrap}>
                      <MaterialIcons
                        name={isExpanded ? "expand-less" : "expand-more"}
                        size={22}
                        color={C.textPrimary}
                      />
                    </View>
                  </Pressable>

                  {isExpanded ? (
                    <View style={s.cardBody}>
                      {TOGGLE_KEYS.map((item) => (
                        <View key={`${row.id}-${item.key}`} style={s.toggleRow}>
                          <ThemedText type="label" style={s.toggleLabel}>{item.label}</ThemedText>
                          <Switch
                            value={Boolean(row[`can_${item.key}` as keyof SubordinateLinkRow])}
                            onValueChange={(value) => void setPermission(row.id, item.key, value)}
                            disabled={!row.is_active || savingId === row.id}
                            trackColor={{
                              false: C.borderGray,
                              true: C.textPrimary,
                            }}
                            thumbColor={C.background}
                            ios_backgroundColor={C.borderGray}
                          />
                        </View>
                      ))}

                      <View style={s.divider} />
                      {row.is_active ? (
                        <Pressable
                          style={s.dangerBtn}
                          onPress={() => void setLinkActive(row.id, false)}
                          disabled={savingId === row.id}
                        >
                          <ThemedText style={s.dangerBtnText}>Disable subordinate</ThemedText>
                        </Pressable>
                      ) : (
                        <Pressable
                          style={s.enableBtn}
                          onPress={() => void setLinkActive(row.id, true)}
                          disabled={savingId === row.id}
                        >
                          {savingId === row.id ? (
                            <ActivityIndicator size="small" color="#2E7D32" />
                          ) : (
                            <ThemedText style={s.enableBtnText}>Enable subordinate</ThemedText>
                          )}
                        </Pressable>
                      )}
                      <Pressable
                        style={[s.dangerBtn, { marginTop: 10 }]}
                        onPress={() => removeSubordinate(row)}
                        disabled={savingId === row.id}
                      >
                        {savingId === row.id ? (
                          <ActivityIndicator size="small" color={C.themeRed} />
                        ) : (
                          <ThemedText style={s.dangerBtnText}>Remove subordinate</ThemedText>
                        )}
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

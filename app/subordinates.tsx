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
import { useAccessGuard } from "@/hooks/use-access-guard";
import { useThemePalette } from "@/hooks/use-theme-palette";
import { supabase } from "@/lib/supabase";
import type { ProfileRow } from "@/types/profile";
import type { AccessPermission } from "@/types/access";
import type { SubordinateLinkRow } from "@/types/subordinate-link";

const TOGGLE_KEYS: { key: AccessPermission; label: string }[] = [
  { key: "view_cases", label: "View cases" },
  { key: "add_cases", label: "Add new cases" },
  { key: "edit_cases", label: "Edit existing cases" },
  { key: "delete_cases", label: "Delete / trash cases" },
  { key: "view_clients", label: "View clients" },
  { key: "manage_documents", label: "Manage documents" },
  { key: "manage_settings", label: "Manage settings" },
];

type LinkWithProfile = SubordinateLinkRow & {
  subordinateProfile: Pick<
    ProfileRow,
    "id" | "email" | "full_name" | "first_name" | "last_name"
  > | null;
};

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
    hintText: {
      fontSize: 13,
      lineHeight: 18,
      color: C.gray50,
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
      color: C.black,
      fontSize: 14,
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
      color: C.pureWhite,
      fontSize: 13,
      fontWeight: "700",
    },
    card: {
      borderRadius: 14,
      padding: 16,
      backgroundColor: C.pureWhite,
      marginBottom: 12,
      ...theme.shadow,
    },
    nameText: {
      fontSize: 16,
      fontWeight: "700",
      color: C.black,
    },
    emailText: {
      marginTop: 4,
      fontSize: 13,
      color: C.gray50,
      marginBottom: 10,
    },
    toggleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 6,
    },
    toggleLabel: {
      fontSize: 14,
      color: C.black,
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
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    emptyText: {
      fontSize: 14,
      color: C.gray50,
      textAlign: "center",
    },
  });
}

export default function SubordinatesScreen() {
  const { session } = useAuth();
  const C = useThemePalette();
  const s = useMemo(() => createStyles(C), [C]);
  const accessGuard = useAccessGuard("manage_settings");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [email, setEmail] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [rows, setRows] = useState<LinkWithProfile[]>([]);

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

  const deactivateLink = useCallback(async (id: string) => {
    Alert.alert("Disable subordinate?", "This user will lose delegated access.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Disable",
        style: "destructive",
        onPress: () => {
          void (async () => {
            setSavingId(id);
            const { error } = await supabase
              .from("subordinate_links")
              .update({ is_active: false })
              .eq("id", id);
            setSavingId(null);
            if (error) {
              Alert.alert("Update failed", error.message || "Could not disable subordinate.");
              return;
            }
            setRows((prev) =>
              prev.map((row) => (row.id === id ? { ...row, is_active: false } : row)),
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
    Alert.alert(
      "Subordinate added",
      "Account linked successfully. Default permissions were applied and can be adjusted below.",
    );
  }, [email, session?.user?.id, loadRows]);

  if (accessGuard.blocked) return null;

  return (
    <SafeAreaView style={s.safeArea} edges={["top"]}>
      <ScreenHeader title="Subordinate Access" />
      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={C.black} />
        </View>
      ) : (
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
          <View style={s.hintCard}>
            <ThemedText style={s.hintText}>
              Subordinate must sign up first with their own email, then add them here using that
              same email.
            </ThemedText>
            <View style={s.addRow}>
              <TextInput
                style={s.addInput}
                value={email}
                onChangeText={setEmail}
                placeholder="subordinate@email.com"
                placeholderTextColor={C.gray50}
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
          </View>

          {rows.length === 0 ? (
            <View style={s.card}>
              <ThemedText style={s.emptyText}>No subordinate links found.</ThemedText>
            </View>
          ) : (
            rows.map((row) => {
              const displayName =
                row.subordinateProfile?.full_name?.trim() ||
                [row.subordinateProfile?.first_name, row.subordinateProfile?.last_name]
                  .filter(Boolean)
                  .join(" ")
                  .trim() ||
                "Subordinate user";

              return (
                <View key={row.id} style={s.card}>
                  <ThemedText style={s.nameText}>{displayName}</ThemedText>
                  <ThemedText style={s.emailText}>
                    {row.subordinateProfile?.email || row.subordinate_user_id}
                  </ThemedText>

                  {TOGGLE_KEYS.map((item) => (
                    <View key={`${row.id}-${item.key}`} style={s.toggleRow}>
                      <ThemedText style={s.toggleLabel}>{item.label}</ThemedText>
                      <Switch
                        value={Boolean(row[`can_${item.key}` as keyof SubordinateLinkRow])}
                        onValueChange={(value) => void setPermission(row.id, item.key, value)}
                        disabled={!row.is_active || savingId === row.id}
                      />
                    </View>
                  ))}

                  <View style={s.divider} />
                  <Pressable
                    style={s.dangerBtn}
                    onPress={() => void deactivateLink(row.id)}
                    disabled={!row.is_active || savingId === row.id}
                  >
                    <ThemedText style={s.dangerBtnText}>
                      {row.is_active ? "Disable subordinate" : "Disabled"}
                    </ThemedText>
                  </Pressable>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

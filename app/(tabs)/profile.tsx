import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Image } from "expo-image";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { theme } from "@/constants/theme";
import { useAuth } from "@/context/auth-context";
import { useProfilePhoto } from "@/hooks/useProfilePhoto";
import { getAvatarDisplayUrl } from "@/lib/cloudinary";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { ProfileRow } from "@/types/profile";
import { getDisplayName } from "@/types/profile";

function FieldRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  const text = value?.trim() || "—";
  return (
    <View style={styles.fieldRow}>
      <ThemedText style={styles.fieldLabel}>{label}</ThemedText>
      <ThemedText style={styles.fieldValue}>{text}</ThemedText>
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <ThemedText style={styles.sectionTitle}>{title}</ThemedText>;
}

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    full_name: "",
    email: "",
    phone: "",
    address: "",
    avatar_url: "",
  });

  const fetchProfile = useCallback(async () => {
    if (!session?.user?.id || !isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: e } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();
    setLoading(false);
    if (e) {
      setError(e.message || "Failed to load profile");
      setProfile(null);
      return;
    }
    const p = data as ProfileRow;
    setProfile(p);
    setForm({
      first_name: p.first_name ?? "",
      last_name: p.last_name ?? "",
      full_name: p.full_name ?? "",
      email: p.email ?? "",
      phone: p.phone ?? "",
      address: p.address ?? "",
      avatar_url: p.avatar_url ?? "",
    });
  }, [session?.user?.id]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const { pickImage, uploading } = useProfilePhoto(
    session?.user?.id,
    fetchProfile,
  );

  const updateForm = useCallback((updates: Partial<typeof form>) => {
    setForm((prev) => ({ ...prev, ...updates }));
    setSaveError(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!session?.user?.id || !isSupabaseConfigured) return;
    Keyboard.dismiss();
    setSaving(true);
    setSaveError(null);
    const fullName =
      form.full_name.trim() ||
      [form.first_name.trim(), form.last_name.trim()].filter(Boolean).join(" ");
    const { error: e } = await supabase
      .from("profiles")
      .update({
        first_name: form.first_name.trim() || null,
        last_name: form.last_name.trim() || null,
        full_name: fullName || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        avatar_url: form.avatar_url.trim() || null,
      })
      .eq("id", session.user.id);
    setSaving(false);
    if (e) {
      setSaveError(e.message || "Failed to update profile");
      return;
    }
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            first_name: form.first_name.trim() || null,
            last_name: form.last_name.trim() || null,
            full_name: fullName || null,
            email: form.email.trim() || null,
            phone: form.phone.trim() || null,
            address: form.address.trim() || null,
            avatar_url: form.avatar_url.trim() || null,
          }
        : null,
    );
    setEditing(false);
  }, [session?.user?.id, form]);

  const handleCancel = useCallback(() => {
    if (profile) {
      setForm({
        first_name: profile.first_name ?? "",
        last_name: profile.last_name ?? "",
        full_name: profile.full_name ?? "",
        email: profile.email ?? "",
        phone: profile.phone ?? "",
        address: profile.address ?? "",
        avatar_url: profile.avatar_url ?? "",
      });
    }
    setSaveError(null);
    setEditing(false);
  }, [profile]);

  const displayName = profile ? getDisplayName(profile) : "";
  const initials =
    displayName
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";
  const avatarUrl = editing
    ? form.avatar_url.trim()
    : profile?.avatar_url?.trim();
  const displayAvatarUrl =
    getAvatarDisplayUrl(avatarUrl || undefined) ?? (avatarUrl || undefined);

  const content = (
    <>
      {/* <ThemedText type="subtitle" style={styles.title}>
        Profile
      </ThemedText> */}

      {error && !profile ? (
        <ThemedText style={styles.errorText}>{error}</ThemedText>
      ) : (
        <View style={styles.card}>
          {/* Avatar & name */}
          <View style={styles.avatarSection}>
            <Pressable
              style={styles.avatarPressable}
              onPress={editing ? pickImage : undefined}
              disabled={uploading || !editing}
            >
              <View style={styles.avatarWrap}>
                {displayAvatarUrl ? (
                  <Image
                    source={{ uri: displayAvatarUrl }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <ThemedText style={styles.avatarInitials}>
                    {initials}
                  </ThemedText>
                )}
                {uploading && (
                  <View style={styles.avatarOverlay}>
                    <ActivityIndicator
                      size="large"
                      color={theme.colors.black}
                    />
                  </View>
                )}
                {!uploading && !displayAvatarUrl && (
                  <View style={styles.avatarEditBadge}>
                    <MaterialIcons
                      name="edit"
                      size={18}
                      color={theme.colors.pureWhite}
                    />
                  </View>
                )}
              </View>
            </Pressable>
            {!editing && (
              <ThemedText style={styles.displayName}>
                {displayName || "User"}
              </ThemedText>
            )}
          </View>

          {editing ? (
            <>
              <SectionTitle title="Personal" />
              <ThemedText style={styles.inputLabel}>First name</ThemedText>
              <TextInput
                style={styles.input}
                value={form.first_name}
                onChangeText={(v) => updateForm({ first_name: v })}
                placeholder="First name"
                placeholderTextColor={theme.colors.gray50}
              />
              <ThemedText style={styles.inputLabel}>Last name</ThemedText>
              <TextInput
                style={styles.input}
                value={form.last_name}
                onChangeText={(v) => updateForm({ last_name: v })}
                placeholder="Last name"
                placeholderTextColor={theme.colors.gray50}
              />
              <ThemedText style={styles.inputLabel}>Full name</ThemedText>
              <TextInput
                style={styles.input}
                value={form.full_name}
                onChangeText={(v) => updateForm({ full_name: v })}
                placeholder="Full name (optional)"
                placeholderTextColor={theme.colors.gray50}
              />

              <SectionTitle title="Contact" />
              <ThemedText style={styles.inputLabel}>Email</ThemedText>
              <TextInput
                style={styles.input}
                value={form.email}
                onChangeText={(v) => updateForm({ email: v })}
                placeholder="Email"
                placeholderTextColor={theme.colors.gray50}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <ThemedText style={styles.inputLabel}>Mobile number</ThemedText>
              <TextInput
                style={styles.input}
                value={form.phone}
                onChangeText={(v) => updateForm({ phone: v })}
                placeholder="Phone number"
                placeholderTextColor={theme.colors.gray50}
                keyboardType="phone-pad"
              />

              <SectionTitle title="Address" />
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={form.address}
                onChangeText={(v) => updateForm({ address: v })}
                placeholder="Full address"
                placeholderTextColor={theme.colors.gray50}
                multiline
                numberOfLines={3}
              />

              {saveError ? (
                <ThemedText style={styles.saveError}>{saveError}</ThemedText>
              ) : null}
              <View style={styles.editButtons}>
                <Pressable
                  style={[styles.btn, styles.btnSecondary]}
                  onPress={handleCancel}
                  disabled={saving}
                >
                  <ThemedText style={styles.btnSecondaryText}>
                    Cancel
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator
                      size="small"
                      color={theme.colors.black}
                    />
                  ) : (
                    <ThemedText style={styles.btnPrimaryText}>Save</ThemedText>
                  )}
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <SectionTitle title="Personal" />
              <FieldRow label="Name" value={displayName || null} />
              <SectionTitle title="Contact" />
              <FieldRow label="Email" value={profile?.email} />
              <FieldRow label="Mobile number" value={profile?.phone} />
              <SectionTitle title="Address" />
              <FieldRow label="Address" value={profile?.address} />
              <Pressable
                style={styles.editButton}
                onPress={() => setEditing(true)}
              >
                <ThemedText style={styles.editButtonText}>
                  Edit profile
                </ThemedText>
              </Pressable>
            </>
          )}
        </View>
      )}

      <Pressable
        style={styles.signOutButton}
        onPress={() =>
          Alert.alert("Sign out?", "You can sign in again anytime.", [
            { text: "Cancel", style: "cancel" },
            { text: "Sign out", style: "destructive", onPress: signOut },
          ])
        }
      >
        <ThemedText style={styles.signOutText}>Sign out</ThemedText>
      </Pressable>
    </>
  );

  if (loading && !profile) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.black} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {editing ? (
        <KeyboardAwareScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          extraScrollHeight={24}
        >
          {content}
        </KeyboardAwareScrollView>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {content}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    marginBottom: 20,
    color: theme.colors.black,
  },
  card: {
    backgroundColor: theme.colors.pureWhite,
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    ...theme.shadow,
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: 28,
  },
  avatarPressable: {
    alignSelf: "center",
  },
  avatarWrap: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: theme.colors.grey100,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    position: "relative",
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 56,
  },
  avatarEditBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.themeBlack,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarImage: {
    width: 112,
    height: 112,
    borderRadius: 56,
  },
  avatarInitials: {
    fontSize: 36,
    fontWeight: "700",
    color: theme.colors.gray50,
  },
  displayName: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.black,
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.gray50,
    marginBottom: 12,
    marginTop: 20,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fieldRow: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 13,
    color: theme.colors.gray50,
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 16,
    color: theme.colors.black,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.black,
    marginBottom: 6,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.colors.black,
    marginBottom: 4,
  },
  inputMultiline: {
    minHeight: 88,
    textAlignVertical: "top",
  },
  saveError: {
    fontSize: 14,
    color: theme.colors.themeRed,
    marginTop: 12,
  },
  editButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  btnSecondary: {
    backgroundColor: theme.colors.themeGray3,
  },
  btnSecondaryText: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.black,
  },
  btnPrimary: {
    backgroundColor: theme.colors.themeBlack,
  },
  btnPrimaryText: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.pureWhite,
  },
  editButton: {
    marginTop: 24,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    borderRadius: 10,
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.black,
  },
  errorText: {
    fontSize: 15,
    color: theme.colors.themeRed,
    marginBottom: 16,
  },
  signOutButton: {
    width: "100%",
    alignItems: "center",
    paddingVertical: 14,
    backgroundColor: theme.colors.themeRed,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  signOutText: {
    fontWeight: "600",
    fontSize: 16,
    color: theme.colors.pureWhite,
  },
});

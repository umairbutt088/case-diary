import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useIsFocused } from "@react-navigation/native";
import Constants from "expo-constants";
import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { SegmentedTwoOption } from "@/components/ui/segmented-two-option";
import { ScreenHeader } from "@/components/ui/screen-header";
import type {
  AppearancePreference,
  AppColors,
} from "@/constants/color-palette";
import { theme } from "@/constants/theme";
import { useAppTheme } from "@/context/app-theme-context";
import { useAuth } from "@/context/auth-context";
import { useThemePalette } from "@/hooks/use-theme-palette";
import { useProfilePhoto } from "@/hooks/useProfilePhoto";
import { getAvatarDisplayUrl } from "@/lib/cloudinary";
import { APP_TIMEZONE, getNotificationPermissionStatus, syncPushTokenForUser } from "@/lib/notifications";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { ProfileRow } from "@/types/profile";
import { getDisplayName } from "@/types/profile";
import { CopilotStep, useCopilot, walkthroughable } from "react-native-copilot";

const WalkthroughableView = walkthroughable(View);

function createProfileStyles(C: AppColors) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: C.background,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      padding: 24,
      paddingTop: 8,
      paddingBottom: 40,
    },
    headerIconBtn: {
      padding: 8,
      borderRadius: 8,
    },
    headerIconBtnPressed: {
      opacity: 0.55,
    },
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    title: {
      marginBottom: 20,
      color: C.black,
    },
    card: {
      backgroundColor: C.pureWhite,
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
      backgroundColor: C.grey100,
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
      backgroundColor: C.themeBlack,
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
      color: C.gray50,
    },
    displayName: {
      fontSize: 20,
      fontWeight: "700",
      color: C.black,
      marginTop: 12,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: C.gray50,
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
      color: C.gray50,
      marginBottom: 4,
    },
    fieldValue: {
      fontSize: 16,
      color: C.black,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: C.black,
      marginBottom: 6,
      marginTop: 4,
    },
    input: {
      borderWidth: 1,
      borderColor: C.borderGray,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: C.black,
      marginBottom: 4,
    },
    inputMultiline: {
      minHeight: 88,
      textAlignVertical: "top",
    },
    saveError: {
      fontSize: 14,
      color: C.themeRed,
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
      backgroundColor: C.themeGray3,
    },
    btnSecondaryText: {
      fontSize: 16,
      fontWeight: "600",
      color: C.black,
    },
    btnPrimary: {
      backgroundColor: C.themeBlack,
    },
    btnPrimaryText: {
      fontSize: 16,
      fontWeight: "600",
      color: C.pureWhite,
    },
    errorText: {
      fontSize: 15,
      color: C.themeRed,
      marginBottom: 16,
    },
    reminderHint: {
      fontSize: 14,
      color: C.gray50,
      marginBottom: 12,
    },
    reminderSchedule: {
      fontSize: 14,
      color: C.black,
    },
    timezoneText: {
      marginTop: 8,
      fontSize: 13,
      color: C.gray50,
    },
    notifStatusRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 12,
    },
    tokenStatus: {
      flex: 1,
      fontSize: 14,
      color: C.themeGreen,
    },
    tokenStatusMuted: {
      flex: 1,
      fontSize: 14,
      color: C.gray50,
    },
    tokenSyncSuccess: {
      marginTop: 8,
      fontSize: 14,
      color: C.themeGreen,
    },
    tokenSyncError: {
      marginTop: 8,
      fontSize: 14,
      color: C.themeRed,
    },
    registerButton: {
      marginTop: 16,
    },
    signOutButton: {
      width: "100%",
      alignItems: "center",
      paddingVertical: 14,
      backgroundColor: C.themeRed,
      borderRadius: 10,
      alignSelf: "flex-start",
    },
    signOutText: {
      fontWeight: "600",
      fontSize: 16,
      color: C.pureWhite,
    },
    versionText: {
      marginTop: 12,
      textAlign: "center",
      fontSize: 12,
      color: C.gray50,
    },
  });
}

type ProfileStyles = ReturnType<typeof createProfileStyles>;

function FieldRow({
  styles,
  label,
  value,
}: {
  styles: ProfileStyles;
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

function SectionTitle({
  styles,
  title,
}: {
  styles: ProfileStyles;
  title: string;
}) {
  return <ThemedText style={styles.sectionTitle}>{title}</ThemedText>;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { edit: editParam } = useLocalSearchParams<{ edit?: string }>();
  const isFocused = useIsFocused();
  const { session, signOut } = useAuth();
  const { start, copilotEvents } = useCopilot();
  const scrollRef = useRef<ScrollView | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [syncingToken, setSyncingToken] = useState(false);
  const [tokenSyncMessage, setTokenSyncMessage] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<"granted" | "denied" | "undetermined" | null>(null);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    full_name: "",
    email: "",
    phone: "",
    address: "",
    avatar_url: "",
  });

  const C = useThemePalette();
  const { isDark, setPreference } = useAppTheme();
  const styles = useMemo(() => createProfileStyles(C), [C]);

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

  useEffect(() => {
    const wantEdit =
      editParam === "1" || editParam === "true" || editParam === "yes";
    if (!wantEdit || loading || !profile) return;
    setEditing(true);
    router.setParams({ edit: undefined });
  }, [editParam, loading, profile, router]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        await fetchProfile();
        if (cancelled) return;

        // Refresh permission status every time the screen comes into focus
        // so the card reflects changes made in the OS Settings app.
        const status = await getNotificationPermissionStatus();
        if (!cancelled) setPermissionStatus(status);

        const hasSeenTour = await AsyncStorage.getItem(
          "hasSeenProfileTourCopilot",
        );
        if (!hasSeenTour) {
          setTimeout(() => {
            if (cancelled) return;
            requestAnimationFrame(() => {
              if (cancelled) return;
              start();
            });
            AsyncStorage.setItem("hasSeenProfileTourCopilot", "true");
          }, 600);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [fetchProfile, start]),
  );

  // Auto-scroll to logout button when walkthrough reaches that step (fixes large screens)
  useEffect(() => {
    const onStepChange = (step: { name?: string } | undefined) => {
      if (step?.name === "profile-signout") {
        setTimeout(() => {
          scrollRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    };
    copilotEvents.on("stepChange", onStepChange);
    return () => {
      copilotEvents.off("stepChange", onStepChange);
    };
  }, [copilotEvents]);

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

  const handleRegisterForReminders = useCallback(async () => {
    if (!session?.user?.id || !isSupabaseConfigured) return;
    setSyncingToken(true);
    setTokenSyncMessage(null);
    const result = await syncPushTokenForUser(session.user.id);
    setSyncingToken(false);
    if (result.ok) {
      setTokenSyncMessage("Registered for reminders");
      fetchProfile();
    } else {
      setTokenSyncMessage(result.error);
    }
  }, [session?.user?.id, fetchProfile]);

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

  const settingsHeaderButton = (
    <Pressable
      onPress={() => router.push("/settings")}
      style={({ pressed }) => [styles.headerIconBtn, pressed && styles.headerIconBtnPressed]}
      accessibilityRole="button"
      accessibilityLabel="Settings"
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
    >
      <MaterialIcons name="settings" size={24} color={C.themeBlack} />
    </Pressable>
  );

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
  const appVersion = Constants.expoConfig?.version ?? "1.0.0";
  const iosBuild = Constants.expoConfig?.ios?.buildNumber;
  const androidBuild = Constants.expoConfig?.android?.versionCode;
  const buildLabel =
    Platform.OS === "ios"
      ? iosBuild
        ? `Build ${iosBuild}`
        : null
      : androidBuild
        ? `Build ${androidBuild}`
        : null;

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
          <CopilotStep
            text="This is your profile. Tap the avatar to add a photo when editing."
            order={1}
            name="profile-avatar"
            active={isFocused}
          >
            <WalkthroughableView style={styles.avatarSection}>
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
                      color={C.black}
                    />
                  </View>
                )}
                {!uploading && !displayAvatarUrl && (
                  <View style={styles.avatarEditBadge}>
                    <MaterialIcons
                      name="edit"
                      size={18}
                      color={C.pureWhite}
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
            </WalkthroughableView>
          </CopilotStep>

          {editing ? (
            <>
              <SectionTitle styles={styles} title="Personal" />
              <ThemedText style={styles.inputLabel}>First name</ThemedText>
              <TextInput
                style={styles.input}
                value={form.first_name}
                onChangeText={(v) => updateForm({ first_name: v })}
                placeholder="First name"
                placeholderTextColor={C.gray50}
              />
              <ThemedText style={styles.inputLabel}>Last name</ThemedText>
              <TextInput
                style={styles.input}
                value={form.last_name}
                onChangeText={(v) => updateForm({ last_name: v })}
                placeholder="Last name"
                placeholderTextColor={C.gray50}
              />
              <ThemedText style={styles.inputLabel}>Full name</ThemedText>
              <TextInput
                style={styles.input}
                value={form.full_name}
                onChangeText={(v) => updateForm({ full_name: v })}
                placeholder="Full name (optional)"
                placeholderTextColor={C.gray50}
              />

              <SectionTitle styles={styles} title="Contact" />
              <ThemedText style={styles.inputLabel}>Email</ThemedText>
              <TextInput
                style={styles.input}
                value={form.email}
                onChangeText={(v) => updateForm({ email: v })}
                placeholder="Email"
                placeholderTextColor={C.gray50}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <ThemedText style={styles.inputLabel}>Mobile number</ThemedText>
              <TextInput
                style={styles.input}
                value={form.phone}
                onChangeText={(v) => updateForm({ phone: v })}
                placeholder="Phone number"
                placeholderTextColor={C.gray50}
                keyboardType="phone-pad"
              />

              <SectionTitle styles={styles} title="Address" />
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={form.address}
                onChangeText={(v) => updateForm({ address: v })}
                placeholder="Full address"
                placeholderTextColor={C.gray50}
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
                      color={C.black}
                    />
                  ) : (
                    <ThemedText style={styles.btnPrimaryText}>Save</ThemedText>
                  )}
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <SectionTitle styles={styles} title="Personal" />
              <FieldRow styles={styles} label="Name" value={displayName || null} />
              <SectionTitle styles={styles} title="Contact" />
              <FieldRow styles={styles} label="Email" value={profile?.email} />
              <FieldRow styles={styles} label="Mobile number" value={profile?.phone} />
              <SectionTitle styles={styles} title="Address" />
              <FieldRow styles={styles} label="Address" value={profile?.address} />
            </>
          )}
        </View>
      )}

      {!editing ? (
        <View style={styles.card}>
          <SectionTitle styles={styles} title="Appearance" />
          <SegmentedTwoOption<AppearancePreference>
            value={isDark ? "dark" : "light"}
            onChange={(v) => void setPreference(v)}
            left={{ label: "Light", value: "light" }}
            right={{ label: "Dark", value: "dark" }}
            accessibilityLabel="Appearance"
          />
        </View>
      ) : null}

      {!editing ? (
        <View style={styles.card}>
          <SectionTitle styles={styles} title="Cause List Reminder" />
          <ThemedText style={styles.reminderHint}>
            Nightly reminders are sent automatically at 8:00 PM with tomorrow&apos;s
            hearing list.
          </ThemedText>
          <ThemedText style={styles.timezoneText}>
            Timezone: {APP_TIMEZONE}
          </ThemedText>

          {/* ── Status row ─────────────────────────────────────── */}
          {permissionStatus === "denied" ? (
            // Permission was denied by the user in OS settings
            <View style={styles.notifStatusRow}>
              <MaterialIcons name="notifications-off" size={18} color={C.themeRed} />
              <ThemedText style={styles.tokenStatusMuted}>
                Notifications are turned off for this app.
              </ThemedText>
            </View>
          ) : profile?.expo_push_token ? (
            // Permission granted and token saved — fully active
            <View style={styles.notifStatusRow}>
              <MaterialIcons name="check-circle" size={18} color={C.themeGreen} />
              <ThemedText style={styles.tokenStatus}>
                Active — reminders are enabled.
              </ThemedText>
            </View>
          ) : (
            // Permission granted (or undetermined) but token not yet saved
            <View style={styles.notifStatusRow}>
              <MaterialIcons name="notifications-none" size={18} color={C.themeWarm} />
              <ThemedText style={styles.tokenStatusMuted}>
                Not yet registered for reminders.
              </ThemedText>
            </View>
          )}

          {tokenSyncMessage ? (
            <ThemedText
              style={
                tokenSyncMessage.startsWith("Registered")
                  ? styles.tokenSyncSuccess
                  : styles.tokenSyncError
              }
            >
              {tokenSyncMessage}
            </ThemedText>
          ) : null}

          {/* ── Action button — only shown when action is needed ── */}
          {permissionStatus === "denied" ? (
            // Guide user to OS settings to re-enable
            <Pressable
              style={[styles.btn, styles.btnPrimary, styles.registerButton]}
              onPress={() => void Linking.openSettings()}
            >
              <MaterialIcons name="settings" size={16} color={C.pureWhite} />
              <ThemedText style={styles.btnPrimaryText}>
                Enable in Settings
              </ThemedText>
            </Pressable>
          ) : !profile?.expo_push_token ? (
            // Permission granted/undetermined but token not yet saved — register
            <Pressable
              style={[styles.btn, styles.btnPrimary, styles.registerButton]}
              onPress={handleRegisterForReminders}
              disabled={syncingToken}
            >
              {syncingToken ? (
                <ActivityIndicator size="small" color={C.pureWhite} />
              ) : (
                <ThemedText style={styles.btnPrimaryText}>
                  Register for reminders
                </ThemedText>
              )}
            </Pressable>
          ) : null
          /* Token is saved + permission granted — no button needed */ }
        </View>
      ) : null}

      {!editing ? (
        <>
          <CopilotStep
            text="Tap here to sign out of your account."
            order={2}
            name="profile-signout"
            active={isFocused}
          >
            <WalkthroughableView>
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
            </WalkthroughableView>
          </CopilotStep>

          <ThemedText style={styles.versionText}>
            Version {appVersion}
            {buildLabel ? ` • ${buildLabel}` : ""}
          </ThemedText>
        </>
      ) : null}
    </>
  );

  if (loading && !profile) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ScreenHeader
          title="Profile"
          showBack={false}
          rightComponent={settingsHeaderButton}
        />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={C.black} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScreenHeader
        title="Profile"
        showBack={false}
        rightComponent={settingsHeaderButton}
      />
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
          ref={scrollRef}
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

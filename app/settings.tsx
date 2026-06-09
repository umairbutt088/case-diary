import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

import { ThemedText } from "@/components/themed-text";
import { ScreenHeader } from "@/components/ui/screen-header";
import {
  type AppColors,
  modalSheetBackground,
} from "@/constants/color-palette";
import { theme } from "@/constants/theme";
import { useAppTheme } from "@/context/app-theme-context";
import { useAuth } from "@/context/auth-context";
import { useAccessGuard } from "@/hooks/use-access-guard";
import { useHomeBackNavigation } from "@/hooks/use-home-back-navigation";
import { useIsOnline } from "@/hooks/use-is-online";
import { useThemePalette } from "@/hooks/use-theme-palette";
import { deleteAuthenticatedAccount } from "@/lib/delete-account";
import { isSupabaseConfigured } from "@/lib/supabase";

function createSettingsStyles(C: AppColors) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: C.background,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingTop: 20,
      paddingBottom: 40,
    },
    card: {
      padding: 20,
      borderRadius: 16,
      backgroundColor: C.pureWhite,
      ...theme.shadow,
    },
    addCard: {
      marginTop: 16,
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 8,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: C.gray50,
      marginBottom: 8,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    addHint: {
      fontSize: 14,
      color: C.gray50,
      marginBottom: 8,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: C.borderGray,
    },
    rowButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
    },
    rowButtonPressed: {
      opacity: 0.55,
    },
    rowLabel: {
      flex: 1,
      fontSize: 16,
      fontWeight: "600",
      color: C.themeBlack,
    },
    rowLeading: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
      minWidth: 0,
    },
    walkthroughButtonText: {
      fontWeight: "600",
      fontSize: 16,
      color: C.black,
    },
    rowLabelDanger: {
      flex: 1,
      fontSize: 16,
      fontWeight: "600",
      color: C.themeRed,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      paddingHorizontal: 24,
    },
    modalCard: {
      borderRadius: 16,
      padding: 20,
      maxWidth: 400,
      width: "100%",
      alignSelf: "center",
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: C.black,
      marginBottom: 10,
    },
    modalBody: {
      fontSize: 14,
      color: C.gray50,
      lineHeight: 20,
      marginBottom: 14,
    },
    modalInput: {
      borderWidth: 1,
      borderColor: C.borderGray,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: C.black,
      marginBottom: 8,
    },
    modalError: {
      fontSize: 13,
      color: C.themeRed,
      marginBottom: 12,
    },
    modalActions: {
      flexDirection: "row",
      gap: 10,
      marginTop: 8,
    },
    modalBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    modalBtnGhost: {
      backgroundColor: C.themeGray3,
    },
    modalBtnGhostText: {
      fontSize: 16,
      fontWeight: "600",
      color: C.black,
    },
    modalBtnDanger: {
      backgroundColor: C.themeRed,
    },
    modalBtnDangerText: {
      fontSize: 16,
      fontWeight: "600",
      color: C.pureWhite,
    },
  });
}

export default function SettingsScreen() {
  const router = useRouter();
  const { goBack } = useHomeBackNavigation();
  const C = useThemePalette();
  const { isDark } = useAppTheme();
  const modalSheet = modalSheetBackground(C, isDark);
  const styles = useMemo(
    () => createSettingsStyles(C),
    [C],
  );
  const { signOut, setOnboardingCompleted, role } = useAuth();
  const accessGuard = useAccessGuard("manage_settings");
  const isOnline = useIsOnline();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const startWalkthrough = async () => {
    await AsyncStorage.multiRemove([
      "hasSeenHomeTourCopilot",
      "hasSeenCalendarTourCopilot",
      "hasSeenProfileTourCopilot",
      "hasSeenDiaryTourCopilot",
      "hasSeenAddCaseStep1TourCopilot",
      "hasSeenAddCaseStep2TourCopilot",
      "hasSeenAddCaseStep3TourCopilot",
      "hasSeenAddCaseStep4TourCopilot",
    ]);
    router.push("/(tabs)");
  };

  const openDeleteAccountFlow = () => {
    if (!isSupabaseConfigured) {
      Alert.alert(
        "Not available",
        "Account deletion requires the app to be connected to your server.",
      );
      return;
    }
    if (!isOnline) {
      Alert.alert(
        "You are offline",
        "Connect to the internet to delete your account.",
      );
      return;
    }
    Alert.alert(
      "Delete account?",
      "This permanently deletes your account and your data from our servers. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          style: "destructive",
          onPress: () => {
            setDeletePassword("");
            setDeleteError(null);
            setDeleteModalOpen(true);
          },
        },
      ],
    );
  };

  const closeDeleteModal = () => {
    if (deleteLoading) return;
    setDeleteModalOpen(false);
    setDeletePassword("");
    setDeleteError(null);
  };

  const confirmDeleteAccount = async () => {
    if (!deletePassword.trim()) {
      setDeleteError("Enter your password to confirm.");
      return;
    }
    setDeleteLoading(true);
    setDeleteError(null);
    const result = await deleteAuthenticatedAccount(deletePassword);
    setDeleteLoading(false);
    if (!result.ok) {
      setDeleteError(result.message);
      return;
    }
    setDeleteModalOpen(false);
    setDeletePassword("");
    try {
      await signOut();
    } catch {
      // Session may already be invalid after user row deletion.
    }
    try {
      await setOnboardingCompleted(false);
    } catch {
      // ignore
    }
    router.replace("/(auth)/login");
  };

  return (
    accessGuard.blocked ? null : (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScreenHeader title="Settings" onBack={goBack} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Pressable
            style={({ pressed }) => [
              styles.rowButton,
              pressed && styles.rowButtonPressed,
            ]}
            onPress={() => router.replace("/(tabs)/profile?edit=1")}
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
          >
            <ThemedText style={styles.rowLabel}>Edit profile</ThemedText>
            <MaterialIcons name="chevron-right" size={22} color={C.gray50} />
          </Pressable>
          <View style={styles.divider} />
          <Pressable
            style={({ pressed }) => [
              styles.rowButton,
              pressed && styles.rowButtonPressed,
            ]}
            onPress={() => router.push("/clients")}
            accessibilityRole="button"
            accessibilityLabel="Clients"
          >
            <View style={styles.rowLeading}>
              <ThemedText style={styles.rowLabel}>Manage Clients</ThemedText>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={C.gray50} />
          </Pressable>
          <View style={styles.divider} />
          <Pressable
            style={({ pressed }) => [
              styles.rowButton,
              pressed && styles.rowButtonPressed,
            ]}
            onPress={() => router.push("/judges")}
            accessibilityRole="button"
            accessibilityLabel="Judges"
          >
            <View style={styles.rowLeading}>
              <ThemedText style={styles.rowLabel}>Manage Judges</ThemedText>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={C.gray50} />
          </Pressable>
          <View style={styles.divider} />
          {role !== "subordinate" ? (
            <>
              <Pressable
                style={({ pressed }) => [
                  styles.rowButton,
                  pressed && styles.rowButtonPressed,
                ]}
                onPress={() => router.push("/subordinates")}
                accessibilityRole="button"
                accessibilityLabel="Subordinate access"
              >
                <View style={styles.rowLeading}>
                  <ThemedText style={styles.rowLabel}>Subordinate access</ThemedText>
                </View>
                <MaterialIcons name="chevron-right" size={22} color={C.gray50} />
              </Pressable>
              <View style={styles.divider} />
            </>
          ) : null}
          <Pressable
            style={({ pressed }) => [
              styles.rowButton,
              pressed && styles.rowButtonPressed,
            ]}
            onPress={() => router.push("/share-app")}
            accessibilityRole="button"
            accessibilityLabel="Share app"
          >
            <View style={styles.rowLeading}>
              <ThemedText style={styles.rowLabel}>Share app</ThemedText>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={C.gray50} />
          </Pressable>
          <View style={styles.divider} />
          <Pressable
            style={({ pressed }) => [
              styles.rowButton,
              pressed && styles.rowButtonPressed,
            ]}
            onPress={() => void startWalkthrough()}
            accessibilityRole="button"
            accessibilityLabel="Start a walkthrough"
          >
            <View style={styles.rowLeading}>
              <ThemedText style={styles.rowLabel}>
                Start a walkthrough
              </ThemedText>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={C.gray50} />
          </Pressable>
          <View style={styles.divider} />
          <Pressable
            style={({ pressed }) => [
              styles.rowButton,
              pressed && styles.rowButtonPressed,
            ]}
            onPress={() => router.push("/disposed-cases")}
            accessibilityRole="button"
            accessibilityLabel="Disposed cases"
          >
            <View style={styles.rowLeading}>
              <ThemedText style={styles.rowLabel}>Disposed cases</ThemedText>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={C.gray50} />
          </Pressable>
          <View style={styles.divider} />
          <Pressable
            style={({ pressed }) => [
              styles.rowButton,
              pressed && styles.rowButtonPressed,
            ]}
            onPress={() => router.push("/trash")}
            accessibilityRole="button"
            accessibilityLabel="Trash"
          >
            <View style={styles.rowLeading}>
              <ThemedText style={styles.rowLabel}>Trash</ThemedText>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={C.gray50} />
          </Pressable>
          <View style={styles.divider} />
          <Pressable
            style={({ pressed }) => [
              styles.rowButton,
              pressed && styles.rowButtonPressed,
            ]}
            onPress={() => void openDeleteAccountFlow()}
            accessibilityRole="button"
            accessibilityLabel="Delete account"
          >
            <View style={styles.rowLeading}>
              <ThemedText style={styles.rowLabelDanger}>Delete account</ThemedText>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={C.themeRed} />
          </Pressable>
        </View>
      </ScrollView>

      <Modal
        visible={deleteModalOpen}
        transparent
        animationType="fade"
        onRequestClose={closeDeleteModal}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={closeDeleteModal} />
          <Pressable
            style={[styles.modalCard, { backgroundColor: modalSheet }]}
            onPress={(e) => e.stopPropagation()}
          >
            <ThemedText style={styles.modalTitle}>Delete your account</ThemedText>
            <ThemedText style={styles.modalBody}>
              Enter your password to permanently delete your account and server-side data.
            </ThemedText>
            <TextInput
              style={styles.modalInput}
              value={deletePassword}
              onChangeText={(t) => {
                setDeletePassword(t);
                setDeleteError(null);
              }}
              placeholder="Password"
              placeholderTextColor={C.gray50}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!deleteLoading}
            />
            {deleteError ? (
              <ThemedText style={styles.modalError}>{deleteError}</ThemedText>
            ) : null}
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnGhost]}
                onPress={closeDeleteModal}
                disabled={deleteLoading}
              >
                <ThemedText style={styles.modalBtnGhostText}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnDanger]}
                onPress={() => void confirmDeleteAccount()}
                disabled={deleteLoading}
              >
                {deleteLoading ? (
                  <ActivityIndicator color={C.pureWhite} />
                ) : (
                  <ThemedText style={styles.modalBtnDangerText}>Delete</ThemedText>
                )}
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
    )
  );
}

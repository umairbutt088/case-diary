import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AddNewClientModal } from "@/components/add-case/add-new-client-modal";
import { AddJudgeModal } from "@/components/add-judge-modal";
import { ThemedText } from "@/components/themed-text";
import { ScreenHeader } from "@/components/ui/screen-header";
import { theme } from "@/constants/theme";

export default function SettingsScreen() {
  const router = useRouter();
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [showAddJudgeModal, setShowAddJudgeModal] = useState(false);

  const startWalkthrough = async () => {
    await AsyncStorage.multiRemove([
      "hasSeenHomeTourCopilot",
      "hasSeenCalendarTourCopilot",
      "hasSeenProfileTourCopilot",
      "hasSeenDiaryTourCopilot",
    ]);
    router.push("/(tabs)");
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScreenHeader title="Settings" />
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
            <MaterialIcons name="chevron-right" size={22} color={theme.colors.gray50} />
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
            <MaterialIcons name="chevron-right" size={22} color={theme.colors.gray50} />
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
            <MaterialIcons name="chevron-right" size={22} color={theme.colors.gray50} />
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
            <ThemedText style={styles.walkthroughButtonText}>Start a walkthrough</ThemedText>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={theme.colors.gray50} />
          </Pressable>
        </View>

        <View style={[styles.card, styles.addCard]}>
          <ThemedText style={styles.sectionTitle}>Clients & judges</ThemedText>
          <ThemedText style={styles.addHint}>
            Add a new client or judge to your saved lists.
          </ThemedText>
          <View style={styles.divider} />
          <Pressable
            style={({ pressed }) => [
              styles.rowButton,
              pressed && styles.rowButtonPressed,
            ]}
            onPress={() => setShowAddClientModal(true)}
            accessibilityRole="button"
            accessibilityLabel="Add client"
          >
            <View style={styles.rowLeading}>
              <MaterialIcons name="groups-2" size={20} color={theme.colors.themeBlack} />
              <ThemedText style={styles.rowLabel}>Add client</ThemedText>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={theme.colors.gray50} />
          </Pressable>
          <View style={styles.divider} />
          <Pressable
            style={({ pressed }) => [
              styles.rowButton,
              pressed && styles.rowButtonPressed,
            ]}
            onPress={() => setShowAddJudgeModal(true)}
            accessibilityRole="button"
            accessibilityLabel="Add judge"
          >
            <View style={styles.rowLeading}>
              <MaterialIcons name="gavel" size={20} color={theme.colors.themeBlack} />
              <ThemedText style={styles.rowLabel}>Add judge</ThemedText>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={theme.colors.gray50} />
          </Pressable>
        </View>
      </ScrollView>
      <AddNewClientModal
        visible={showAddClientModal}
        onClose={() => setShowAddClientModal(false)}
        onSaved={() => {}}
      />
      <AddJudgeModal
        visible={showAddJudgeModal}
        onClose={() => setShowAddJudgeModal(false)}
      />
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
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 16,
    backgroundColor: theme.colors.themeWhite,
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
    color: theme.colors.gray50,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  addHint: {
    fontSize: 14,
    color: theme.colors.gray50,
    marginBottom: 8,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.borderGray,
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
    color: theme.colors.themeBlack,
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
    color: theme.colors.black,
  },
});

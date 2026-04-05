import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ScreenHeader } from "@/components/ui/screen-header";
import type { AppColors } from "@/constants/color-palette";
import { theme } from "@/constants/theme";
import { useThemePalette } from "@/hooks/use-theme-palette";

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
  });
}

export default function SettingsScreen() {
  const router = useRouter();
  const C = useThemePalette();
  const styles = useMemo(() => createSettingsStyles(C), [C]);

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
        </View>


      </ScrollView>
    </SafeAreaView>
  );
}

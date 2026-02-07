import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { theme } from "@/constants/theme";

// This tab is used only for the center FAB; pressing it can open add-case flow.
// Screen content is hidden via tabBarItemStyle; user sees the FAB in the tab bar.
export default function AddCasePlaceholderScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ThemedView style={styles.container}>
        <ThemedText type="subtitle">Add Case</ThemedText>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: theme.colors.background,
  },
});

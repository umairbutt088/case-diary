import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { theme } from "@/constants/theme";

export default function DiaryScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ThemedView style={styles.container}>
        <ThemedText type="subtitle" style={styles.title}>
          Your entries
        </ThemedText>
        <ThemedText style={styles.placeholder}>
          Diary entries will appear here. Add new screens or components to list
          and create entries.
        </ThemedText>
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
    paddingTop: 16,
    backgroundColor: theme.colors.background,
  },
  title: {
    marginBottom: 12,
  },
  placeholder: {
    opacity: 0.8,
  },
});

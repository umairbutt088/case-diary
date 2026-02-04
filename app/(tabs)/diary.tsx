import { StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

export default function DiaryScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="subtitle" style={styles.title}>
        Your entries
      </ThemedText>
      <ThemedText style={styles.placeholder}>
        Diary entries will appear here. Add new screens or components to list
        and create entries.
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 16,
  },
  title: {
    marginBottom: 12,
  },
  placeholder: {
    opacity: 0.8,
  },
});

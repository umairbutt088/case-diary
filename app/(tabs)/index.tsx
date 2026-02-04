import { StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

export default function HomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        Legal Diary
      </ThemedText>
      <ThemedText style={styles.subtitle}>
        Your legal matters and notes in one place.
      </ThemedText>
      <ThemedText style={styles.hint}>
        Use the Diary tab to view and add entries. Profile to manage your
        account.
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
    marginBottom: 8,
  },
  subtitle: {
    marginBottom: 16,
    opacity: 0.9,
  },
  hint: {
    fontSize: 14,
    opacity: 0.8,
  },
});

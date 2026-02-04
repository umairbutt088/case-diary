import { Pressable, StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAuth } from "@/context/auth-context";

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const email = session?.user?.email ?? "";
  const name =
    session?.user?.user_metadata?.full_name ??
    ([
      session?.user?.user_metadata?.first_name,
      session?.user?.user_metadata?.last_name,
    ]
      .filter(Boolean)
      .join(" ") ||
      "User");

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.card}>
        <ThemedText type="subtitle" style={styles.label}>
          Name
        </ThemedText>
        <ThemedText style={styles.value}>{name}</ThemedText>
        <ThemedText type="subtitle" style={[styles.label, styles.labelTop]}>
          Email
        </ThemedText>
        <ThemedText style={styles.value}>{email}</ThemedText>
      </ThemedView>
      <Pressable style={styles.signOutButton} onPress={() => signOut()}>
        <ThemedText style={styles.signOutText}>Sign out</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 16,
  },
  card: {
    marginBottom: 24,
  },
  label: {
    marginBottom: 4,
  },
  labelTop: {
    marginTop: 16,
  },
  value: {
    fontSize: 16,
  },
  signOutButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: "#c00",
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  signOutText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
});

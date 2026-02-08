import { Link, useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { theme } from "@/constants/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

const hasCases = false; // TODO: replace with real cases state

export default function HomeScreen() {
  const router = useRouter();
  if (hasCases) {
    // TODO: render list of cases when you have data
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ThemedView style={styles.container}>
          <ThemedText type="subtitle">Your cases</ThemedText>
        </ThemedView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.container}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <MaterialIcons
              name="folder"
              size={40}
              color={theme.colors.zodiacColour}
            />
          </View>
          <ThemedText style={styles.heading}>Add your first case.</ThemedText>
          <ThemedText style={styles.subtext}>
            This diary has a clean record 😊
          </ThemedText>
          <Link href="/add-case-flow" asChild>
            <Pressable style={styles.addButton}>
              <MaterialIcons name="add" size={22} color="#fff" />
              <ThemedText style={styles.addButtonText}>Add Case</ThemedText>
            </Pressable>
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.pureWhite,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    backgroundColor: theme.colors.pureWhite,
    borderRadius: 16,
    paddingVertical: 32,
    paddingHorizontal: 28,
    alignItems: "center",
    minWidth: "100%",
    ...theme.shadow,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#E8EEF7",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  heading: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.black,
    marginBottom: 8,
  },
  subtext: {
    fontSize: 15,
    color: theme.colors.gray50,
    marginBottom: 24,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: theme.colors.themeBlack,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  addButtonText: {
    color: theme.colors.pureWhite,
    fontSize: 16,
    fontWeight: "600",
  },
});

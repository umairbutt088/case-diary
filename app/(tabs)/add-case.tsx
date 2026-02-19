import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { theme } from "@/constants/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

// This tab is the target of the center FAB. Show a single button to open the Add Case form.
export default function AddCasePlaceholderScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.container}>
        <ThemedText type="subtitle" style={styles.title}>
          Add New Case
        </ThemedText>
        <Pressable
          style={styles.button}
          onPress={() => router.push("/add-case-flow" as const)}
        >
          <MaterialIcons name="add" size={24} color={theme.colors.pureWhite} />
          <ThemedText style={styles.buttonText}>Open Add Case Form</ThemedText>
        </Pressable>
      </View>
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
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    marginBottom: 24,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: theme.colors.themeBlack,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  buttonText: {
    color: theme.colors.pureWhite,
    fontSize: 17,
    fontWeight: "600",
  },
});

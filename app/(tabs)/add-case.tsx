import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import type { AppColors } from "@/constants/color-palette";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useAuth } from "@/context/auth-context";
import { useAppTheme } from "@/context/app-theme-context";
import { useThemePalette } from "@/hooks/use-theme-palette";

function createAddCaseStyles(C: AppColors, onPrimary: string) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: C.background,
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
      backgroundColor: C.themeBlack,
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 12,
    },
    buttonText: {
      color: onPrimary,
      fontSize: 17,
      fontWeight: "600",
    },
  });
}

// This tab is the target of the center FAB. Show a single button to open the Add Case form.
export default function AddCasePlaceholderScreen() {
  const router = useRouter();
  const { can } = useAuth();
  const canAddCases = can("add_cases");
  const { isDark } = useAppTheme();
  const C = useThemePalette();
  const onPrimary = C.textInverse;
  const styles = useMemo(
    () => createAddCaseStyles(C, onPrimary),
    [C, onPrimary],
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.container}>
        <ThemedText type="subtitle" style={styles.title}>
          Add New Case
        </ThemedText>
        <Pressable
          style={styles.button}
          disabled={!canAddCases}
          onPress={() => {
            if (!canAddCases) return;
            router.push("/add-case-flow" as const);
          }}
        >
          <MaterialIcons name="add" size={24} color={onPrimary} />
          <ThemedText style={styles.buttonText}>Open Add Case Form</ThemedText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

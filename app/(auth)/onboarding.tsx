import { StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAuth } from "@/context/auth-context";

export default function OnboardingScreen() {
  const { setOnboardingCompleted } = useAuth();

  const handleGetStarted = async () => {
    await setOnboardingCompleted(true);
    // AuthNavigator will redirect to login when onboardingCompleted becomes true
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        Welcome to Legal Diary
      </ThemedText>
      <ThemedText style={styles.subtitle}>
        Track your legal matters and notes in one place.
      </ThemedText>
      <ThemedText
        type="link"
        style={styles.cta}
        onPress={handleGetStarted}
        accessibilityRole="button"
      >
        Get started
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  title: {
    textAlign: "center",
    marginBottom: 12,
  },
  subtitle: {
    textAlign: "center",
    marginBottom: 32,
  },
  cta: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
});

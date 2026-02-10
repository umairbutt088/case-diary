import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { AuthNavigator } from "@/components/auth-navigator";
import { AuthProvider } from "@/context/auth-context";
import { useColorScheme } from "@/hooks/use-color-scheme";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <AuthNavigator>
          <Stack>
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="add-case-flow"
              options={{
                title: "Add New Case",
                headerBackTitle: "Back",
              }}
            />
            <Stack.Screen
              name="case/[id]"
              options={{
                headerShown: false,
              }}
            />
          </Stack>
        </AuthNavigator>
      </AuthProvider>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

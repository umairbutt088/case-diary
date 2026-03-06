import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform, StatusBar as RNStatusBar } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";



import { AuthNavigator } from "@/components/auth-navigator";
import { OfflineSyncProvider } from "@/components/offline-sync-provider";
import { PushNotificationProvider } from "@/components/push-notification-provider";
import { AuthProvider } from "@/context/auth-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { CopilotProvider } from "react-native-copilot";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <AuthProvider>
          <OfflineSyncProvider>
            <PushNotificationProvider>
              <CopilotProvider
                overlay="svg"
                backdropColor="rgba(0,0,0,0.75)"
                animated={true}
                verticalOffset={
                  Platform.OS === "android"
                    ? RNStatusBar.currentHeight ?? 24
                    : 0
                }
              >
                <AuthNavigator>
                  <Stack>
                    <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                    <Stack.Screen
                      name="add-case-flow"
                      options={{
                        headerShown: false,
                      }}
                    />
                    <Stack.Screen
                      name="add-date-to-case"
                      options={{ headerShown: false }}
                    />
                    <Stack.Screen
                      name="case"
                      options={{
                        headerShown: false,
                      }}
                    />
                    <Stack.Screen
                      name="case/[id]"
                      options={{
                        headerShown: false,
                      }}
                    />
                    <Stack.Screen
                      name="case/[id]/edit"
                      options={{
                        headerShown: false,
                      }}
                    />
                  </Stack>
                </AuthNavigator>
              </CopilotProvider>
            </PushNotificationProvider>
          </OfflineSyncProvider>
        </AuthProvider>
        <StatusBar style="auto" />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

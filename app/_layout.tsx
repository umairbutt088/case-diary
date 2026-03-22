import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
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
  const isAndroid = Platform.OS === "android";
  const statusBarStyle = isAndroid
    ? "dark-content"
    : colorScheme === "dark"
      ? "light-content"
      : "dark-content";
  const statusBarBackground = isAndroid
    ? "#F9F9FB"
    : colorScheme === "dark"
      ? "#1A1A1A"
      : "#F9F9FB";

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
                    <Stack.Screen
                      name="case/[id]/hearings"
                      options={{
                        headerShown: false,
                      }}
                    />
                    <Stack.Screen
                      name="notes"
                      options={{
                        headerShown: false,
                      }}
                    />
                    <Stack.Screen
                      name="clients"
                      options={{
                        headerShown: false,
                      }}
                    />
                    <Stack.Screen
                      name="judges"
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
        <RNStatusBar
          barStyle={statusBarStyle}
          backgroundColor={statusBarBackground}
          translucent={false}
          hidden={false}
        />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

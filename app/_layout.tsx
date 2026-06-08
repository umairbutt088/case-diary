import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import {
    Platform,
    StatusBar as RNStatusBar,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";

import { AuthNavigator } from "@/components/auth-navigator";
import { OfflineSyncProvider } from "@/components/offline-sync-provider";
import { PushNotificationProvider } from "@/components/push-notification-provider";
import { AppThemeProvider, useAppTheme } from "@/context/app-theme-context";
import { AuthProvider } from "@/context/auth-context";
import { CopilotProvider } from "react-native-copilot";

// Default to auth so the root stack never paints `(tabs)` before we know the session (avoids home flash → login).
export const unstable_settings = {
  anchor: "(auth)",
};

const NavigationDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: "#FFFFFF",
    background: "#000000",
    card: "#3A3A3C",
    text: "#FFFFFF",
    border: "#48484A",
    notification: "#FF453A",
  },
};

function RootLayoutInner() {
  const { isDark, colors } = useAppTheme();

  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  const isAndroid = Platform.OS === "android";
  const statusBarStyle = isAndroid
    ? isDark
      ? "light-content"
      : "dark-content"
    : isDark
      ? "light-content"
      : "dark-content";
  const statusBarBackground = isAndroid
    ? colors.background
    : colors.background;

  const navigationTheme = isDark ? NavigationDarkTheme : DefaultTheme;
  const copilotOverlay = "svg";
  const copilotVerticalOffset = Platform.OS === "android"
    ? RNStatusBar.currentHeight ?? 0
    : 0;

  return (
    <ThemeProvider value={navigationTheme}>
      <AuthProvider>
        <OfflineSyncProvider>
          <PushNotificationProvider>
            <CopilotProvider
              overlay={copilotOverlay}
              backdropColor="rgba(0,0,0,0.75)"
              animated={true}
              // Android walkthrough measurements are more stable with status bar offset.
              verticalOffset={copilotVerticalOffset}
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
                    options={{
                      headerShown: false,
                    }}
                  />
                  <Stack.Screen
                    name="cases-overview"
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
                  <Stack.Screen
                    name="settings"
                    options={{
                      headerShown: false,
                    }}
                  />
                  <Stack.Screen
                    name="subordinates"
                    options={{
                      headerShown: false,
                    }}
                  />
                  <Stack.Screen
                    name="trash"
                    options={{
                      headerShown: false,
                    }}
                  />
                  <Stack.Screen
                    name="acts"
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
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppThemeProvider>
        <RootLayoutInner />
      </AppThemeProvider>
    </GestureHandlerRootView>
  );
}

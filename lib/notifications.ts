import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export const APP_TIMEZONE = "Asia/Karachi";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function getProjectId() {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    null
  );
}

export function getDeviceTimezone() {
  return APP_TIMEZONE;
}

export async function registerForPushNotificationsAsync() {
  if (Platform.OS === "web") return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#000000",
    });
  }

  const permissions = await Notifications.getPermissionsAsync();
  let finalStatus = permissions.status;

  if (finalStatus !== "granted") {
    const request = await Notifications.requestPermissionsAsync();
    finalStatus = request.status;
  }

  if (finalStatus !== "granted") return null;

  const projectId = getProjectId();
  if (!projectId) return null;

  const pushToken = await Notifications.getExpoPushTokenAsync({ projectId });
  return pushToken.data;
}

export async function syncPushTokenForUser(userId: string) {
  if (!isSupabaseConfigured) return false;

  try {
    const token = await registerForPushNotificationsAsync();
    if (!token) return false;

    const timezone = getDeviceTimezone();
    const { error } = await supabase
      .from("profiles")
      .update({
        expo_push_token: token,
        timezone,
      })
      .eq("id", userId);

    return !error;
  } catch {
    return false;
  }
}

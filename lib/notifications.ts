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

const EAS_PROJECT_ID = "4d913b2c-450d-48f9-a614-94ac21ba45b1";

function getProjectId() {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    EAS_PROJECT_ID
  );
}

export function getDeviceTimezone() {
  return APP_TIMEZONE;
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
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

/**
 * Returns the current OS notification permission status without requesting it.
 * Useful for checking state before deciding whether to prompt.
 */
export async function getNotificationPermissionStatus(): Promise<"granted" | "denied" | "undetermined"> {
  if (Platform.OS === "web") return "denied";
  const { status } = await Notifications.getPermissionsAsync();
  // Expo returns "granted" | "denied" | "undetermined"
  return status as "granted" | "denied" | "undetermined";
}

export type SyncTokenResult = { ok: true } | { ok: false; error: string };

export async function syncPushTokenForUser(userId: string): Promise<SyncTokenResult> {
  if (!isSupabaseConfigured) {
    return { ok: false, error: "Supabase is not configured." };
  }

  try {
    const token = await registerForPushNotificationsAsync();
    if (!token) {
      return {
        ok: false,
        error: "Could not get push token. Check that notifications are allowed and you have internet.",
      };
    }

    const timezone = getDeviceTimezone();
    const { error } = await supabase
      .from("profiles")
      .update({
        expo_push_token: token,
        timezone,
      })
      .eq("id", userId);

    if (error) {
      return { ok: false, error: `Failed to save token: ${error.message}` };
    }

    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: message || "Unknown error" };
  }
}

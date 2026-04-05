import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Alert, Linking } from "react-native";

import { useAuth } from "@/context/auth-context";
import { getNotificationPermissionStatus, syncPushTokenForUser } from "@/lib/notifications";

const DENIED_ALERT_KEY = "@legal_diary/notif_denied_alert_shown";

type NotificationRouteData = {
  screen?: string;
  date?: string;
  url?: string;
};

const handledResponseIds = new Set<string>();

function extractDateFromDeepLink(url: string) {
  const match = url.match(/[?&]date=(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

function hasNotificationDateTarget(data: NotificationRouteData | undefined): boolean {
  if (!data) return false;
  if (data.screen === "calendar" && typeof data.date === "string") return true;
  if (typeof data.url === "string" && data.url.startsWith("legaldiary://")) {
    return extractDateFromDeepLink(data.url) !== null;
  }
  return false;
}

export function PushNotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;

    // Delay by 2 seconds so the OS permission dialog appears after the
    // login/app-open transition has settled, not during it.
    const timer = setTimeout(async () => {
      const result = await syncPushTokenForUser(userId);

      if (!result.ok) {
        // Check if the failure was due to the user denying the permission.
        const status = await getNotificationPermissionStatus();
        if (status === "denied") {
          // Only show this alert once — never repeat on subsequent app opens.
          const alreadyShown = await AsyncStorage.getItem(DENIED_ALERT_KEY);
          if (!alreadyShown) {
            await AsyncStorage.setItem(DENIED_ALERT_KEY, "true");
            Alert.alert(
              "Reminders are off",
              "You won't receive nightly hearing reminders because notifications are turned off for Legal Diary.\n\nYou can enable them any time from Profile → Cause List Reminder.",
              [
                {
                  text: "Enable now",
                  onPress: () => void Linking.openSettings(),
                },
                { text: "Maybe later", style: "cancel" },
              ],
            );
          }
        }
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [session?.user?.id]);

  useEffect(() => {
    const navigateToHomeToday = () => {
      router.push("/(tabs)");
    };

    const navigateFromData = (data: NotificationRouteData | undefined) => {
      if (!data) return;

      // For hearing reminders, open Home (today-cases flow) instead of Calendar.
      if (hasNotificationDateTarget(data)) {
        navigateToHomeToday();
        return;
      }
    };

    const handleResponse = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      if (!session?.user?.id) return;

      const responseId = response.notification.request.identifier;
      if (handledResponseIds.has(responseId)) return;
      handledResponseIds.add(responseId);

      const data = response.notification.request.content.data as NotificationRouteData;
      navigateFromData(data);
    };

    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        handleResponse(response);
      }
    );

    Notifications.getLastNotificationResponseAsync().then((response) => {
      handleResponse(response);
    });

    return () => {
      subscription.remove();
    };
  }, [router, session?.user?.id]);

  return <>{children}</>;
}

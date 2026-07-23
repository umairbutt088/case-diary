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
  filter?: string;
  date?: string;
  url?: string;
};

const handledResponseIds = new Set<string>();

function extractDateFromDeepLink(url: string) {
  const match = url.match(/[?&]date=(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

function extractFilterFromDeepLink(url: string) {
  const match = url.match(/[?&]filter=([^&]+)/);
  return match?.[1] ?? null;
}

function hasNotificationDateTarget(data: NotificationRouteData | undefined): boolean {
  if (!data) return false;
  if (
    (data.screen === "cases-overview" || data.screen === "calendar") &&
    typeof data.date === "string"
  ) {
    return true;
  }
  if (typeof data.url === "string" && data.url.startsWith("legaldiary://")) {
    return extractDateFromDeepLink(data.url) !== null;
  }
  return false;
}

function resolveNotificationRoute(data: NotificationRouteData | undefined): {
  filter: string;
  date?: string;
} | null {
  if (!data || !hasNotificationDateTarget(data)) return null;

  const dateFromData = typeof data.date === "string" ? data.date.slice(0, 10) : null;
  const dateFromUrl =
    typeof data.url === "string" ? extractDateFromDeepLink(data.url) : null;
  const date = dateFromData || dateFromUrl || undefined;

  const filterFromUrl =
    typeof data.url === "string" ? extractFilterFromDeepLink(data.url) : null;
  const rawFilter = data.filter || filterFromUrl || "tomorrow";
  const filter =
    rawFilter === "weekly" ? "weekly" : rawFilter === "tomorrow" ? "tomorrow" : "today";

  return { filter, date };
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
              "You won't receive nightly hearing reminders because notifications are turned off for Case Diary for Lawyers.\n\nYou can enable them any time from Profile → Cause List Reminder.",
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
    const navigateFromData = (data: NotificationRouteData | undefined) => {
      const route = resolveNotificationRoute(data);
      if (!route) return;

      // Cause-list reminders open the day cause list for the target hearing date
      // (tomorrow's cases), not the calendar-today list.
      router.push({
        pathname: "/cases-overview",
        params: {
          filter: route.filter,
          ...(route.date ? { date: route.date } : {}),
          from: "notification",
        },
      });
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

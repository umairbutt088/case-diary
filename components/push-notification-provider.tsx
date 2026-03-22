import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect } from "react";

import { useAuth } from "@/context/auth-context";
import { syncPushTokenForUser } from "@/lib/notifications";

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
    syncPushTokenForUser(userId);
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

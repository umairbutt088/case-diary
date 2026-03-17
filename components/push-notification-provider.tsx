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
    const navigateFromData = (data: NotificationRouteData | undefined) => {
      if (!data) return;

      if (typeof data.url === "string" && data.url.startsWith("legaldiary://")) {
        const deeplinkDate = extractDateFromDeepLink(data.url);
        if (deeplinkDate) {
          router.push({
            pathname: "/(tabs)/calendar",
            params: { date: deeplinkDate },
          });
          return;
        }
      }

      if (data.screen === "calendar" && typeof data.date === "string") {
        router.push({
          pathname: "/(tabs)/calendar",
          params: { date: data.date },
        });
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

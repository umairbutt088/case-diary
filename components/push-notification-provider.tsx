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
      router.push("/(tabs)/calendar");
    };

    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as NotificationRouteData;
        navigateFromData(data);
      }
    );

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const data = response.notification.request.content.data as NotificationRouteData;
      navigateFromData(data);
    });

    return () => {
      subscription.remove();
    };
  }, [router]);

  return <>{children}</>;
}

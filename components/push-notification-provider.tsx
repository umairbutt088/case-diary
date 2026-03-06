import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect } from "react";

import { useAuth } from "@/context/auth-context";
import { syncPushTokenForUser } from "@/lib/notifications";

type NotificationRouteData = {
  screen?: string;
  date?: string;
};

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
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content
          .data as NotificationRouteData;
        if (data?.screen === "calendar" && typeof data.date === "string") {
          router.push({
            pathname: "/(tabs)/calendar",
            params: { date: data.date },
          });
          return;
        }
        router.push("/(tabs)/calendar");
      }
    );

    return () => {
      subscription.remove();
    };
  }, [router]);

  return <>{children}</>;
}

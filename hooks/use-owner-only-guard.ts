import { useRouter } from "expo-router";
import { useEffect } from "react";

import { useAuth } from "@/context/auth-context";

/** Redirect subordinates away from owner-only screens (settings tools, trash, etc.). */
export function useOwnerOnlyGuard() {
  const { role, isAccessLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAccessLoading && role === "subordinate") {
      router.replace("/(tabs)");
    }
  }, [isAccessLoading, role, router]);

  return {
    blocked: !isAccessLoading && role === "subordinate",
  };
}

import { useRouter } from "expo-router";
import { useEffect } from "react";

import { useAuth } from "@/context/auth-context";
import type { AccessPermission } from "@/types/access";

/** Pass one permission, or multiple (user needs any of them). */
export function useAccessGuard(...permissions: AccessPermission[]) {
  if (permissions.length === 0) {
    throw new Error("useAccessGuard requires at least one permission");
  }
  const router = useRouter();
  const { isAccessLoading, can } = useAuth();
  const allowed = permissions.some((p) => can(p));

  useEffect(() => {
    if (!isAccessLoading && !allowed) {
      router.replace("/(tabs)");
    }
  }, [isAccessLoading, allowed, router]);

  return {
    isAccessLoading,
    allowed,
    blocked: !isAccessLoading && !allowed,
  };
}

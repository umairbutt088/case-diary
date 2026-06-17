import { usePathname } from "expo-router";
import { useEffect, useRef } from "react";

import { useAuth } from "@/context/auth-context";

/** Re-fetch delegated permissions when route changes (fallback if realtime is unavailable). */
export function SubordinateAccessRouteSync() {
  const pathname = usePathname();
  const { role, refreshAccess } = useAuth();
  const lastPathname = useRef<string | null>(null);

  useEffect(() => {
    if (role !== "subordinate") {
      lastPathname.current = pathname;
      return;
    }
    if (lastPathname.current === pathname) return;
    lastPathname.current = pathname;
    void refreshAccess({ silent: true });
  }, [pathname, role, refreshAccess]);

  return null;
}

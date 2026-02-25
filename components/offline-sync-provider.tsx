/**
 * Subscribes to connectivity changes and syncs pending cases to Supabase when online.
 */
import NetInfo from "@react-native-community/netinfo";
import { useEffect, useRef } from "react";

import { syncPendingCases } from "@/lib/offline-queue";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
  const lastSyncRef = useRef<number>(0);
  const SYNC_DEBOUNCE_MS = 3000;

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const trySync = async () => {
      const now = Date.now();
      if (now - lastSyncRef.current < SYNC_DEBOUNCE_MS) return;
      lastSyncRef.current = now;

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user?.id) return;

      await syncPendingCases(session.user.id);
    };

    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        trySync();
      }
    });

    // Also try sync on mount (in case we started while online)
    trySync();

    return () => unsubscribe();
  }, []);

  return <>{children}</>;
}

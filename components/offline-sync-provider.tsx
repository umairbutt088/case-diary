/**
 * Subscribes to connectivity changes and syncs pending cases to Supabase when online.
 */
import NetInfo from "@react-native-community/netinfo";
import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { syncPendingReferenceData } from "@/lib/offline-reference-data";
import { syncPendingCases } from "@/lib/offline-queue";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
  const lastSyncRef = useRef<number>(0);
  const SYNC_DEBOUNCE_MS = 3000;
  const POLL_INTERVAL_MS = 20_000;

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
      await syncPendingReferenceData(session.user.id);
    };

    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        trySync();
      }
    });

    // Also try sync on mount (in case we started while online)
    trySync();

    // Fallback polling in case the network listener misses transitions.
    const intervalId = setInterval(async () => {
      const state = await NetInfo.fetch();
      if (state.isConnected && state.isInternetReachable !== false) {
        trySync();
      }
    }, POLL_INTERVAL_MS);

    const appStateSub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") {
        trySync();
      }
    });

    return () => {
      unsubscribe();
      clearInterval(intervalId);
      appStateSub.remove();
    };
  }, []);

  return <>{children}</>;
}

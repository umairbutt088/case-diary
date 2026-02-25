import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { useEffect, useState } from "react";

function isOnline(state: NetInfoState | null): boolean {
  if (!state) return false;
  return state.isConnected === true && state.isInternetReachable !== false;
}

/** Hook that returns whether the device has internet connectivity */
export function useIsOnline(): boolean {
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    const update = (state: NetInfoState | null) => {
      if (mounted) setOnline(isOnline(state));
    };

    NetInfo.fetch().then(update);

    const unsubscribe = NetInfo.addEventListener(update);
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  // When unknown (null), assume online so we don't queue unnecessarily
  return online !== false;
}

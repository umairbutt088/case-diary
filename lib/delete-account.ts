import AsyncStorage from "@react-native-async-storage/async-storage";

import { getActivityNotesStorageKey } from "@/lib/activity-notes";
import { clearCasesCache } from "@/lib/cases-cache";
import { clearPendingCasesForUser } from "@/lib/offline-queue";
import { clearReferenceDataForUser } from "@/lib/offline-reference-data";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

async function clearLocalUserCaches(userId: string): Promise<void> {
  await clearCasesCache(userId);
  await clearPendingCasesForUser(userId);
  await clearReferenceDataForUser(userId);
  try {
    await AsyncStorage.removeItem(getActivityNotesStorageKey(userId));
  } catch {
    // ignore
  }
}

/**
 * Verifies password, deletes the auth user via RPC (DB migration `delete_own_account`),
 * then clears on-device caches. Caller should sign out and navigate to login.
 */
export async function deleteAuthenticatedAccount(
  password: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isSupabaseConfigured) {
    return { ok: false, message: "App is not connected to the server." };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const email = session?.user?.email?.trim();
  const userId = session?.user?.id;
  if (!email || !userId) {
    return { ok: false, message: "You are not signed in." };
  }

  const { error: pwError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (pwError) {
    return {
      ok: false,
      message:
        pwError.message === "Invalid login credentials"
          ? "Incorrect password."
          : pwError.message || "Could not verify password.",
    };
  }

  const { error: rpcError } = await supabase.rpc("delete_own_account");
  if (rpcError) {
    return {
      ok: false,
      message: rpcError.message || "Could not delete account. Try again or contact support.",
    };
  }

  await clearLocalUserCaches(userId);
  return { ok: true };
}

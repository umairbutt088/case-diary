import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing required env: EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY must be set."
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/**
 * Ensure session is valid before non-auth API calls.
 * Call refreshSession() if token might be expired.
 */
export async function ensureValidSession() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error) {
    await supabase.auth.signOut();
    return null;
  }
  if (!session) return null;
  const expiresAt = session.expires_at;
  if (expiresAt && expiresAt * 1000 < Date.now() + 60_000) {
    const { data: refreshed, error: refreshError } =
      await supabase.auth.refreshSession();
    if (refreshError) {
      await supabase.auth.signOut();
      return null;
    }
    return refreshed.session;
  }
  return session;
}

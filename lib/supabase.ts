import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** True when env vars are set (e.g. in EAS secrets or .env). When false, auth is disabled and the app won't crash. */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const client: SupabaseClient = createClient(
  SUPABASE_URL || "https://placeholder.supabase.co",
  SUPABASE_ANON_KEY || "placeholder-anon-key",
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

export const supabase = client;

/**
 * Ensure session is valid before non-auth API calls.
 * Call refreshSession() if token might be expired.
 * Returns null when Supabase is not configured.
 */
export async function ensureValidSession() {
  if (!isSupabaseConfigured) return null;
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

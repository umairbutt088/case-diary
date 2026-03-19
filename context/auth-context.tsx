import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "@supabase/supabase-js";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AppState, type AppStateStatus } from "react-native";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const ONBOARDING_STORAGE_KEY = "@legal_diary/onboarding_completed";
const AUTH_BOOTSTRAP_TIMEOUT_MS = 3500;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const id = setTimeout(() => {
        clearTimeout(id);
        reject(new Error("Auth bootstrap timed out"));
      }, timeoutMs);
    }),
  ]);
}

type AuthContextValue = {
  session: Session | null;
  isLoading: boolean;
  onboardingCompleted: boolean | null;
  setOnboardingCompleted: (value: boolean) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [onboardingCompleted, setOnboardingCompletedState] = useState<
    boolean | null
  >(null);

  const loadOnboardingFlag = useCallback(async () => {
    try {
      const value = await AsyncStorage.getItem(ONBOARDING_STORAGE_KEY);
      setOnboardingCompletedState(value === "true");
    } catch {
      setOnboardingCompletedState(false);
    }
  }, []);

  const setOnboardingCompleted = useCallback(async (value: boolean) => {
    await AsyncStorage.setItem(
      ONBOARDING_STORAGE_KEY,
      value ? "true" : "false"
    );
    setOnboardingCompletedState(value);
  }, []);

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured) await supabase.auth.signOut();
  }, []);

  useEffect(() => {
    loadOnboardingFlag();
  }, [loadOnboardingFlag]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    let mounted = true;

    async function initSession() {
      try {
        const {
          data: { session: initialSession },
          error,
        } = await withTimeout(supabase.auth.getSession(), AUTH_BOOTSTRAP_TIMEOUT_MS);
        if (!mounted) return;
        if (error) {
          setSession(null);
          setIsLoading(false);
          return;
        }

        setSession(initialSession ?? null);

        // Do not block app startup on refresh when offline.
        if (
          initialSession?.expires_at &&
          initialSession.expires_at * 1000 < Date.now() + 60_000
        ) {
          supabase.auth
            .refreshSession()
            .then(async ({ data: { session: refreshed }, error: refreshError }) => {
              if (!mounted) return;
              if (refreshError) {
                await supabase.auth.signOut();
                if (mounted) setSession(null);
              } else if (refreshed) {
                setSession(refreshed);
              }
            })
            .catch(() => {
              // Keep current session and retry on foreground.
            });
        }
      } catch {
        if (mounted) setSession(null);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    initSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;
      if (
        [
          "INITIAL_SESSION",
          "SIGNED_IN",
          "TOKEN_REFRESHED",
          "USER_UPDATED",
        ].includes(event)
      ) {
        setSession(newSession ?? null);
      } else if (event === "SIGNED_OUT") {
        setSession(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Optional: refresh session when app comes to foreground
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") {
        supabase.auth.getSession().then(({ data: { session: s } }) => {
          if (s?.expires_at && s.expires_at * 1000 < Date.now() + 60_000) {
            supabase.auth
              .refreshSession()
              .then(({ data: { session: refreshed } }) => {
                if (refreshed) setSession(refreshed);
              });
          }
        });
      }
    });
    return () => sub.remove();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isLoading,
      onboardingCompleted,
      setOnboardingCompleted,
      signOut,
    }),
    [session, isLoading, onboardingCompleted, setOnboardingCompleted, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

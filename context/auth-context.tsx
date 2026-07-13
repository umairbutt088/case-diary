import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { AppState, type AppStateStatus } from "react-native";

import { tryApplySupabaseAuthFromUrl } from "@/lib/auth-deeplink";
import {
  parseSubordinateLinkRow,
  permissionsFromSubordinateLink,
} from "@/lib/subordinate-access";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { AccessPermission, AccessPermissions, AccessRole } from "@/types/access";
import {
  FULL_ACCESS_PERMISSIONS,
  SUBORDINATE_FALLBACK_PERMISSIONS,
} from "@/types/access";
import type { ProfileRow } from "@/types/profile";
import type { SubordinateLinkRow } from "@/types/subordinate-link";

const ONBOARDING_STORAGE_KEY = "@legal_diary/onboarding_completed";
const EXPECTS_PASSWORD_CHANGE_KEY = "@legal_diary/expects_password_change";
const AUTH_BOOTSTRAP_TIMEOUT_MS = 3500;

function authContextDebug(step: string, data?: Record<string, unknown>) {
  if (!__DEV__) return;
  console.log("[auth-context]", step, data ?? {});
}

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

function normalizeRole(value: string | null | undefined): AccessRole {
  if (
    value === "user" ||
    value === "partner" ||
    value === "admin" ||
    value === "subordinate"
  ) {
    return value;
  }
  return "user";
}

type AuthContextValue = {
  session: Session | null;
  isLoading: boolean;
  isAccessLoading: boolean;
  profile: ProfileRow | null;
  role: AccessRole;
  effectiveOwnerId: string | null;
  permissions: AccessPermissions;
  subordinateLink: SubordinateLinkRow | null;
  can: (permission: AccessPermission) => boolean;
  refreshAccess: (options?: { silent?: boolean }) => Promise<void>;
  /** True after opening a password-recovery deep link until the user sets a new password or signs out. */
  expectsPasswordChange: boolean;
  clearPasswordRecoveryExpectation: () => Promise<void>;
  onboardingCompleted: boolean | null;
  setOnboardingCompleted: (value: boolean) => Promise<void>;
  /** Where to land after finishing first-run onboarding. */
  postOnboardingRoute: "/(auth)/login" | "/(auth)/signup";
  completeOnboarding: (
    route?: "/(auth)/login" | "/(auth)/signup",
  ) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expectsPasswordChange, setExpectsPasswordChange] = useState(false);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [role, setRole] = useState<AccessRole>("user");
  const [effectiveOwnerId, setEffectiveOwnerId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<AccessPermissions>(FULL_ACCESS_PERMISSIONS);
  const [subordinateLink, setSubordinateLink] = useState<SubordinateLinkRow | null>(null);
  const [isAccessLoading, setIsAccessLoading] = useState(true);
  const accessHydratedRef = useRef(false);
  const refreshGenerationRef = useRef(0);
  const roleRef = useRef<AccessRole>("user");
  const [onboardingCompleted, setOnboardingCompletedState] = useState<
    boolean | null
  >(null);
  const [postOnboardingRoute, setPostOnboardingRoute] = useState<
    "/(auth)/login" | "/(auth)/signup"
  >("/(auth)/login");

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

  const completeOnboarding = useCallback(
    async (route: "/(auth)/login" | "/(auth)/signup" = "/(auth)/login") => {
      setPostOnboardingRoute(route);
      await setOnboardingCompleted(true);
    },
    [setOnboardingCompleted],
  );

  const clearPasswordRecoveryExpectation = useCallback(async () => {
    await AsyncStorage.removeItem(EXPECTS_PASSWORD_CHANGE_KEY);
    setExpectsPasswordChange(false);
  }, []);

  const signOut = useCallback(async () => {
    await clearPasswordRecoveryExpectation();
    if (isSupabaseConfigured) await supabase.auth.signOut();
  }, [clearPasswordRecoveryExpectation]);

  const applySubordinateAccess = useCallback(
    (link: SubordinateLinkRow | null, ownerFallbackId: string) => {
      setSubordinateLink(link);
      setEffectiveOwnerId(link?.supervisor_user_id ?? ownerFallbackId);
      setPermissions(permissionsFromSubordinateLink(link));
    },
    [],
  );

  const refreshAccess = useCallback(async (options?: { silent?: boolean }) => {
    const userId = session?.user?.id;
    if (!isSupabaseConfigured || !userId) {
      setProfile(null);
      setRole("user");
      roleRef.current = "user";
      setEffectiveOwnerId(null);
      setPermissions(FULL_ACCESS_PERMISSIONS);
      setSubordinateLink(null);
      accessHydratedRef.current = false;
      setIsAccessLoading(false);
      return;
    }

    const generation = ++refreshGenerationRef.current;
    const silent = Boolean(options?.silent && accessHydratedRef.current);
    if (!silent) {
      setIsAccessLoading(true);
    }

    const isStale = () => generation !== refreshGenerationRef.current;

    let resolvedRole: AccessRole | null = null;

    try {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (isStale()) return;
      if (profileError) throw profileError;

      const nextProfile = (profileData as ProfileRow | null) ?? null;
      setProfile(nextProfile);

      const nextRole = normalizeRole(nextProfile?.role);
      resolvedRole = nextRole;
      setRole(nextRole);
      roleRef.current = nextRole;

      if (nextRole !== "subordinate") {
        setSubordinateLink(null);
        setEffectiveOwnerId(userId);
        setPermissions(FULL_ACCESS_PERMISSIONS);
        return;
      }

      const { data: linkData, error: linkError } = await supabase
        .from("subordinate_links")
        .select("*")
        .eq("subordinate_user_id", userId)
        .eq("is_active", true)
        .maybeSingle();

      if (isStale()) return;
      if (linkError) throw linkError;

      const link = (linkData as SubordinateLinkRow | null) ?? null;
      applySubordinateAccess(link, userId);
    } catch (error) {
      authContextDebug("refreshAccess failed", { silent, error });
      if (silent || isStale()) return;

      if (resolvedRole === "subordinate") {
        applySubordinateAccess(null, userId);
        return;
      }

      setProfile(null);
      setRole("user");
      roleRef.current = "user";
      setEffectiveOwnerId(userId);
      setSubordinateLink(null);
      setPermissions(FULL_ACCESS_PERMISSIONS);
    } finally {
      if (!isStale()) {
        accessHydratedRef.current = true;
        if (!silent) {
          setIsAccessLoading(false);
        }
      }
    }
  }, [applySubordinateAccess, session?.user?.id]);

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
        const initialUrl = await Linking.getInitialURL();
        authContextDebug("initial-url", { present: Boolean(initialUrl), url: initialUrl ?? null });
        if (initialUrl) {
          const applied = await tryApplySupabaseAuthFromUrl(initialUrl);
          authContextDebug("initial-url-applied", applied);
          if (!mounted) return;
          if (applied.needsPasswordChange) {
            await AsyncStorage.setItem(EXPECTS_PASSWORD_CHANGE_KEY, "true");
            setExpectsPasswordChange(true);
          }
        }

        const {
          data: { session: initialSession },
          error,
        } = await withTimeout(supabase.auth.getSession(), AUTH_BOOTSTRAP_TIMEOUT_MS);
        if (!mounted) return;
        if (error) {
          setSession(null);
          await AsyncStorage.removeItem(EXPECTS_PASSWORD_CHANGE_KEY);
          setExpectsPasswordChange(false);
          setIsLoading(false);
          return;
        }

        if (!initialSession) {
          await AsyncStorage.removeItem(EXPECTS_PASSWORD_CHANGE_KEY);
          setExpectsPasswordChange(false);
        } else {
          const stored = await AsyncStorage.getItem(EXPECTS_PASSWORD_CHANGE_KEY);
          setExpectsPasswordChange(stored === "true");
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
        if (mounted) {
          setSession(null);
          void AsyncStorage.removeItem(EXPECTS_PASSWORD_CHANGE_KEY);
          setExpectsPasswordChange(false);
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    initSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;
      authContextDebug("onAuthStateChange", {
        event,
        hasSession: Boolean(newSession),
      });
      if (
        [
          "INITIAL_SESSION",
          "SIGNED_IN",
          "TOKEN_REFRESHED",
          "USER_UPDATED",
        ].includes(event)
      ) {
        setSession(newSession ?? null);
      } else if (event === "PASSWORD_RECOVERY") {
        setSession(newSession ?? null);
        void AsyncStorage.setItem(EXPECTS_PASSWORD_CHANGE_KEY, "true");
        setExpectsPasswordChange(true);
      } else if (event === "SIGNED_OUT") {
        setSession(null);
        void AsyncStorage.removeItem(EXPECTS_PASSWORD_CHANGE_KEY);
        setExpectsPasswordChange(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user?.id) {
      setProfile(null);
      setRole("user");
      roleRef.current = "user";
      refreshGenerationRef.current += 1;
      setEffectiveOwnerId(null);
      setPermissions(FULL_ACCESS_PERMISSIONS);
      setSubordinateLink(null);
      setIsAccessLoading(false);
      return;
    }
    void refreshAccess();
  }, [session?.user?.id, refreshAccess]);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!isSupabaseConfigured || !userId) return;

    const channel = supabase
      .channel(`subordinate-access:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "subordinate_links",
          filter: `subordinate_user_id=eq.${userId}`,
        },
        (payload) => {
          authContextDebug("subordinate link realtime", {
            eventType: payload.eventType,
          });

          if (payload.eventType === "DELETE") {
            applySubordinateAccess(null, userId);
            return;
          }

          const link = parseSubordinateLinkRow(
            payload.new as Record<string, unknown> | undefined,
          );

          if (!link?.is_active) {
            applySubordinateAccess(null, userId);
            return;
          }

          applySubordinateAccess(link, userId);
        },
      )
      .subscribe((status) => {
        authContextDebug("subordinate link channel", { status });
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [applySubordinateAccess, session?.user?.id]);

  const can = useCallback(
    (permission: AccessPermission) => Boolean(permissions[permission]),
    [permissions],
  );

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const sub = Linking.addEventListener("url", ({ url }) => {
      void (async () => {
        authContextDebug("linking-url-event", { url });
        const result = await tryApplySupabaseAuthFromUrl(url);
        authContextDebug("linking-url-applied", result);
        if (result.needsPasswordChange) {
          await AsyncStorage.setItem(EXPECTS_PASSWORD_CHANGE_KEY, "true");
          setExpectsPasswordChange(true);
        }
      })();
    });
    return () => sub.remove();
  }, []);

  // Optional: refresh session when app comes to foreground
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") {
        void refreshAccess({ silent: true });
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
  }, [refreshAccess]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isLoading,
      isAccessLoading,
      profile,
      role,
      effectiveOwnerId,
      permissions,
      subordinateLink,
      can,
      refreshAccess,
      expectsPasswordChange,
      clearPasswordRecoveryExpectation,
      onboardingCompleted,
      setOnboardingCompleted,
      postOnboardingRoute,
      completeOnboarding,
      signOut,
    }),
    [
      session,
      isLoading,
      isAccessLoading,
      profile,
      role,
      effectiveOwnerId,
      permissions,
      subordinateLink,
      can,
      refreshAccess,
      expectsPasswordChange,
      clearPasswordRecoveryExpectation,
      onboardingCompleted,
      setOnboardingCompleted,
      postOnboardingRoute,
      completeOnboarding,
      signOut,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

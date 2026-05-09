import Constants from "expo-constants";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";

/** Path segment for password-recovery callback — must match Supabase "Additional Redirect URLs". */
export const PASSWORD_RECOVERY_LINK_PATH = "reset-password";
const PASSWORD_RECOVERY_REDIRECT_TO = `legaldiary://${PASSWORD_RECOVERY_LINK_PATH}`;

function getDevClientRecoveryRedirectTo(): string | null {
  const iosBundleId = Constants.expoConfig?.ios?.bundleIdentifier;
  if (!iosBundleId) return null;
  // iOS development builds often register the bundle identifier as the active scheme.
  return `${iosBundleId}://${PASSWORD_RECOVERY_LINK_PATH}`;
}

function redactUrlForDebug(url: string): string {
  // Hide auth secrets in query/fragment but keep path/shape for diagnosis.
  return url
    .replace(/(access_token=)[^&#]+/g, "$1[redacted]")
    .replace(/(refresh_token=)[^&#]+/g, "$1[redacted]")
    .replace(/(token_hash=)[^&#]+/g, "$1[redacted]")
    .replace(/(code=)[^&#]+/g, "$1[redacted]");
}

function authDebug(step: string, data?: Record<string, unknown>) {
  if (!__DEV__) return;
  console.log("[auth-deeplink]", step, data ?? {});
}

/** Redirect URL passed to `resetPasswordForEmail` (add this exact URL pattern in the Supabase dashboard). */
export function getPasswordRecoveryRedirectTo(): string {
  if (__DEV__) {
    const devClientRedirect = getDevClientRecoveryRedirectTo();
    if (devClientRedirect) return devClientRedirect;
  }
  // Stable custom-scheme callback for standalone/prod builds.
  return PASSWORD_RECOVERY_REDIRECT_TO;
}

/**
 * Parses Supabase auth callback params from the URL fragment and/or query string
 * (implicit grant uses a `#access_token=...` fragment; PKCE uses `?code=...`).
 */
export function parseAuthParamsFromUrl(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const hashIndex = url.indexOf("#");
  if (hashIndex !== -1) {
    const fragment = url.slice(hashIndex + 1);
    const fragmentQuery = fragment.includes("?")
      ? fragment.split("?")[0]
      : fragment;
    new URLSearchParams(fragmentQuery).forEach((value, key) => {
      out[key] = value;
    });
  }
  const beforeHash = hashIndex !== -1 ? url.slice(0, hashIndex) : url;
  try {
    const u = new URL(beforeHash);
    u.searchParams.forEach((value, key) => {
      out[key] = value;
    });
  } catch {
    const q = beforeHash.includes("?") ? beforeHash.split("?")[1] : "";
    if (q) {
      new URLSearchParams(q).forEach((value, key) => {
        out[key] = value;
      });
    }
  }
  return out;
}

function authCallbackErrorMessage(params: Record<string, string>): string | null {
  if (params.error || params.error_code || params.error_description) {
    return params.error_description || params.error || "Authentication error";
  }
  return null;
}

/**
 * If `url` carries Supabase auth tokens or a PKCE code, applies them to the client.
 * Returns whether the URL looked like an auth callback and whether the user should set a new password.
 */
export async function tryApplySupabaseAuthFromUrl(url: string): Promise<{
  handled: boolean;
  needsPasswordChange: boolean;
  errorMessage: string | null;
}> {
  if (!isSupabaseConfigured || !url.trim()) {
    return { handled: false, needsPasswordChange: false, errorMessage: null };
  }

  const params = parseAuthParamsFromUrl(url);
  authDebug("received-url", {
    url: redactUrlForDebug(url),
    hasCode: Boolean(params.code),
    hasAccessToken: Boolean(params.access_token),
    hasRefreshToken: Boolean(params.refresh_token),
    hasTokenHash: Boolean(params.token_hash),
    type: params.type ?? null,
  });
  const callbackErr = authCallbackErrorMessage(params);
  if (callbackErr) {
    authDebug("callback-error", { message: callbackErr });
    return { handled: true, needsPasswordChange: false, errorMessage: callbackErr };
  }

  const recoveryPath = url.includes(PASSWORD_RECOVERY_LINK_PATH);
  const implicitRecovery = params.type === "recovery";

  // Some Supabase templates/callback flows deliver `token_hash` instead of `code` or `access_token`.
  if (params.token_hash && (implicitRecovery || recoveryPath)) {
    authDebug("flow-selected", { flow: "verifyOtp(token_hash)" });
    const { data, error } = await supabase.auth.verifyOtp({
      type: "recovery",
      token_hash: params.token_hash,
    });
    if (error) {
      authDebug("verifyOtp-error", { message: error.message });
      return {
        handled: true,
        needsPasswordChange: false,
        errorMessage: error.message,
      };
    }
    authDebug("verifyOtp-success", { hasSession: Boolean(data.session) });
    return {
      handled: true,
      needsPasswordChange: Boolean(data.session),
      errorMessage: null,
    };
  }

  if (params.code && !params.access_token) {
    authDebug("flow-selected", { flow: "exchangeCodeForSession(code)" });
    const { data, error } = await supabase.auth.exchangeCodeForSession(
      params.code
    );
    if (error) {
      authDebug("exchangeCode-error", { message: error.message });
      return {
        handled: true,
        needsPasswordChange: false,
        errorMessage: error.message,
      };
    }
    if (data.session) {
      const needsPasswordChange = recoveryPath || implicitRecovery;
      authDebug("exchangeCode-success", { needsPasswordChange });
      return { handled: true, needsPasswordChange, errorMessage: null };
    }
    authDebug("exchangeCode-no-session");
    return { handled: true, needsPasswordChange: false, errorMessage: null };
  }

  const access = params.access_token;
  const refresh = params.refresh_token;
  if (access && refresh) {
    authDebug("flow-selected", { flow: "setSession(access+refresh)" });
    const needsPasswordChange =
      implicitRecovery || (recoveryPath && Boolean(access));
    const { error } = await supabase.auth.setSession({
      access_token: access,
      refresh_token: refresh,
    });
    if (error) {
      authDebug("setSession-error", { message: error.message });
      return {
        handled: true,
        needsPasswordChange: false,
        errorMessage: error.message,
      };
    }
    authDebug("setSession-success", { needsPasswordChange });
    return { handled: true, needsPasswordChange, errorMessage: null };
  }

  authDebug("ignored-url", {
    reason: "no-supported-auth-params",
    url: redactUrlForDebug(url),
  });
  return { handled: false, needsPasswordChange: false, errorMessage: null };
}

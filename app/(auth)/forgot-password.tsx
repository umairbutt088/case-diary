import { useCallback, useState } from "react";

import { ThemedText } from "@/components/themed-text";
import {
    AuthButton,
    AuthScreenLayout,
    FormInput,
    FormMessage,
    Spacer,
} from "@/components/ui";
import { getPasswordRecoveryRedirectTo } from "@/lib/auth-deeplink";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validate = useCallback(() => {
    const trimmed = email.trim();
    let valid = true;
    if (!trimmed) {
      setEmailError("Email is required");
      valid = false;
    } else if (!EMAIL_REGEX.test(trimmed)) {
      setEmailError("Please enter a valid email");
      valid = false;
    } else {
      setEmailError(null);
    }
    setSubmitError(null);
    return valid;
  }, [email]);

  const handleSubmit = async () => {
    if (!isSupabaseConfigured) {
      setSubmitError("Supabase is not configured.");
      return;
    }
    if (!validate() || loading) return;
    setLoading(true);
    setSubmitError(null);
    setSuccessMessage(null);
    const trimmedEmail = email.trim();
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        trimmedEmail,
        { redirectTo: getPasswordRecoveryRedirectTo() }
      );
      if (error) {
        setSubmitError(error.message);
        setLoading(false);
        return;
      }
      setSuccessMessage(
        "If an account exists for that email, you will receive a link to reset your password."
      );
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreenLayout
      title="Forgot password"
      footerLink={{
        linkHeader: "Remember your password?",
        linkLabel: "Sign In",
        href: "/(auth)/login",
      }}
    >
      <ThemedText style={{ textAlign: "center", marginBottom: 16 }}>
        Enter your email and we will send you a reset link.
      </ThemedText>
      <FormInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        error={emailError}
        onClearError={() => {
          setEmailError(null);
          setSubmitError(null);
          setSuccessMessage(null);
        }}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        editable={!loading}
        lightBackground
      />
      {submitError ? <FormMessage message={submitError} /> : null}
      {successMessage ? (
        <FormMessage message={successMessage} type="success" />
      ) : null}
      <Spacer.Column numberOfSpaces={10} />
      <AuthButton
        label="Send reset link"
        onPress={handleSubmit}
        loading={loading}
        disabled={loading}
      />
    </AuthScreenLayout>
  );
}

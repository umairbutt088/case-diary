import { useCallback, useState } from "react";

import { AuthButton } from "@/components/ui/auth-button";
import { AuthScreenLayout } from "@/components/ui/auth-screen-layout";
import { FormInput } from "@/components/ui/form-input";
import { FormMessage } from "@/components/ui/form-message";
import { PasswordInput } from "@/components/ui/password-input";
import { supabase } from "@/lib/supabase";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
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
    if (!password) {
      setPasswordError("Password is required");
      valid = false;
    } else {
      setPasswordError(null);
    }
    setSubmitError(null);
    return valid;
  }, [email, password]);

  const handleSignIn = async () => {
    if (!validate() || loading) return;
    setLoading(true);
    setSubmitError(null);
    const trimmedEmail = email.trim();
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (error) {
        const message =
          error.message === "Email not confirmed"
            ? "Please check your email and click the confirmation link, then try again."
            : error.message;
        setSubmitError(message);
        setLoading(false);
        return;
      }
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
      title="Sign In"
      footerLink={{
        label: "Don't have an account? Sign Up",
        href: "/(auth)/signup",
      }}
    >
      <FormInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        error={emailError}
        onClearError={() => {
          setEmailError(null);
          setSubmitError(null);
        }}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        editable={!loading}
      />

      <PasswordInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        error={passwordError}
        onClearError={() => {
          setPasswordError(null);
          setSubmitError(null);
        }}
        editable={!loading}
      />

      {submitError ? <FormMessage message={submitError} /> : null}

      <AuthButton
        label="Sign In"
        onPress={handleSignIn}
        loading={loading}
        disabled={loading}
      />
    </AuthScreenLayout>
  );
}

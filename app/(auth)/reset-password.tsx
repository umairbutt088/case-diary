import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";

import {
  AuthButton,
  AuthScreenLayout,
  FormMessage,
  PasswordInput,
  Spacer,
} from "@/components/ui";
import { ThemedText } from "@/components/themed-text";
import { useAuth } from "@/context/auth-context";
import { supabase } from "@/lib/supabase";

const MIN_PASSWORD_LENGTH = 6;

export default function ResetPasswordScreen() {
  const router = useRouter();
  const {
    session,
    expectsPasswordChange,
    clearPasswordRecoveryExpectation,
    isLoading,
  } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<
    string | null
  >(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!session) {
      router.replace("/(auth)/login" as any);
      return;
    }
    if (!expectsPasswordChange) {
      router.replace("/(tabs)" as any);
    }
  }, [session, expectsPasswordChange, isLoading, router]);

  const validate = useCallback(() => {
    let valid = true;
    if (!password) {
      setPasswordError("Password is required");
      valid = false;
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
      );
      valid = false;
    } else {
      setPasswordError(null);
    }
    if (!confirmPassword) {
      setConfirmPasswordError("Please confirm your password");
      valid = false;
    } else if (password !== confirmPassword) {
      setConfirmPasswordError("Passwords do not match");
      valid = false;
    } else {
      setConfirmPasswordError(null);
    }
    setSubmitError(null);
    return valid;
  }, [password, confirmPassword]);

  const handleUpdatePassword = async () => {
    if (!validate() || loading) return;
    setLoading(true);
    setSubmitError(null);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setSubmitError(error.message);
        setLoading(false);
        return;
      }
      await clearPasswordRecoveryExpectation();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  };

  if (isLoading || !session || !expectsPasswordChange) {
    return (
      <AuthScreenLayout title="Reset password">
        <View style={{ minHeight: 120 }} />
      </AuthScreenLayout>
    );
  }

  return (
    <AuthScreenLayout title="New password">
      <ThemedText type="default" style={{ textAlign: "center", marginBottom: 16 }}>
        Choose a new password for your account.
      </ThemedText>
      <PasswordInput
        placeholder={`Password (min ${MIN_PASSWORD_LENGTH} characters)`}
        value={password}
        onChangeText={(t) => {
          setPassword(t);
          setPasswordError(null);
          if (confirmPassword && t !== confirmPassword)
            setConfirmPasswordError("Passwords do not match");
          else setConfirmPasswordError(null);
        }}
        error={passwordError}
        onClearError={() => setPasswordError(null)}
        editable={!loading}
        lightBackground
      />
      <Spacer.Column numberOfSpaces={3} />
      <PasswordInput
        placeholder="Confirm password"
        value={confirmPassword}
        onChangeText={(t) => {
          setConfirmPassword(t);
          setConfirmPasswordError(null);
        }}
        error={confirmPasswordError}
        onClearError={() => setConfirmPasswordError(null)}
        editable={!loading}
        lightBackground
      />
      {submitError ? <FormMessage message={submitError} /> : null}
      <Spacer.Column numberOfSpaces={10} />
      <AuthButton
        label="Update password"
        onPress={handleUpdatePassword}
        loading={loading}
        disabled={loading}
      />
    </AuthScreenLayout>
  );
}

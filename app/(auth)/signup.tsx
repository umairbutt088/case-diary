import * as Linking from "expo-linking";
import { useCallback, useState } from "react";

import {
  AuthButton,
  AuthScreenLayout,
  FormInput,
  FormMessage,
  PasswordInput,
  Spacer,
  TermsCheckbox,
} from "@/components/ui";
import { supabase } from "@/lib/supabase";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

/** Public legal pages (GitHub Pages) — same URLs can be used in App Store Connect / Play Console. */
const LEGAL_TERMS_URL = "https://umairbutt088.github.io/case-diary/terms.html";
const LEGAL_PRIVACY_URL = "https://umairbutt088.github.io/case-diary/privacy.html";

export default function SignUpScreen() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [firstNameError, setFirstNameError] = useState<string | null>(null);
  const [lastNameError, setLastNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<
    string | null
  >(null);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [signUpSuccessMessage, setSignUpSuccessMessage] = useState<
    string | null
  >(null);
  const [loading, setLoading] = useState(false);

  const clearSubmitError = useCallback(() => setSubmitError(null), []);

  const validate = useCallback(() => {
    const trimmedEmail = email.trim();
    let valid = true;

    if (!firstName.trim()) {
      setFirstNameError("First name is required");
      valid = false;
    } else setFirstNameError(null);

    if (!lastName.trim()) {
      setLastNameError("Last name is required");
      valid = false;
    } else setLastNameError(null);

    if (!trimmedEmail) {
      setEmailError("Email is required");
      valid = false;
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      setEmailError("Please enter a valid email");
      valid = false;
    } else setEmailError(null);

    if (!password) {
      setPasswordError("Password is required");
      valid = false;
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
      );
      valid = false;
    } else setPasswordError(null);

    if (!confirmPassword) {
      setConfirmPasswordError("Please confirm your password");
      valid = false;
    } else if (password !== confirmPassword) {
      setConfirmPasswordError("Passwords do not match");
      valid = false;
    } else setConfirmPasswordError(null);

    if (!acceptTerms) {
      setTermsError("You must accept the Terms and Privacy Policy");
      valid = false;
    } else setTermsError(null);

    setSubmitError(null);
    return valid;
  }, [firstName, lastName, email, password, confirmPassword, acceptTerms]);

  const handleSignUp = async () => {
    if (!validate() || loading) return;
    setLoading(true);
    setSubmitError(null);
    setSignUpSuccessMessage(null);
    const trimmedEmail = email.trim();
    try {
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            full_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
            role: "user",
          },
        },
      });
      if (error) {
        setSubmitError(error.message);
        setLoading(false);
        return;
      }
      if (!data.session && data.user) {
        setSignUpSuccessMessage(
          "Account created. Check your email to confirm, then sign in.",
        );
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
      title="Sign Up"
      footerLink={{
        linkHeader: "Already have an account?",
        linkLabel: "Sign In",
        href: "/(auth)/login",
      }}
    >
      <FormInput
        placeholder="First name"
        value={firstName}
        onChangeText={setFirstName}
        error={firstNameError}
        onClearError={() => setFirstNameError(null)}
        autoCapitalize="words"
        editable={!loading}
        lightBackground
      />
      <Spacer.Column numberOfSpaces={3} />
      <FormInput
        placeholder="Last name"
        value={lastName}
        onChangeText={setLastName}
        error={lastNameError}
        onClearError={() => setLastNameError(null)}
        autoCapitalize="words"
        editable={!loading}
        lightBackground
      />
      <Spacer.Column numberOfSpaces={3} />
      <FormInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        error={emailError}
        onClearError={() => {
          setEmailError(null);
          clearSubmitError();
        }}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        editable={!loading}
        lightBackground
      />
      <Spacer.Column numberOfSpaces={3} />
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

      <TermsCheckbox
        checked={acceptTerms}
        onToggle={() => {
          setAcceptTerms((v) => !v);
          setTermsError(null);
        }}
        termsLabel="Terms of Service"
        privacyLabel="Privacy Policy"
        onTermsPress={() => Linking.openURL(LEGAL_TERMS_URL)}
        onPrivacyPress={() => Linking.openURL(LEGAL_PRIVACY_URL)}
        error={termsError}
        disabled={loading}
      />
      <Spacer.Column numberOfSpaces={3} />
      {signUpSuccessMessage ? (
        <FormMessage message={signUpSuccessMessage} type="success" />
      ) : null}
      {submitError ? <FormMessage message={submitError} /> : null}
      <Spacer.Column numberOfSpaces={3} />
      <AuthButton
        label="Sign Up"
        onPress={handleSignUp}
        loading={loading}
        disabled={loading}
      />
    </AuthScreenLayout>
  );
}

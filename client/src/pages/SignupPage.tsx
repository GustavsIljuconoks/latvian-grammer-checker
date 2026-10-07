import { useSignUp } from "@clerk/react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { clerkErrorMessage } from "@/components/auth/clerkError";
import { CodeField, Field, FormError, SubmitButton } from "@/components/auth/Field";
import { goTo } from "@/components/auth/goTo";
import { t } from "@/i18n";
import { paths } from "@/routes";

export function SignupPage() {
  const { signUp, fetchStatus } = useSignUp();
  const navigate = useNavigate();
  const [error, setError] = useState<string>();
  const busy = fetchStatus === "fetching";

  async function submit(form: FormData) {
    setError(undefined);
    const { error } = await signUp.password({
      emailAddress: String(form.get("email")),
      password: String(form.get("password")),
    });
    if (error) return setError(clerkErrorMessage(error, t.auth.signupFailed));
    await signUp.verifications.sendEmailCode();
  }

  async function verify(form: FormData) {
    setError(undefined);
    const { error } = await signUp.verifications.verifyEmailCode({ code: String(form.get("code")) });
    if (error) return setError(t.auth.wrongCode);
    if (signUp.status === "complete") {
      await signUp.finalize({ navigate: ({ decorateUrl }) => goTo(decorateUrl(paths.checker), navigate) });
    }
  }

  const awaitingCode =
    signUp.status === "missing_requirements" &&
    signUp.unverifiedFields.includes("email_address") &&
    signUp.missingFields.length === 0;

  if (awaitingCode) {
    return (
      <AuthLayout title={t.auth.verifyTitle} subtitle={t.auth.verifySubtitle}>
        <form action={verify} className="flex flex-col">
          <CodeField />
          {error && <FormError>{error}</FormError>}
          <SubmitButton busy={busy}>{t.auth.verify}</SubmitButton>
        </form>
        <button
          type="button"
          className="auth-link mx-auto mt-5 text-[13px] text-muted-foreground"
          onClick={() => signUp.verifications.sendEmailCode()}
        >
          {t.auth.resendCode}
        </button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t.auth.signupTitle} subtitle={t.auth.signupSubtitle}>
      <form action={submit} className="flex flex-col">
        <Field id="email" type="email" label={t.auth.email} placeholder={t.auth.emailPlaceholder} autoComplete="email" required />
        <Field id="password" type="password" label={t.auth.password} placeholder="••••••••" autoComplete="new-password" required />
        {error && <FormError>{error}</FormError>}
        <SubmitButton busy={busy}>{t.auth.createAccount} →</SubmitButton>
      </form>
      {/* Required by Clerk's bot protection on sign-up. */}
      <div id="clerk-captcha" className="mt-4" />
      <p className="mt-[22px] text-center text-[13px] text-muted-foreground">
        {t.auth.haveAccount}{" "}
        <Link to={paths.login} className="auth-link font-semibold text-foreground">
          {t.auth.login}
        </Link>
      </p>
    </AuthLayout>
  );
}
